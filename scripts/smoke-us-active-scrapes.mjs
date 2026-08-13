#!/usr/bin/env node

/**
 * Smoke-check US ACTIVE market scrape files:
 * - file exists
 * - schema shape (source/market/scraped_at/count/listings)
 * - required listing fields
 * - count >= 100 (or note dry-market)
 *
 * Usage:
 *   node scripts/smoke-us-active-scrapes.mjs [--date YYYY-MM-DD] [--min-count N]
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { US_ACTIVE_MARKETS } from './scrape-us-active-markets.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRAPES_DIR = join(REPO_ROOT, 'data/scrapes');
const REQUIRED_FIELDS = [
  'address',
  'asking_price',
  'beds',
  'baths',
  'property_type',
  'mls_id',
  'listing_url',
  'state',
];

function parseArgs(argv) {
  const args = { date: null, minCount: 100 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--date' && argv[i + 1]) {
      args.date = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--min-count' && argv[i + 1]) {
      args.minCount = Number(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

async function resolveFile(marketId, date) {
  if (date) {
    return join(SCRAPES_DIR, `${marketId}-active-listings-${date}.json`);
  }
  const names = (await readdir(SCRAPES_DIR))
    .filter((n) => n.startsWith(`${marketId}-active-listings-`) && n.endsWith('.json'))
    .sort();
  if (!names.length) return null;
  return join(SCRAPES_DIR, names[names.length - 1]);
}

async function checkFile(filePath, marketId, minCount) {
  if (!filePath || !existsSync(filePath)) {
    return { ok: false, marketId, error: 'missing scrape file' };
  }

  const payload = JSON.parse(await readFile(filePath, 'utf-8'));
  for (const key of ['source', 'market', 'scraped_at', 'count', 'listings']) {
    if (!(key in payload)) {
      return { ok: false, marketId, filePath, error: `missing payload.${key}` };
    }
  }
  if (payload.market !== marketId) {
    return {
      ok: false,
      marketId,
      filePath,
      error: `market mismatch: ${payload.market}`,
    };
  }
  if (!Array.isArray(payload.listings)) {
    return { ok: false, marketId, filePath, error: 'listings is not an array' };
  }

  for (const [i, listing] of payload.listings.slice(0, 25).entries()) {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in listing)) {
        return {
          ok: false,
          marketId,
          filePath,
          error: `listings[${i}] missing ${field}`,
        };
      }
    }
  }

  const count = payload.count ?? payload.listings.length;
  const dry = count < minCount;
  return {
    ok: true,
    marketId,
    filePath,
    count,
    dry,
    note: dry
      ? `DRY MARKET / low inventory: ${count} < ${minCount}`
      : `ok (${count} listings)`,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const results = [];
  for (const market of US_ACTIVE_MARKETS) {
    const filePath = await resolveFile(market.id, args.date);
    results.push(await checkFile(filePath, market.id, args.minCount));
  }

  let failed = 0;
  for (const result of results) {
    if (!result.ok) {
      failed += 1;
      console.error(`FAIL ${result.marketId}: ${result.error}`);
    } else if (result.dry) {
      console.warn(`WARN ${result.marketId}: ${result.note} @ ${result.filePath}`);
    } else {
      console.log(`OK   ${result.marketId}: ${result.note} @ ${result.filePath}`);
    }
  }

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
