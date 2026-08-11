#!/usr/bin/env node

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { source: null, url: null, market: null, marketArea: null, output: null, notes: '', currency: 'USD' };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--source' && value) { args.source = value; i += 1; }
    else if (flag === '--url' && value) { args.url = value; i += 1; }
    else if (flag === '--market' && value) { args.market = value; i += 1; }
    else if (flag === '--market-area' && value) { args.marketArea = value; i += 1; }
    else if (flag === '--output' && value) { args.output = join(REPO_ROOT, value); i += 1; }
    else if (flag === '--notes' && value) { args.notes = value; i += 1; }
    else if (flag === '--currency' && value) { args.currency = value; i += 1; }
  }
  if (!args.source || !args.url || !args.market || !args.marketArea || !args.output) {
    console.error('Required: --source --url --market --market-area --output');
    process.exit(1);
  }
  return args;
}

function decodeHtml(value) {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
}

function unwrapAstro(value) {
  if (Array.isArray(value)) {
    if (value.length === 2 && value[0] === 0) return unwrapAstro(value[1]);
    return value.map(unwrapAstro);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, nested] of Object.entries(value)) out[key] = unwrapAstro(nested);
    return out;
  }
  return value;
}

async function scrapeYapaTree(url, marketArea, currency) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  });
  if (!response.ok) throw new Error(`YapaTree fetch failed (${response.status})`);

  const html = await response.text();
  const match = html.match(/astro-island[^>]*props="([^"]+)"/);
  if (!match) throw new Error('YapaTree astro props not found');

  const parsed = unwrapAstro(JSON.parse(decodeHtml(match[1])));
  const rawRows = parsed.properties?.[1] ?? parsed.properties ?? [];
  const rows = Array.isArray(rawRows) ? rawRows : [];

  const listings = [];

  for (const row of rows) {
    if (row.type !== 'for_sale' || row.published !== true) continue;
    if (String(row.status || '').toLowerCase() !== 'active') continue;
    const slug = row.urlSlug || row.slug;
    listings.push({
      address: row.fullAddress || row.name || slug || 'Cuenca property',
      city: 'Cuenca',
      state: 'Azuay',
      country: 'Ecuador',
      zip: row.zipCode || undefined,
      asking_price: row.salePriceUsd != null ? Number(row.salePriceUsd) : null,
      beds: row.bedrooms ?? null,
      baths: row.bathrooms != null ? Number(row.bathrooms) + Number(row.halfBathrooms || 0) * 0.5 : null,
      sqft: row.livingAreaM2 != null ? Math.round(Number(row.livingAreaM2) * 10.7639) : null,
      hoa_monthly: row.aliquotaUsd ?? null,
      property_type: String(row.structureType || 'other').toLowerCase().replace(/\s+/g, '_'),
      year_built: row.yearBuilt ?? null,
      mls_id: row.listingCode || row.id,
      listing_url: slug ? `https://yapatree.com/buy-properties-cuenca/${slug}/` : url,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      market_area: marketArea,
      source_portal: 'yapatree',
      currency,
    });
  }

  return listings;
}

async function main() {
  const args = parseArgs(process.argv);
  const scrapedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const listings = args.source === 'yapatree'
    ? await scrapeYapaTree(args.url, args.marketArea, args.currency)
    : (() => { throw new Error(`Unsupported source: ${args.source}`); })();

  const payload = {
    source: args.source,
    market: args.market,
    scraped_at: scrapedAt,
    status_filter: 'active_for_sale',
    currency: args.currency,
    notes: args.notes,
    count: listings.length,
    listings,
  };

  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${listings.length} listings to ${args.output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
