#!/usr/bin/env node

/**
 * Sync bulk market scrape JSON to Supabase market_listings table.
 *
 * Usage:
 *   node scripts/sync-market-listings-to-supabase.mjs [--file path] [--all] [--dry-run]
 *
 * Default file: data/scrapes/celebration-kissimmee-poinciana-fl-active-listings-2026-08-10.json
 *
 * Environment:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { buildValidator } from './lib/validator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_SCRAPE = join(
  REPO_ROOT,
  'data/scrapes/celebration-kissimmee-poinciana-fl-active-listings-2026-08-10.json',
);
const MARKET_TABLE = 'market_listings';

const MARKET_ID_BY_AREA = {
  celebration: 'celebration-fl',
  kissimmee: 'kissimmee-fl',
  poinciana: 'poinciana-fl',
  'panama-city-beach': 'panama-city-beach-fl',
  'fort-walton-beach': 'fort-walton-beach-fl',
  'merida-centro': 'merida-centro-mx',
  cuenca: 'cuenca-ecuador',
};

const { validate } = buildValidator();

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✓';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function listingId(listing) {
  if (listing.mls_id) {
    return slugify(`${listing.mls_id}-${listing.state || 'fl'}-${listing.zip || '00000'}`);
  }
  return slugify(`${listing.address}-${listing.city}-${listing.zip || '00000'}`);
}

function scrapeBatchFromPath(filePath) {
  const name = basename(filePath, '.json');
  return name.replace(/-active-listings.*$/, '');
}

function coerceNumber(value) {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toMarketListing(listing, scrapeBatch, scrapedAt, source) {
  const marketArea = listing.market_area || 'other';
  const row = {
    id: listingId(listing),
    address: listing.address || 'Unknown address',
    city: listing.city || 'Unknown',
    state: listing.state || 'FL',
    zip: listing.zip ?? null,
    market_area: marketArea,
    market_id: MARKET_ID_BY_AREA[marketArea] ?? null,
    asking_price: coerceNumber(listing.asking_price),
    beds: listing.beds != null && Number.isFinite(Number(listing.beds)) ? Math.trunc(Number(listing.beds)) : undefined,
    baths: coerceNumber(listing.baths),
    sqft: coerceNumber(listing.sqft),
    hoa_monthly: coerceNumber(listing.hoa_monthly),
    property_type: listing.property_type || undefined,
    year_built:
      listing.year_built != null && Number.isFinite(Number(listing.year_built))
        ? Math.trunc(Number(listing.year_built))
        : undefined,
    days_on_market:
      listing.days_on_market != null && Number.isFinite(Number(listing.days_on_market))
        ? Math.trunc(Number(listing.days_on_market))
        : undefined,
    mls_id: listing.mls_id || undefined,
    listing_url: listing.listing_url,
    lat: coerceNumber(listing.lat),
    lng: coerceNumber(listing.lng),
    source,
    scrape_batch: scrapeBatch,
    scraped_at: scrapedAt,
  };

  for (const key of Object.keys(row)) {
    if (row[key] === undefined || row[key] === null) {
      delete row[key];
    }
  }

  return row;
}

function isUsFlListing(listing) {
  return (listing.state || 'FL') === 'FL' && (listing.country == null || listing.country === 'US');
}

async function loadScrape(filePath, { usOnly = false } = {}) {
  if (!existsSync(filePath)) {
    throw new Error(`Scrape file not found: ${filePath}`);
  }

  const payload = JSON.parse(await readFile(filePath, 'utf-8'));
  const listings = payload.listings ?? [];
  const scrapeBatch = payload.scrape_batch ?? scrapeBatchFromPath(filePath);
  const scrapedAt = payload.scraped_at ?? new Date().toISOString();
  const source = payload.source ?? 'redfin';

  const byId = new Map();
  for (const listing of listings) {
    if (!listing.listing_url) continue;
    if (usOnly && !isUsFlListing(listing)) continue;
    const row = toMarketListing(listing, scrapeBatch, scrapedAt, source);
    const { valid, errors } = validate('market-listing.json', row);
    if (!valid) {
      throw new Error(`Schema validation failed for ${row.id}: ${JSON.stringify(errors)}`);
    }
    byId.set(row.id, row);
  }

  return {
    listings: Array.from(byId.values()),
    scrapeBatch,
    scrapedAt,
    source,
  };
}

function toDbRow(entry) {
  return {
    ...entry,
    zip: entry.zip ?? null,
    market_id: entry.market_id ?? null,
    asking_price: entry.asking_price ?? null,
    beds: entry.beds ?? null,
    baths: entry.baths ?? null,
    sqft: entry.sqft ?? null,
    hoa_monthly: entry.hoa_monthly ?? null,
    property_type: entry.property_type ?? null,
    year_built: entry.year_built ?? null,
    days_on_market: entry.days_on_market ?? null,
    mls_id: entry.mls_id ?? null,
    lat: entry.lat ?? null,
    lng: entry.lng ?? null,
  };
}

async function resolveScrapeFiles() {
  const syncAll = process.argv.includes('--all');
  const fileArgIndex = process.argv.indexOf('--file');

  if (fileArgIndex >= 0 && process.argv[fileArgIndex + 1]) {
    return [join(REPO_ROOT, process.argv[fileArgIndex + 1])];
  }

  if (syncAll) {
    const scrapesDir = join(REPO_ROOT, 'data/scrapes');
    const names = await readdir(scrapesDir);
    return names
      .filter((name) => name.endsWith('.json') && name.includes('-active-listings'))
      .sort()
      .map((name) => join(scrapesDir, name));
  }

  return [DEFAULT_SCRAPE];
}

async function syncFile(filePath, supabase, { dryRun = false, usOnly = false } = {}) {
  log(`Reading ${filePath}`);

  const { listings, scrapeBatch, scrapedAt } = await loadScrape(filePath, { usOnly });
  log(
    `Loaded ${listings.length} listings (batch: ${scrapeBatch}, scraped: ${scrapedAt}${usOnly ? ', US-FL only' : ''})`,
  );

  const byArea = listings.reduce((acc, row) => {
    acc[row.market_area] = (acc[row.market_area] || 0) + 1;
    return acc;
  }, {});
  log(`By market area: ${JSON.stringify(byArea)}`);

  if (listings.length === 0) {
    log('No listings to sync for this file');
    return 0;
  }

  if (dryRun) {
    for (const entry of listings.slice(0, 5)) {
      log(
        `  ${entry.id}: ${entry.address}, ${entry.city} — $${entry.asking_price ?? 'n/a'} (${entry.market_area})`,
      );
    }
    if (listings.length > 5) {
      log(`  ... and ${listings.length - 5} more`);
    }
    return listings.length;
  }

  const rows = listings.map(toDbRow);
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: upsertError } = await supabase
      .from(MARKET_TABLE)
      .upsert(chunk, { onConflict: 'id' });

    if (upsertError) {
      throw new Error(`Upsert failed at offset ${i}: ${upsertError.message}`);
    }
    log(`Upserted ${Math.min(i + chunkSize, rows.length)} / ${rows.length}`);
  }

  log(`Sync complete for ${basename(filePath)}: ${rows.length} rows upserted`);
  return rows.length;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const usOnly = process.argv.includes('--us-only');
  const filePaths = await resolveScrapeFiles();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    log('SUPABASE_URL environment variable is required', 'error');
    process.exit(1);
  }

  if (!supabaseKey) {
    log('SUPABASE_SERVICE_ROLE_KEY environment variable is required', 'error');
    process.exit(1);
  }

  log(`Starting market listings sync ${dryRun ? '(DRY RUN)' : ''}`);

  const supabase = dryRun
    ? null
    : createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

  let totalRows = 0;
  for (const filePath of filePaths) {
    totalRows += await syncFile(filePath, supabase, { dryRun, usOnly });
  }

  log(`Finished: ${totalRows} rows across ${filePaths.length} file(s)`);
}

main().catch((error) => {
  log(`Unexpected error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
