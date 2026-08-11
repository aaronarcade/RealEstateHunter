#!/usr/bin/env node

/**
 * Backfill data/reviewed/listings.ndjson from archived scout meta.json files
 * and scout screening logs.
 *
 * Usage:
 *   node scripts/backfill-reviewed-from-meta.mjs [--dry-run]
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  metaToReviewedListing,
  screeningRejectToReviewedListing,
  readReviewedListings,
  writeReviewedListings,
} from './lib/reviewed-listing.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PROPERTIES_DIR = join(REPO_ROOT, 'data/properties');
const SEARCH_CRITERIA = join(REPO_ROOT, 'data/search-criteria.json');
const SCREENING_LOG = join(REPO_ROOT, 'data/scout/task-004-screening-log.json');
const REVIEWED_FILE = join(REPO_ROOT, 'data/reviewed/listings.ndjson');

function log(message) {
  console.log(`[backfill] ${message}`);
}

function inferMarketIdFromAddress(address) {
  const lower = address.toLowerCase();
  if (lower.includes('panama city beach')) return 'panama-city-beach-fl';
  if (lower.includes('celebration')) return 'celebration-fl';
  if (lower.includes('cuenca')) return 'cuenca-ecuador';
  if (lower.includes('manta')) return 'manta-ec';
  if (lower.includes('quito')) return 'quito-ec';
  return undefined;
}

async function loadMarkets() {
  const criteria = JSON.parse(await readFile(SEARCH_CRITERIA, 'utf-8'));
  return criteria.markets ?? [];
}

async function loadArchivedMeta() {
  const entries = await readdir(PROPERTIES_DIR, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const metaPath = join(PROPERTIES_DIR, entry.name, 'meta.json');
    if (!existsSync(metaPath)) continue;

    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
    if (meta.workflow_state !== 'ARCHIVED') continue;
    if (meta.scout_decision !== 'REJECT') continue;
    results.push(meta);
  }

  return results;
}

async function loadScreeningRejects() {
  if (!existsSync(SCREENING_LOG)) {
    return [];
  }

  const logData = JSON.parse(await readFile(SCREENING_LOG, 'utf-8'));
  return logData.rejects ?? [];
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const markets = await loadMarkets();
  const existing = new Map(readReviewedListings(REVIEWED_FILE).map((item) => [item.id, item]));

  let added = 0;

  for (const meta of await loadArchivedMeta()) {
    const listing = metaToReviewedListing(meta, { markets });
    if (!existing.has(listing.id)) {
      existing.set(listing.id, listing);
      added++;
    }
  }

  for (const reject of await loadScreeningRejects()) {
    const listing = screeningRejectToReviewedListing(
      {
        ...reject,
        market_id: reject.market_id ?? inferMarketIdFromAddress(reject.address),
      },
      {
        markets,
        reviewed_at: reject.reviewed_at ?? '2026-08-10T04:00:00Z',
      },
    );

    if (!existing.has(listing.id)) {
      existing.set(listing.id, listing);
      added++;
    }
  }

  const listings = Array.from(existing.values()).sort((a, b) => a.id.localeCompare(b.id));
  log(`Prepared ${listings.length} reviewed listings (${added} newly added)`);

  if (dryRun) {
    for (const listing of listings.slice(0, 5)) {
      log(`  ${listing.id} — ${listing.city}, ${listing.country}`);
    }
    if (listings.length > 5) {
      log(`  ... and ${listings.length - 5} more`);
    }
    return;
  }

  writeReviewedListings(REVIEWED_FILE, listings);
  log(`Wrote ${listings.length} entries to ${REVIEWED_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
