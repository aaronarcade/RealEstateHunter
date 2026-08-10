#!/usr/bin/env node

/**
 * Sync Git property artifacts to Supabase
 *
 * This script scans data/properties/ for properties with workflow_state
 * RANKED, PUBLISHED, or audit PASS, then upserts them to Supabase.
 *
 * Usage:
 *   node scripts/sync-properties-to-supabase.mjs [--dry-run]
 *
 * Environment:
 *   SUPABASE_URL - Supabase project URL (required)
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for writes (required)
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PROPERTIES_DIR = join(REPO_ROOT, 'data/properties');
const PROPERTIES_TABLE = 'properties';

const SYNCABLE_STATES = new Set(['RANKED', 'PUBLISHED']);

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✓';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function loadPropertyFiles(propertyDir) {
  const files = {};
  const fileNames = ['meta.json', 'evidence.json', 'underwriting.json', 'audit.json'];

  for (const fileName of fileNames) {
    const filePath = join(propertyDir, fileName);
    try {
      const content = await readFile(filePath, 'utf-8');
      files[fileName.replace('.json', '')] = JSON.parse(content);
    } catch {
      // File doesn't exist or isn't valid JSON
    }
  }

  return files;
}

function shouldSync(files) {
  const { meta, audit } = files;

  if (!meta) return false;

  // Sync if workflow_state is RANKED or PUBLISHED
  if (meta.workflow_state && SYNCABLE_STATES.has(meta.workflow_state)) {
    return true;
  }

  // Also sync if audit result is PASS
  if (audit?.result === 'PASS') {
    return true;
  }

  return false;
}

function deriveConfidence(evidence) {
  if (!evidence) return 'LOW';

  const fields = ['purchase_price', 'monthly_rent', 'hoa_monthly'];
  const confidenceLevels = ['HIGH', 'MEDIUM', 'LOW'];
  let minIndex = 0;

  for (const field of fields) {
    const confidence = evidence[field]?.confidence;
    if (confidence) {
      const index = confidenceLevels.indexOf(confidence);
      if (index > minIndex) minIndex = index;
    }
  }

  return confidenceLevels[minIndex];
}

function deriveSources(evidence) {
  if (!evidence) return [];

  const sources = [];
  const seen = new Set();
  const fields = [
    { key: 'purchase_price', label: 'Purchase Price' },
    { key: 'monthly_rent', label: 'Monthly Rent' },
    { key: 'hoa_monthly', label: 'HOA' },
  ];

  for (const { key, label } of fields) {
    const source = evidence[key]?.source;
    if (source && !seen.has(source)) {
      seen.add(source);
      const isUrl = source.startsWith('http://') || source.startsWith('https://');
      sources.push({
        label: isUrl ? label : source,
        url: isUrl ? source : undefined,
      });
    }
  }

  return sources;
}

function buildPropertyRow(files) {
  const { meta, evidence, underwriting, audit } = files;

  if (!meta || !evidence || !underwriting) {
    return null;
  }

  const status = audit?.final_status || underwriting.proposed_status;
  if (!status) return null;

  return {
    id: meta.id,
    address: meta.address,
    location: meta.location || meta.address.split(',').slice(-2).join(',').trim(),
    listing_url: meta.listing_url,
    purchase_price: evidence.purchase_price,
    monthly_rent: evidence.monthly_rent,
    annual_gross_rent: underwriting.annual_gross_rent,
    annual_operating_expenses: underwriting.annual_operating_expenses,
    noi: underwriting.noi,
    cap_rate: underwriting.cap_rate,
    hoa: evidence.hoa_monthly,
    assessment: evidence.special_assessments,
    confidence: deriveConfidence(evidence),
    status,
    workflow_state: meta.workflow_state,
    sources: deriveSources(evidence),
    ranked_at: new Date().toISOString(),
  };
}

async function getPropertyDirs() {
  const entries = await readdir(PROPERTIES_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => ({
      name: entry.name,
      path: join(PROPERTIES_DIR, entry.name),
    }));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Validate environment
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

  log(`Starting sync ${dryRun ? '(DRY RUN)' : ''}`);
  log(`Supabase URL: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Get all property directories
  const propertyDirs = await getPropertyDirs();
  log(`Found ${propertyDirs.length} property directories`);

  const toSync = [];
  const skipped = [];

  // Load and filter properties
  for (const { name, path } of propertyDirs) {
    const files = await loadPropertyFiles(path);

    if (!shouldSync(files)) {
      skipped.push({ id: name, reason: 'Not in syncable state' });
      continue;
    }

    const row = buildPropertyRow(files);
    if (!row) {
      skipped.push({ id: name, reason: 'Missing required files or fields' });
      continue;
    }

    toSync.push(row);
  }

  log(`Properties to sync: ${toSync.length}`);
  log(`Properties skipped: ${skipped.length}`);

  if (skipped.length > 0) {
    for (const { id, reason } of skipped) {
      log(`  Skipped ${id}: ${reason}`, 'warn');
    }
  }

  if (toSync.length === 0) {
    log('No properties to sync');
    process.exit(0);
  }

  // Sync to Supabase
  if (dryRun) {
    log('Dry run - would sync:');
    for (const row of toSync) {
      log(`  ${row.id}: ${row.status} (cap_rate: ${(row.cap_rate * 100).toFixed(1)}%)`);
    }
    process.exit(0);
  }

  // Check existing records
  const ids = toSync.map(r => r.id);
  const { data: existing, error: selectError } = await supabase
    .from(PROPERTIES_TABLE)
    .select('id')
    .in('id', ids);

  if (selectError) {
    log(`Failed to check existing records: ${selectError.message}`, 'error');
    process.exit(1);
  }

  const existingIds = new Set((existing || []).map(r => r.id));

  // Upsert all properties
  const { error: upsertError } = await supabase
    .from(PROPERTIES_TABLE)
    .upsert(toSync, { onConflict: 'id' });

  if (upsertError) {
    log(`Upsert failed: ${upsertError.message}`, 'error');
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;

  for (const row of toSync) {
    if (existingIds.has(row.id)) {
      updated++;
      log(`Updated ${row.id}`);
    } else {
      inserted++;
      log(`Inserted ${row.id}`);
    }
  }

  log(`Sync complete: ${inserted} inserted, ${updated} updated`);
  process.exit(0);
}

main().catch(err => {
  log(`Unexpected error: ${err.message}`, 'error');
  console.error(err);
  process.exit(1);
});
