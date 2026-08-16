#!/usr/bin/env node
/**
 * Bulk-scrape active for-sale listings from Redfin GIS for one US market.
 *
 * Usage:
 *   node scripts/scrape-redfin-market.mjs \
 *     --market tampa-fl \
 *     --market-area tampa \
 *     --state FL \
 *     --market-param tampa \
 *     --regions 18142:6 \
 *     --output data/scrapes/tampa-fl-active-listings-2026-08-16.json
 *
 * Optional: --condo-only  (Scout-focused condo pulls; sets uipt=2)
 * Optional: --state FL,AL (comma-separated allowed states; default FL)
 *
 * Region IDs: see data/scrapes/README.md
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  parseArgs,
  buildGisParams,
  mapHome,
  mergeListingMaps,
  buildScrapePayload,
} from './lib/redfin-market.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function fetchGisBatch({ regionId, regionType, start, market, condoOnly }) {
  const params = buildGisParams({ regionId, regionType, start, market, condoOnly });
  const response = await fetch(`https://www.redfin.com/stingray/api/gis?${params}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Redfin GIS failed (${response.status}) for region ${regionId}`);
  }
  const text = await response.text();
  return JSON.parse(text.replace(/^\{\}&&/, '')).payload?.homes ?? [];
}

async function scrapeRegion(region, { marketArea, marketParam, allowedStates, condoOnly }) {
  const byMls = new Map();
  for (let start = 0; start <= 15000; start += 350) {
    const batch = await fetchGisBatch({
      regionId: region.id,
      regionType: region.type,
      start,
      market: marketParam,
      condoOnly,
    });
    if (!batch.length) break;
    let added = 0;
    for (const home of batch) {
      const listing = mapHome(home, {
        marketArea,
        sourceLabel: region.label,
        allowedStates,
        condoOnly,
      });
      if (!listing?.listing_url || !listing.mls_id) continue;
      if (!byMls.has(listing.mls_id)) {
        byMls.set(listing.mls_id, listing);
        added += 1;
      }
    }
    console.log(
      `  region ${region.id} start=${start} batch=${batch.length} added=${added} total=${byMls.size}`,
    );
    if (batch.length < 350 || added === 0) break;
  }
  return byMls;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const outputPath = isAbsolute(args.output) ? args.output : join(REPO_ROOT, args.output);
  const scrapedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  console.log(
    `Scraping ${args.market} (states=${args.states.join(',')}${args.condoOnly ? ', condo-only' : ''})...`,
  );

  const combined = new Map();
  for (const region of args.regions) {
    const regional = await scrapeRegion(region, {
      marketArea: args.marketArea,
      marketParam: args.marketParam,
      allowedStates: args.states,
      condoOnly: args.condoOnly,
    });
    mergeListingMaps(combined, regional);
  }

  const listings = Array.from(combined.values());
  const payload = buildScrapePayload({
    market: args.market,
    scrapedAt,
    notes: args.notes,
    listings,
    condoOnly: args.condoOnly,
    states: args.states,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${listings.length} listings to ${outputPath}`);
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { fetchGisBatch, scrapeRegion, main };
