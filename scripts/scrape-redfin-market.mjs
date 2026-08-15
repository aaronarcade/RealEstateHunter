#!/usr/bin/env node

/**
 * Bulk-scrape active for-sale listings from Redfin GIS for one US market.
 *
 * Usage:
 *   node scripts/scrape-redfin-market.mjs \
 *     --market tampa-fl \
 *     --market-area tampa \
 *     --states FL \
 *     --regions 18142:6 \
 *     --market-param florida \
 *     --output data/scrapes/tampa-fl-active-listings-2026-08-15.json
 *
 * Optional:
 *   --condo-only          Restrict GIS uipt to condo (2) and filter mapped rows
 *   --notes "..."         Notes stored on the scrape payload
 *   --max-start N         Cap pagination start offset (default 15000)
 *
 * Region IDs (city, region_type=6) used by TASK-015 / scrape-us-active-markets.mjs
 * are documented in data/scrapes/README.md.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const PROPERTY_TYPE_BY_UI = {
  1: 'single_family',
  2: 'condo',
  3: 'townhouse',
  4: 'multi_family',
  5: 'land',
  6: 'mobile',
  7: 'co_op',
  8: 'other',
};

export function parseArgs(argv) {
  const args = {
    market: null,
    marketArea: null,
    output: null,
    marketParam: 'florida',
    regions: [],
    notes: '',
    states: [],
    condoOnly: false,
    maxStart: 15000,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--market' && value) {
      args.market = value;
      i += 1;
    } else if (flag === '--market-area' && value) {
      args.marketArea = value;
      i += 1;
    } else if (flag === '--output' && value) {
      args.output = join(REPO_ROOT, value);
      i += 1;
    } else if (flag === '--market-param' && value) {
      args.marketParam = value;
      i += 1;
    } else if (flag === '--notes' && value) {
      args.notes = value;
      i += 1;
    } else if (flag === '--max-start' && value) {
      args.maxStart = Number(value);
      i += 1;
    } else if (flag === '--condo-only') {
      args.condoOnly = true;
    } else if (flag === '--states' && value) {
      args.states = value
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      i += 1;
    } else if (flag === '--regions' && value) {
      for (const part of value.split(',')) {
        const [id, type = '6'] = part.split(':');
        args.regions.push({ id, type, label: `${id}-region` });
      }
      i += 1;
    }
  }

  if (!args.states.length) {
    // Backward compatible default for legacy FL-only invocations.
    args.states = ['FL'];
  }

  if (!args.market || !args.marketArea || !args.output || !args.regions.length) {
    console.error(
      'Required: --market --market-area --regions ID:TYPE --output [--states FL,AL] [--condo-only]',
    );
    process.exit(1);
  }

  return args;
}

export async function fetchGisBatch({
  regionId,
  regionType,
  start,
  market,
  condoOnly = false,
  fetchImpl = fetch,
}) {
  const uipt = condoOnly ? '2' : '1,2,3,4,5,6,7,8';
  const params = new URLSearchParams({
    al: '1',
    market,
    num_homes: '350',
    start: String(start),
    page_number: '1',
    region_id: String(regionId),
    region_type: String(regionType),
    sf: '1,2,3,5,6,7',
    status: '9',
    uipt,
    v: '8',
    ord: 'redfin-recommended-asc',
  });

  const response = await fetchImpl(`https://www.redfin.com/stingray/api/gis?${params}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*',
      Referer: 'https://www.redfin.com/',
    },
  });

  if (!response.ok) {
    throw new Error(`Redfin GIS failed (${response.status}) for region ${regionId}`);
  }

  return JSON.parse((await response.text()).replace(/^\{\}&&/, '')).payload?.homes ?? [];
}

/**
 * Map a Redfin GIS home to the repo scrape listing shape.
 * Returns null when the home is outside allowedStates or missing identity fields.
 */
export function mapHome(home, marketArea, sourceLabel, { allowedStates = ['FL'], condoOnly = false } = {}) {
  const state = String(home.state || '').toUpperCase();
  if (!allowedStates.includes(state)) return null;

  const propertyType =
    PROPERTY_TYPE_BY_UI[home.uiPropertyType] || PROPERTY_TYPE_BY_UI[home.propertyType] || 'other';
  if (condoOnly && propertyType !== 'condo') return null;

  const listingUrl = home.url?.startsWith('http') ? home.url : `https://www.redfin.com${home.url || ''}`;
  const mlsId = home.mlsId?.value || String(home.propertyId || home.listingId || '');
  if (!home.url || !mlsId) return null;

  return {
    address: home.streetLine?.value || 'Unknown address',
    city: home.city || 'Unknown',
    zip: home.zip || home.postalCode?.value || undefined,
    asking_price: home.price?.value ?? null,
    beds: home.beds ?? null,
    baths: home.baths ?? null,
    sqft: home.sqFt?.value ?? null,
    hoa_monthly: home.hoa?.value ?? null,
    property_type: propertyType,
    year_built: home.yearBuilt?.value ?? null,
    days_on_market: home.dom?.value ?? null,
    mls_id: mlsId,
    listing_url: listingUrl,
    lat: home.latLong?.value?.latitude ?? null,
    lng: home.latLong?.value?.longitude ?? null,
    market_area: marketArea,
    source_zips: [sourceLabel],
    state,
  };
}

export async function scrapeRegion(region, marketArea, marketParam, options = {}) {
  const {
    allowedStates = ['FL'],
    condoOnly = false,
    maxStart = 15000,
    fetchImpl = fetch,
    log = console.log,
  } = options;

  const byMls = new Map();
  for (let start = 0; start <= maxStart; start += 350) {
    const batch = await fetchGisBatch({
      regionId: region.id,
      regionType: region.type,
      start,
      market: marketParam,
      condoOnly,
      fetchImpl,
    });
    if (!batch.length) break;

    let added = 0;
    for (const home of batch) {
      const listing = mapHome(home, marketArea, region.label, { allowedStates, condoOnly });
      if (!listing) continue;
      if (!byMls.has(listing.mls_id)) {
        byMls.set(listing.mls_id, listing);
        added += 1;
      }
    }

    log(`  region ${region.id} start=${start} batch=${batch.length} added=${added} total=${byMls.size}`);
    if (batch.length < 350 || added === 0) break;
  }

  return byMls;
}

export function buildPayload({ market, scrapedAt, notes, listings, states, condoOnly }) {
  const stateNote = states.join(',');
  const condoNote = condoOnly ? ' condo-only;' : '';
  return {
    source: 'redfin',
    market,
    scraped_at: scrapedAt,
    status_filter: 'active_for_sale',
    notes:
      notes ||
      `Redfin bulk scrape for ${market}; states=${stateNote};${condoNote} deduped by MLS.`,
    count: listings.length,
    listings,
  };
}

export async function scrapeMarket(args, { fetchImpl = fetch, log = console.log } = {}) {
  const scrapedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  log(`Scraping ${args.market} (states=${args.states.join(',')}${args.condoOnly ? ', condo-only' : ''})...`);

  const combined = new Map();
  for (const region of args.regions) {
    const regional = await scrapeRegion(region, args.marketArea, args.marketParam, {
      allowedStates: args.states,
      condoOnly: args.condoOnly,
      maxStart: args.maxStart,
      fetchImpl,
      log,
    });
    for (const [mlsId, listing] of regional) {
      if (combined.has(mlsId)) {
        combined.get(mlsId).source_zips = [
          ...new Set([...combined.get(mlsId).source_zips, ...listing.source_zips]),
        ];
      } else {
        combined.set(mlsId, listing);
      }
    }
  }

  const listings = Array.from(combined.values());
  return buildPayload({
    market: args.market,
    scrapedAt,
    notes: args.notes,
    listings,
    states: args.states,
    condoOnly: args.condoOnly,
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const payload = await scrapeMarket(args);
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${payload.listings.length} listings to ${args.output}`);
}

const isMain =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
