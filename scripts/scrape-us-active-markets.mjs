#!/usr/bin/env node

/**
 * Bulk-scrape the five US ACTIVE markets with zero Scout coverage.
 *
 * Markets and Redfin city region IDs (region_type=6):
 *   tampa-fl          Tampa, FL         region_id=18142  market_param=florida
 *   jacksonville-fl   Jacksonville, FL  region_id=8907   market_param=florida
 *   birmingham-al     Birmingham, AL    region_id=1823   market_param=alabama
 *   memphis-tn        Memphis, TN       region_id=12260  market_param=tennessee
 *   cleveland-oh      Cleveland, OH     region_id=4145   market_param=ohio
 *
 * Reference (already scraped):
 *   panama-city-beach-fl  region_id=14163
 *   fort-walton-beach-fl  region_id=6298 (+ Destin 4501)
 *   st-augustine-fl       region_id=16053
 *
 * Usage:
 *   node scripts/scrape-us-active-markets.mjs
 *   node scripts/scrape-us-active-markets.mjs --market tampa-fl
 *   node scripts/scrape-us-active-markets.mjs --condo-only
 *   node scripts/scrape-us-active-markets.mjs --date 2026-08-13
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRAPER = join(REPO_ROOT, 'scripts/scrape-redfin-market.mjs');

/** @typedef {{ id: string, city: string, state: string, marketArea: string, marketParam: string, regions: string, priority: string }} UsActiveMarket */

/** @type {UsActiveMarket[]} */
export const US_ACTIVE_MARKETS = [
  {
    id: 'tampa-fl',
    city: 'Tampa',
    state: 'FL',
    marketArea: 'tampa',
    marketParam: 'florida',
    regions: '18142:6',
    priority: 'P0',
  },
  {
    id: 'jacksonville-fl',
    city: 'Jacksonville',
    state: 'FL',
    marketArea: 'jacksonville',
    marketParam: 'florida',
    regions: '8907:6',
    priority: 'P0',
  },
  {
    id: 'birmingham-al',
    city: 'Birmingham',
    state: 'AL',
    marketArea: 'birmingham',
    marketParam: 'alabama',
    regions: '1823:6',
    priority: 'P1',
  },
  {
    id: 'memphis-tn',
    city: 'Memphis',
    state: 'TN',
    marketArea: 'memphis',
    marketParam: 'tennessee',
    regions: '12260:6',
    priority: 'P1',
  },
  {
    id: 'cleveland-oh',
    city: 'Cleveland',
    state: 'OH',
    marketArea: 'cleveland',
    marketParam: 'ohio',
    regions: '4145:6',
    priority: 'P1',
  },
];

function parseArgs(argv) {
  const args = {
    market: null,
    condoOnly: false,
    date: new Date().toISOString().slice(0, 10),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--market' && value) {
      args.market = value;
      i += 1;
    } else if (flag === '--date' && value) {
      args.date = value;
      i += 1;
    } else if (flag === '--condo-only') {
      args.condoOnly = true;
    }
  }

  return args;
}

function runScrape(market, { condoOnly, date }) {
  const output = `data/scrapes/${market.id}-active-listings-${date}.json`;
  const notes = [
    `Redfin city region_id=${market.regions.split(':')[0]} (type 6);`,
    `state=${market.state};`,
    condoOnly ? 'condo-only;' : '',
    'deduped by MLS.',
  ]
    .filter(Boolean)
    .join(' ');

  const argv = [
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
    notes,
  ];

  if (condoOnly) argv.push('--condo-only');

  return new Promise((resolve, reject) => {
    console.log(`\n=== ${market.id} (${market.priority}) → ${output} ===`);
    const child = spawn(process.execPath, argv, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${market.id} scrape exited with code ${code}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const markets = args.market
    ? US_ACTIVE_MARKETS.filter((m) => m.id === args.market)
    : US_ACTIVE_MARKETS;

  if (!markets.length) {
    console.error(
      `Unknown market "${args.market}". Valid: ${US_ACTIVE_MARKETS.map((m) => m.id).join(', ')}`,
    );
    process.exit(1);
  }

  console.log(
    `Scraping ${markets.length} US ACTIVE market(s)${args.condoOnly ? ' (condo-only)' : ''} dated ${args.date}`,
  );

  const outputs = [];
  for (const market of markets) {
    outputs.push(await runScrape(market, args));
  }

  console.log('\nDone. Wrote:');
  for (const path of outputs) console.log(`  ${path}`);
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
