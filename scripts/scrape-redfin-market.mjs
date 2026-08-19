#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildScrapePayload,
  mergeRegionalMaps,
  parseRedfinArgs,
  scrapeRegion,
} from './lib/redfin-scrape.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const args = parseRedfinArgs(process.argv);
  if (!args.market || !args.marketArea || !args.output || !args.regions.length) {
    console.error(
      'Required: --market --market-area --state ST --regions ID:TYPE --output [--market-param] [--condo-only]',
    );
    process.exit(1);
  }

  const outputPath = args.output.startsWith('/') ? args.output : join(REPO_ROOT, args.output);
  const scrapedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const stateLabel = args.state || 'state-filtered';
  const condoLabel = args.condoOnly ? '; condo-only' : '';

  console.log(`Scraping ${args.market} (${stateLabel})${condoLabel}...`);

  const regionalMaps = [];
  for (const region of args.regions) {
    regionalMaps.push(
      await scrapeRegion(region, {
        marketArea: args.marketArea,
        marketParam: args.marketParam,
        state: args.state,
        condoOnly: args.condoOnly,
      }),
    );
  }

  const listings = Array.from(mergeRegionalMaps(regionalMaps).values());
  const payload = buildScrapePayload({
    market: args.market,
    listings,
    scrapedAt,
    condoOnly: args.condoOnly,
    notes:
      args.notes ||
      `Redfin bulk scrape for ${args.market}; ${stateLabel} only; deduped by MLS${condoLabel}.`,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${listings.length} listings to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
