#!/usr/bin/env node
/**
 * Bulk-scrape US ACTIVE markets with zero scout coverage (TASK-015).
 *
 * Usage:
 *   node scripts/scrape-us-active-markets.mjs [--markets tampa-fl,jacksonville-fl] [--condo-only] [--date YYYY-MM-DD]
 *
 * Output:
 *   data/scrapes/{market-id}-active-listings-YYYY-MM-DD.json
 *
 * Redfin region IDs documented in data/scrapes/README.md and US_ACTIVE_MARKETS in lib/redfin-scrape.mjs.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  US_ACTIVE_MARKETS,
  buildScrapePayload,
  defaultOutputPath,
  scrapeDateStamp,
  scrapeMarketConfig,
} from './lib/redfin-scrape.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIN_LISTINGS_SMOKE = 100;

function parseArgs(argv) {
  const args = {
    markets: US_ACTIVE_MARKETS.map((market) => market.id),
    condoOnly: false,
    date: scrapeDateStamp(),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--markets' && value) {
      args.markets = value.split(',').map((part) => part.trim()).filter(Boolean);
      i += 1;
    } else if (flag === '--condo-only') {
      args.condoOnly = true;
    } else if (flag === '--date' && value) {
      args.date = value;
      i += 1;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const selected = US_ACTIVE_MARKETS.filter((market) => args.markets.includes(market.id));

  if (!selected.length) {
    console.error(`No matching markets in: ${args.markets.join(', ')}`);
    process.exit(1);
  }

  const scrapedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const summary = [];

  for (const config of selected) {
    console.log(`\n=== ${config.id} (${config.city}, ${config.state}) ===`);
    const listings = await scrapeMarketConfig(config, { condoOnly: args.condoOnly });
    const outputPath = defaultOutputPath(REPO_ROOT, config.id, args.date);
    const regionIds = config.regions.map((region) => `${region.id}:${region.type}`).join(', ');
    const payload = buildScrapePayload({
      market: config.id,
      listings,
      scrapedAt,
      condoOnly: args.condoOnly,
      notes: `Redfin bulk scrape for ${config.id}; region(s) ${regionIds}; ${config.state} only; deduped by MLS. See ${config.redfinUrl}.`,
    });

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    console.log(`Wrote ${listings.length} listings to ${outputPath}`);

    summary.push({ market: config.id, count: listings.length, output: outputPath });
    if (listings.length < MIN_LISTINGS_SMOKE) {
      console.warn(
        `⚠️  ${config.id}: ${listings.length} listings (< ${MIN_LISTINGS_SMOKE}); document as dry-market if expected`,
      );
    }
  }

  console.log('\n=== Summary ===');
  for (const row of summary) {
    console.log(`${row.market}: ${row.count} → ${row.output}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
