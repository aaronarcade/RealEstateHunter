#!/usr/bin/env node

/**
 * TASK-015: scrape the five US ACTIVE markets that lack bulk inventory.
 *
 * Usage:
 *   node scripts/scrape-us-active-markets.mjs
 *   node scripts/scrape-us-active-markets.mjs --market tampa-fl
 *   node scripts/scrape-us-active-markets.mjs --condo-only
 *   node scripts/scrape-us-active-markets.mjs --date 2026-08-15 --phase a
 *
 * Phases (Manager triage):
 *   a → tampa-fl, jacksonville-fl (P0)
 *   b → birmingham-al, memphis-tn, cleveland-oh (P1)
 *   all (default) → a then b
 *
 * Redfin city region_ids (region_type=6) — also in data/scrapes/README.md:
 *   tampa-fl         18142  https://www.redfin.com/city/18142/FL/Tampa
 *   jacksonville-fl  8907   https://www.redfin.com/city/8907/FL/Jacksonville
 *   birmingham-al    1823   https://www.redfin.com/city/1823/AL/Birmingham
 *   memphis-tn       12260  https://www.redfin.com/city/12260/TN/Memphis
 *   cleveland-oh     4145   https://www.redfin.com/city/4145/OH/Cleveland
 */

import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRAPER = join(REPO_ROOT, 'scripts/scrape-redfin-market.mjs');

/** @typedef {{ id: string, marketArea: string, state: string, regionId: string, marketParam: string, phase: 'a'|'b', notes: string }} UsActiveMarket */

/** @type {UsActiveMarket[]} */
export const US_ACTIVE_MARKETS = [
  {
    id: 'tampa-fl',
    marketArea: 'tampa',
    state: 'FL',
    regionId: '18142',
    marketParam: 'florida',
    phase: 'a',
    notes: 'Redfin city region_id=18142 (Tampa, FL); multi-state scraper; deduped by MLS.',
  },
  {
    id: 'jacksonville-fl',
    marketArea: 'jacksonville',
    state: 'FL',
    regionId: '8907',
    marketParam: 'florida',
    phase: 'a',
    notes: 'Redfin city region_id=8907 (Jacksonville, FL); multi-state scraper; deduped by MLS.',
  },
  {
    id: 'birmingham-al',
    marketArea: 'birmingham',
    state: 'AL',
    regionId: '1823',
    marketParam: 'birmingham',
    phase: 'b',
    notes: 'Redfin city region_id=1823 (Birmingham, AL); multi-state scraper; deduped by MLS.',
  },
  {
    id: 'memphis-tn',
    marketArea: 'memphis',
    state: 'TN',
    regionId: '12260',
    marketParam: 'memphis',
    phase: 'b',
    notes: 'Redfin city region_id=12260 (Memphis, TN); multi-state scraper; deduped by MLS.',
  },
  {
    id: 'cleveland-oh',
    marketArea: 'cleveland',
    state: 'OH',
    regionId: '4145',
    marketParam: 'cleveland',
    phase: 'b',
    notes: 'Redfin city region_id=4145 (Cleveland, OH); multi-state scraper; deduped by MLS.',
  },
];

export function parseCli(argv) {
  const args = {
    market: null,
    phase: 'all',
    condoOnly: false,
    date: new Date().toISOString().slice(0, 10),
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--market' && value) {
      args.market = value;
      i += 1;
    } else if (flag === '--phase' && value) {
      args.phase = value.toLowerCase();
      i += 1;
    } else if (flag === '--date' && value) {
      args.date = value;
      i += 1;
    } else if (flag === '--condo-only') {
      args.condoOnly = true;
    } else if (flag === '--dry-run') {
      args.dryRun = true;
    }
  }

  if (!['all', 'a', 'b'].includes(args.phase)) {
    throw new Error(`Invalid --phase ${args.phase}; expected all|a|b`);
  }

  return args;
}

export function selectMarkets({ market, phase }) {
  if (market) {
    const found = US_ACTIVE_MARKETS.filter((m) => m.id === market);
    if (!found.length) {
      throw new Error(
        `Unknown market ${market}; expected one of ${US_ACTIVE_MARKETS.map((m) => m.id).join(', ')}`,
      );
    }
    return found;
  }
  if (phase === 'all') return US_ACTIVE_MARKETS;
  return US_ACTIVE_MARKETS.filter((m) => m.phase === phase);
}

export function buildScraperArgs(market, { date, condoOnly }) {
  const output = `data/scrapes/${market.id}-active-listings-${date}.json`;
  const argv = [
    SCRAPER,
    '--market',
    market.id,
    '--market-area',
    market.marketArea,
    '--states',
    market.state,
    '--regions',
    `${market.regionId}:6`,
    '--market-param',
    market.marketParam,
    '--output',
    output,
    '--notes',
    market.notes,
  ];
  if (condoOnly) argv.push('--condo-only');
  return { output, argv };
}

function runNode(argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argv, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`scrape-redfin-market exited ${code} for ${argv.join(' ')}`));
    });
  });
}

async function main() {
  const args = parseCli(process.argv);
  const markets = selectMarkets(args);
  console.log(
    `US ACTIVE scrape: ${markets.map((m) => m.id).join(', ')} (date=${args.date}${args.condoOnly ? ', condo-only' : ''}${args.dryRun ? ', dry-run' : ''})`,
  );

  for (const market of markets) {
    const { output, argv } = buildScraperArgs(market, args);
    console.log(`\n=== ${market.id} → ${output} (region ${market.regionId}:6) ===`);
    if (args.dryRun) {
      console.log(`dry-run: node ${argv.join(' ')}`);
      continue;
    }
    await runNode(argv);
  }
}

const isMain =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
