import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  US_ACTIVE_MARKETS,
  buildScrapePayload,
  mapHome,
  mergeRegionalMaps,
  propertyTypesParam,
  scrapeMarketConfig,
} from './lib/redfin-scrape.mjs';
import { buildValidator } from './lib/validator.mjs';

const { validate } = buildValidator();

const sampleHome = {
  streetLine: { value: '100 Main St Unit 5' },
  city: 'Tampa',
  zip: '33602',
  state: 'FL',
  price: { value: 225000 },
  beds: 2,
  baths: 2,
  sqFt: { value: 1100 },
  hoa: { value: 350 },
  uiPropertyType: 2,
  yearBuilt: { value: 2005 },
  dom: { value: 12 },
  mlsId: { value: 'TB999001' },
  url: '/FL/Tampa/100-Main-St-33602/unit-5/home/123',
  latLong: { value: { latitude: 27.95, longitude: -82.45 } },
};

test('mapHome accepts configured state across US markets', () => {
  const listing = mapHome(sampleHome, {
    marketArea: 'tampa',
    sourceLabel: '18142-region',
    state: 'FL',
  });
  assert.equal(listing.state, 'FL');
  assert.equal(listing.property_type, 'condo');
  assert.equal(listing.hoa_monthly, 350);
});

test('mapHome rejects listings outside expected state', () => {
  const listing = mapHome({ ...sampleHome, state: 'GA' }, {
    marketArea: 'tampa',
    sourceLabel: '18142-region',
    state: 'FL',
  });
  assert.equal(listing, null);
});

test('propertyTypesParam switches to condo-only uipt', () => {
  assert.equal(propertyTypesParam(false), '1,2,3,4,5,6,7,8');
  assert.equal(propertyTypesParam(true), '2');
});

test('scrapeMarketConfig dedupes MLS IDs across regions via mock fetch', async () => {
  const tampa = US_ACTIVE_MARKETS.find((market) => market.id === 'tampa-fl');
  const homes = [sampleHome, { ...sampleHome, mlsId: { value: 'TB999002' } }];
  const fetchImpl = async () => ({
    ok: true,
    text: async () => JSON.stringify({ payload: { homes } }),
  });
  const listings = await scrapeMarketConfig(tampa, { fetchImpl });
  assert.equal(listings.length, 2);
  assert.ok(listings.every((row) => row.state === 'FL'));
});

test('buildScrapePayload matches bulk scrape envelope', () => {
  const listing = mapHome(sampleHome, {
    marketArea: 'tampa',
    sourceLabel: '18142-region',
    state: 'FL',
  });
  const payload = buildScrapePayload({
    market: 'tampa-fl',
    listings: [listing],
    scrapedAt: '2026-08-19T12:00:00Z',
    notes: 'test',
    condoOnly: true,
  });
  assert.equal(payload.source, 'redfin');
  assert.equal(payload.market, 'tampa-fl');
  assert.equal(payload.count, 1);
  assert.equal(payload.condo_only, true);
  assert.equal(payload.listings[0].mls_id, 'TB999001');
});

test('US ACTIVE market scrape rows validate as market-listing after sync mapping', async () => {
  const listing = mapHome(sampleHome, {
    marketArea: 'tampa',
    sourceLabel: '18142-region',
    state: 'FL',
  });
  const dir = await mkdtemp(join(tmpdir(), 'scrape-sync-'));
  const filePath = join(dir, 'tampa-fl-active-listings-2026-08-19.json');
  await writeFile(
    filePath,
    `${JSON.stringify(
      buildScrapePayload({
        market: 'tampa-fl',
        listings: [listing],
        scrapedAt: '2026-08-19T12:00:00Z',
        notes: 'fixture',
      }),
    )}\n`,
  );

  const payload = JSON.parse(await readFile(filePath, 'utf-8'));
  const row = {
    id: `${payload.listings[0].mls_id}-fl-${payload.listings[0].zip}`,
    address: payload.listings[0].address,
    city: payload.listings[0].city,
    state: payload.listings[0].state,
    zip: payload.listings[0].zip,
    market_area: payload.listings[0].market_area,
    market_id: 'tampa-fl',
    asking_price: payload.listings[0].asking_price,
    beds: payload.listings[0].beds,
    baths: payload.listings[0].baths,
    hoa_monthly: payload.listings[0].hoa_monthly,
    property_type: payload.listings[0].property_type,
    mls_id: payload.listings[0].mls_id,
    listing_url: `https://www.redfin.com${sampleHome.url}`,
    source: payload.source,
    scrape_batch: 'tampa-fl',
    scraped_at: payload.scraped_at,
  };

  const { valid, errors } = validate('market-listing.json', row);
  assert.ok(valid, JSON.stringify(errors));
});

test('mergeRegionalMaps combines source_zips for duplicate MLS', () => {
  const first = new Map([
    [
      'A',
      {
        mls_id: 'A',
        listing_url: 'https://example.com/a',
        source_zips: ['111-region'],
      },
    ],
  ]);
  const second = new Map([
    [
      'A',
      {
        mls_id: 'A',
        listing_url: 'https://example.com/a',
        source_zips: ['222-region'],
      },
    ],
  ]);
  const merged = mergeRegionalMaps([first, second]);
  assert.deepEqual(merged.get('A').source_zips, ['111-region', '222-region']);
});

test('US_ACTIVE_MARKETS defines five TASK-015 markets with region metadata', () => {
  assert.equal(US_ACTIVE_MARKETS.length, 5);
  const ids = US_ACTIVE_MARKETS.map((market) => market.id);
  assert.deepEqual(ids, [
    'tampa-fl',
    'jacksonville-fl',
    'birmingham-al',
    'memphis-tn',
    'cleveland-oh',
  ]);
  for (const market of US_ACTIVE_MARKETS) {
    assert.match(market.redfinUrl, /redfin\.com\/city\/\d+/);
    assert.ok(market.regions.length >= 1);
  }
});

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('TASK-015 committed scrape files meet >=100 listing smoke target when present', async () => {
  for (const market of US_ACTIVE_MARKETS) {
    const scrapesDir = join(REPO_ROOT, 'data/scrapes');
    const names = existsSync(scrapesDir) ? await readdir(scrapesDir) : [];
    const match = names.find((name) => name.startsWith(`${market.id}-active-listings-`));
    if (!match) continue;

    const payload = JSON.parse(await readFile(join(scrapesDir, match), 'utf-8'));
    assert.equal(payload.market, market.id);
    assert.ok(Array.isArray(payload.listings));
    assert.ok(
      payload.count >= 100,
      `${market.id} scrape ${match} has ${payload.count} listings (< 100 smoke target)`,
    );

    const sample = payload.listings[0];
    for (const field of [
      'address',
      'asking_price',
      'beds',
      'baths',
      'property_type',
      'mls_id',
      'listing_url',
      'state',
    ]) {
      assert.ok(field in sample, `${market.id} listing missing ${field}`);
    }
  }
});
