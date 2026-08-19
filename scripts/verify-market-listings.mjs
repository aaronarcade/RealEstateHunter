#!/usr/bin/env node

/**
 * Print market_listings row counts from Supabase (by market_area and total).
 *
 * Usage:
 *   node scripts/verify-market-listings.mjs
 *
 * Environment:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY for read-only)
 */

import { createClient } from '@supabase/supabase-js';

const MARKET_AREAS = [
  'celebration',
  'kissimmee',
  'poinciana',
  'panama-city-beach',
  'fort-walton-beach',
  'cuenca',
  'merida-centro',
  'st-augustine',
  'colmar',
  'kyoto',
  'manta',
  'lisbon',
  'porto',
  'medellin',
  'chiang-mai',
  'tbilisi',
  'budapest',
  'bucharest',
  'panama-city-pa',
  'manila',
  'bali',
  'krakow',
  'playa-del-carmen',
  'tampa',
  'jacksonville',
  'birmingham',
  'memphis',
  'cleveland',
  'other',
];

function projectRef(url) {
  return url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? 'unknown';
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are required');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Supabase project: ${projectRef(url)}`);
  console.log(`Table: public.market_listings\n`);

  const { count: total, error: totalError } = await supabase
    .from('market_listings')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    console.error(`Count failed: ${totalError.message}`);
    process.exit(1);
  }

  console.log(`Total rows: ${total}`);

  for (const area of MARKET_AREAS) {
    const { count, error } = await supabase
      .from('market_listings')
      .select('*', { count: 'exact', head: true })
      .eq('market_area', area);

    if (error) {
      console.error(`  ${area}: error — ${error.message}`);
      continue;
    }

    if (count > 0) {
      console.log(`  ${area}: ${count}`);
    }
  }

  const batchCounts = {};
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data: batchRows, error: batchError } = await supabase
      .from('market_listings')
      .select('scrape_batch')
      .range(offset, offset + pageSize - 1);

    if (batchError) {
      console.error(`\nBatch scan failed: ${batchError.message}`);
      break;
    }

    const rows = batchRows ?? [];
    for (const row of rows) {
      batchCounts[row.scrape_batch] = (batchCounts[row.scrape_batch] || 0) + 1;
    }

    if (rows.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  if (Object.keys(batchCounts).length > 0) {
    console.log('\nBy scrape_batch:');
    for (const [batch, count] of Object.entries(batchCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${batch}: ${count}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
