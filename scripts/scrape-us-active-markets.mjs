#!/usr/bin/env node
/**
 * TASK-015: Bulk-scrape the five US ACTIVE markets with zero Scout coverage.
 *
 * Markets (Redfin city region_type=6):
 *   tampa-fl         region_id=18142  (https://www.redfin.com/city/18142/FL/Tampa)
 *   jacksonville-fl  region_id=8907   (https://www.redfin.com/city/8907/FL/Jacksonville)
 *   birmingham-al    region_id=1823   (https://www.redfin.com/city/1823/AL/Birmingham)
 *   memphis-tn       region_id=12260  (https://www.redfin.com/city/12260/TN/Memphis)
 *   cleveland-oh     region_id=4145   (https://www.redfin.com/city/4145/OH/Cleveland)
 *
 * Usage:
 *   node scripts/scrape-us-active-markets.mjs
 *   node scripts/scrape-us-active-markets.mjs --market tampa-fl
 *   node scripts/scrape-us-active-markets.mjs --phase a          # Tampa + Jacksonville
 *   node scripts/scrape-us-active-markets.mjs --condo-only
 *   node scripts/scrape-us-active-markets.mjs --date 2026-08-16
 *
 * Does not scrape WATCH markets (FWB, St Augustine) or international.
 */

import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRAPER = join(REPO_ROOT, 'scripts/scrape-redfin-market.mjs');
const SMOKE_MIN = 100;

/**
 * Redfin GIS region IDs for US ACTIVE markets lacking bulk scrapes.
 * region type 6 = city. Documented also in data/scrapes/README.md.
 */
export const US_ACTIVE_MARKETS = [
  {
    id: 'tampa-fl',
    marketArea: 'tampa',
    state: 'FL',
    marketParam: 'tampa',
    regions: '18142:6',
    phase: 'a',
    priority: 'P0',
    notes:
      'Redfin bulk scrape Tampa FL city region_id=18142 (type=6); multi-state capable; deduped by MLS.',
  },
  {
    id: 'jacksonville-fl',
    marketArea: 'jacksonville',
    state: 'FL',
    marketParam: 'jacksonville',
    regions: '8907:6',
    phase: 'a',
    priority: 'P0',
    notes:
      'Redfin bulk scrape Jacksonville FL city region_id=8907 (type=6); multi-state capable; deduped by MLS.',
  },
  {
    id: 'birmingham-al',
    marketArea: 'birmingham',
    state: 'AL',
    marketParam: 'birmingham',
    regions: '1823:6',
    phase: 'b',
    priority: 'P1',
    notes:
      'Redfin bulk scrape Birmingham AL city region_id=1823 (type=6); multi-state capable; deduped by MLS.',
  },
  {
    id: 'memphis-tn',
    marketArea: 'memphis',
    state: 'TN',
    marketParam: 'memphis',
    regions: '12260:6',
    phase: 'b',
    priority: 'P1',
    notes:
      'Redfin bulk scrape Memphis TN city region_id=12260 (type=6); multi-state capable; deduped by MLS.',
  },
  {
    id: 'cleveland-oh',
    marketArea: 'cleveland',
    state: 'OH',
    marketParam: 'cleveland',
    regions: '4145:6',
    phase: 'b',
    priority: 'P1',
    notes:
      'Redfin bulk scrape Cleveland OH city region_id=4145 (type=6); multi-state capable; deduped by MLS.',
  },
];

function parseCli(argv) {
  const opts = {
    market: null,
    phase: null,
    condoOnly: false,
    date: new Date().toISOString().slice(0, 10),
  };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--market' && value) {
      opts.market = value;
      i += 1;
    } else if (flag === '--phase' && value) {
      opts.phase = value.toLowerCase();
      i += 1;
    } else if (flag === '--date' && value) {
      opts.date = value;
      i += 1;
    } else if (flag === '--condo-only') {
      opts.condoOnly = true;
    }
  }
  return opts;
}

function selectMarkets(opts) {
  let selected = US_ACTIVE_MARKETS;
  if (opts.market) {
    selected = selected.filter((m) => m.id === opts.market || m.marketArea === opts.market);
  }
  if (opts.phase) {
    selected = selected.filter((m) => m.phase === opts.phase);
  }
  return selected;
}

function runScrape(market, { date, condoOnly }) {
  const output = `data/scrapes/${market.id}-active-listings-${date}.json`;
  const args = [
    SCRAPER,
    '--market',
    market.id,
    '--market-area',
    market.marketArea,
    '--state',
    market.state,
    '--market-param',
    market.marketParam,
    '--regions',
    market.regions,
    '--output',
    output,
    '--notes',
    market.notes,
  ];
  if (condoOnly) args.push('--condo-only');

  return new Promise((resolve, reject) => {
    console.log(`\n=== ${market.id} (${market.priority}, phase ${market.phase}) ===`);
    const child = spawn(process.execPath, args, { stdio: 'inherit', cwd: REPO_ROOT });
    child.on('close', (code) => {
      if (code === 0) resolve({ id: market.id, output });
      else reject(new Error(`${market.id} failed with exit ${code}`));
    });
  });
}

async function smokeCheck(result) {
  const fullPath = join(REPO_ROOT, result.output);
  const payload = JSON.parse(await readFile(fullPath, 'utf-8'));
  const count = payload.count ?? payload.listings?.length ?? 0;
  if (count < SMOKE_MIN) {
    console.warn(
      `  DRY-MARKET NOTE: ${result.id} has only ${count} listings (<${SMOKE_MIN} smoke threshold). Documented for Scout.`,
    );
    return { ...result, count, dryMarket: true };
  }
  console.log(`  Smoke OK: ${result.id} count=${count}`);
  return { ...result, count, dryMarket: false };
}

async function main() {
  const opts = parseCli(process.argv);
  const selected = selectMarkets(opts);

  if (!selected.length) {
    console.error(
      `No markets matched. Known: ${US_ACTIVE_MARKETS.map((m) => m.id).join(', ')}`,
    );
    process.exit(1);
  }

  console.log(
    `US ACTIVE scrape: ${selected.map((m) => m.id).join(', ')}` +
      (opts.condoOnly ? ' [condo-only]' : ''),
  );

  const results = [];
  for (const market of selected) {
    const result = await runScrape(market, opts);
    results.push(await smokeCheck(result));
  }

  console.log('\nUS ACTIVE scrape complete:');
  for (const r of results) {
    const flag = r.dryMarket ? ' (dry-market)' : '';
    console.log(`  ${r.id}: ${r.count} -> ${r.output}${flag}`);
  }
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
