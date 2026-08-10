#!/usr/bin/env node

/**
 * Sync property data from Git JSON files to Supabase
 *
 * Usage:
 *   node scripts/sync-properties-to-supabase.mjs              # Sync all eligible properties
 *   node scripts/sync-properties-to-supabase.mjs --property 123-main-st  # Sync specific property
 *   node scripts/sync-properties-to-supabase.mjs --dry-run    # Preview without writing
 *
 * Environment:
 *   SUPABASE_URL              - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for writes
 */

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PROPERTIES_DIR = join(REPO_ROOT, 'data', 'properties');

// Workflow states eligible for sync
const SYNC_ELIGIBLE_STATES = ['RANKED', 'PUBLISHED'];
const SYNC_ELIGIBLE_AUDIT_RESULTS = ['PASS'];

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    property: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--property':
        options.property = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Sync property data from Git JSON to Supabase

Usage:
  node scripts/sync-properties-to-supabase.mjs [options]

Options:
  --dry-run              Preview changes without writing to Supabase
  --property <id>        Sync only the specified property
  --help, -h             Show this help message

Environment Variables:
  SUPABASE_URL           Supabase project URL (required)
  SUPABASE_SERVICE_ROLE_KEY  Service role key for writes (required)

Examples:
  node scripts/sync-properties-to-supabase.mjs
  node scripts/sync-properties-to-supabase.mjs --dry-run
  node scripts/sync-properties-to-supabase.mjs --property 123-main-st-tampa-fl
`);
}

/**
 * Create Supabase client
 */
function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Read JSON file safely
 */
async function readJsonFile(path) {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get all property directories
 */
async function getPropertyDirs() {
  const entries = await readdir(PROPERTIES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name);
}

/**
 * Load property data from Git files
 */
async function loadProperty(propertyId) {
  const dir = join(PROPERTIES_DIR, propertyId);

  const meta = await readJsonFile(join(dir, 'meta.json'));
  if (!meta) {
    console.warn(`  Warning: No meta.json found for ${propertyId}`);
    return null;
  }

  const evidence = await readJsonFile(join(dir, 'evidence.json'));
  const underwriting = await readJsonFile(join(dir, 'underwriting.json'));
  const audit = await readJsonFile(join(dir, 'audit.json'));

  return { meta, evidence, underwriting, audit };
}

/**
 * Check if property is eligible for sync
 */
function isEligibleForSync(property) {
  const { meta, audit } = property;

  // Check workflow state
  if (SYNC_ELIGIBLE_STATES.includes(meta.workflow_state)) {
    return true;
  }

  // Check audit result
  if (audit && SYNC_ELIGIBLE_AUDIT_RESULTS.includes(audit.result)) {
    return true;
  }

  return false;
}

/**
 * Transform property data to Supabase row format
 */
function transformToRow(property) {
  const { meta, evidence, underwriting, audit } = property;

  // Determine final status
  const status = audit?.final_status || underwriting?.proposed_status || 'REJECTED';

  // Determine confidence (from underwriting input_summary or default)
  const confidence = determineConfidence(evidence);

  // Collect sources
  const sources = [];
  if (meta.listing_url) {
    sources.push({ label: 'Listing', url: meta.listing_url });
  }

  return {
    id: meta.id,
    address: meta.address,
    location: meta.location || '',
    listing_url: meta.listing_url,
    purchase_price: evidence?.purchase_price || createUnknownField(),
    monthly_rent: evidence?.monthly_rent || createUnknownField(),
    hoa: evidence?.hoa_monthly || createUnknownField(),
    assessment: evidence?.special_assessments || createUnknownField(),
    annual_gross_rent: underwriting?.annual_gross_rent || 0,
    annual_operating_expenses: underwriting?.annual_operating_expenses || 0,
    noi: underwriting?.noi || 0,
    cap_rate: underwriting?.cap_rate || 0,
    confidence,
    status,
    workflow_state: meta.workflow_state,
    sources,
    ranked_at: meta.workflow_state === 'RANKED' || meta.workflow_state === 'PUBLISHED'
      ? new Date().toISOString()
      : null,
  };
}

/**
 * Create an UNKNOWN field value
 */
function createUnknownField() {
  return {
    value: null,
    status: 'UNKNOWN',
    confidence: 'LOW',
  };
}

/**
 * Determine overall confidence from evidence fields
 */
function determineConfidence(evidence) {
  if (!evidence) return 'LOW';

  const fields = [
    evidence.purchase_price,
    evidence.monthly_rent,
    evidence.hoa_monthly,
    evidence.special_assessments,
  ];

  const validFields = fields.filter((f) => f && f.confidence);
  if (validFields.length === 0) return 'LOW';

  const confidenceLevels = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const total = validFields.reduce((sum, f) => sum + (confidenceLevels[f.confidence] || 1), 0);
  const avg = total / validFields.length;

  if (avg >= 2.5) return 'HIGH';
  if (avg >= 1.5) return 'MEDIUM';
  return 'LOW';
}

/**
 * Transform property details for property_details table
 */
function transformToDetails(property) {
  const { meta, evidence, underwriting, audit } = property;

  return {
    property_id: meta.id,
    evidence,
    underwriting,
    audit,
  };
}

/**
 * Sync a single property to Supabase
 */
async function syncProperty(supabase, propertyId, dryRun) {
  console.log(`Processing ${propertyId}...`);

  const property = await loadProperty(propertyId);
  if (!property) {
    console.log(`  Skipped: Could not load property data`);
    return { synced: false, reason: 'load_error' };
  }

  if (!isEligibleForSync(property)) {
    console.log(`  Skipped: Not eligible (state: ${property.meta.workflow_state})`);
    return { synced: false, reason: 'not_eligible' };
  }

  const row = transformToRow(property);
  const details = transformToDetails(property);

  if (dryRun) {
    console.log(`  [DRY RUN] Would upsert:`);
    console.log(`    - Status: ${row.status}`);
    console.log(`    - Cap Rate: ${(row.cap_rate * 100).toFixed(2)}%`);
    console.log(`    - Confidence: ${row.confidence}`);
    return { synced: true, dryRun: true };
  }

  // Upsert to properties table
  const { error: propError } = await supabase
    .from('properties')
    .upsert(row, { onConflict: 'id' });

  if (propError) {
    console.error(`  Error syncing property: ${propError.message}`);
    return { synced: false, reason: 'db_error', error: propError.message };
  }

  // Upsert to property_details table
  const { error: detailsError } = await supabase
    .from('property_details')
    .upsert(details, { onConflict: 'property_id' });

  if (detailsError) {
    // Non-fatal - details table may not exist
    console.warn(`  Warning: Could not sync details: ${detailsError.message}`);
  }

  console.log(`  Synced: ${row.status} (${(row.cap_rate * 100).toFixed(2)}% cap rate)`);
  return { synced: true };
}

/**
 * Main sync function
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log('RealEstateHunter Property Sync');
  console.log('==============================');

  if (options.dryRun) {
    console.log('Mode: DRY RUN (no changes will be made)\n');
  }

  let supabase;
  if (!options.dryRun) {
    try {
      supabase = createSupabaseClient();
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  }

  // Get properties to sync
  let propertyIds;
  if (options.property) {
    propertyIds = [options.property];
  } else {
    propertyIds = await getPropertyDirs();
  }

  console.log(`Found ${propertyIds.length} property directories\n`);

  // Sync each property
  const results = {
    synced: 0,
    skipped: 0,
    errors: 0,
  };

  for (const propertyId of propertyIds) {
    const result = await syncProperty(supabase, propertyId, options.dryRun);
    if (result.synced) {
      results.synced++;
    } else if (result.reason === 'db_error') {
      results.errors++;
    } else {
      results.skipped++;
    }
  }

  // Print summary
  console.log('\nSync Summary');
  console.log('------------');
  console.log(`Synced:  ${results.synced}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Errors:  ${results.errors}`);

  if (results.errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
