#!/usr/bin/env node

/**
 * Sync Git reviewed listings (NDJSON) to Supabase reviewed_listings table.
 *
 * Usage:
 *   node scripts/sync-reviewed-to-supabase.mjs [--dry-run]
 *
 * Environment:
 *   SUPABASE_URL - Supabase project URL (required)
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for writes (required)
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { buildValidator } from './lib/validator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REVIEWED_FILE = join(REPO_ROOT, 'data/reviewed/listings.ndjson');
const REVIEWED_TABLE = 'reviewed_listings';

const { validate } = buildValidator();

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✓';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function loadReviewedListings() {
  if (!existsSync(REVIEWED_FILE)) {
    return [];
  }

  const content = await readFile(REVIEWED_FILE, 'utf-8');
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  const byId = new Map();

  for (const [index, line] of lines.entries()) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
    }

    const { valid, errors } = validate('reviewed-listing.json', entry);
    if (!valid) {
      throw new Error(
        `Schema validation failed for ${entry.id ?? `line ${index + 1}`}: ${JSON.stringify(errors)}`,
      );
    }

    byId.set(entry.id, entry);
  }

  return Array.from(byId.values());
}

function toRow(entry) {
  return {
    id: entry.id,
    address: entry.address,
    city: entry.city,
    country: entry.country,
    region: entry.region ?? null,
    listing_url: entry.listing_url,
    asking_price: entry.asking_price,
    estimated_cap_rate: entry.estimated_cap_rate ?? null,
    rough_gross_yield: entry.rough_gross_yield ?? null,
    estimated_monthly_rent: entry.estimated_monthly_rent ?? null,
    hoa_monthly: entry.hoa_monthly ?? null,
    sqft: entry.sqft ?? null,
    beds: entry.beds ?? null,
    baths: entry.baths ?? null,
    property_type: entry.property_type ?? null,
    market_id: entry.market_id ?? null,
    scout_decision: entry.scout_decision,
    notes: entry.notes ?? null,
    reviewed_at: entry.reviewed_at,
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

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

  log(`Starting reviewed listings sync ${dryRun ? '(DRY RUN)' : ''}`);

  const listings = await loadReviewedListings();
  log(`Loaded ${listings.length} reviewed listings from ${REVIEWED_FILE}`);

  if (listings.length === 0) {
    log('No reviewed listings to sync');
    process.exit(0);
  }

  if (dryRun) {
    for (const entry of listings) {
      const cap = entry.estimated_cap_rate
        ? `${(entry.estimated_cap_rate * 100).toFixed(1)}%`
        : 'n/a';
      log(`  ${entry.id}: ${entry.city}, ${entry.country} — est cap ${cap}`);
    }
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const rows = listings.map(toRow);
  const ids = rows.map((row) => row.id);

  const { data: existing, error: selectError } = await supabase
    .from(REVIEWED_TABLE)
    .select('id')
    .in('id', ids);

  if (selectError) {
    log(`Failed to check existing records: ${selectError.message}`, 'error');
    process.exit(1);
  }

  const existingIds = new Set((existing || []).map((row) => row.id));

  const { error: upsertError } = await supabase
    .from(REVIEWED_TABLE)
    .upsert(rows, { onConflict: 'id' });

  if (upsertError) {
    log(`Upsert failed: ${upsertError.message}`, 'error');
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    if (existingIds.has(row.id)) {
      updated++;
    } else {
      inserted++;
    }
  }

  log(`Sync complete: ${inserted} inserted, ${updated} updated`);
}

main().catch((error) => {
  log(`Unexpected error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
