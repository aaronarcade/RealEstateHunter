import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  parseArgs,
  buildGisParams,
  mapHome,
  mergeListingMaps,
  buildScrapePayload,
  CONDO_UI_PROPERTY_TYPE,
  US_STATE_CODES,
} from './lib/redfin-market.mjs';
import { US_ACTIVE_MARKETS } from './scrape-us-active-markets.mjs';
import { buildValidator } from './lib/validator.mjs';

function sampleHome(overrides = {}) {
  return {
    streetLine: { value: '1120 E Kennedy Blvd Unit 1201' },
    city: 'Tampa',
    state: 'FL',
    zip: '33602',
    price: { value: 425000 },
    beds: 2,
    baths: 2,
    sqFt: { value: 1100 },
    hoa: { value: 550 },
    uiPropertyType: 2,
    yearBuilt: { value: 2015 },
    dom: { value: 12 },
    mlsId: { value: 'T3500123' },
    url: '/FL/Tampa/1120-E-Kennedy-Blvd-33602/unit-1201/home/12345',
    latLong: { value: { latitude: 27.95, longitude: -82.45 } },
    ...overrides,
  };
}

test('parseArgs requires market, market-area, regions, output', () => {
  assert.throws(
    () => parseArgs(['node', 'scrape-redfin-market.mjs', '--market', 'x']),
    /Required/,
  );
});

test('parseArgs accepts multi-state and condo-only', () => {
  const args = parseArgs([
    'node',
    'scrape-redfin-market.mjs',
    '--market',
    'birmingham-al',
    '--market-area',
    'birmingham',
    '--state',
    'AL',
    '--market-param',
    'birmingham',
    '--regions',
    '1823:6',
    '--output',
    'data/scrapes/out.json',
    '--condo-only',
  ]);
  assert.equal(args.market, 'birmingham-al');
  assert.deepEqual(args.states, ['AL']);
  assert.equal(args.condoOnly, true);
  assert.deepEqual(args.regions, [{ id: '1823', type: '6', label: '1823-region' }]);
});

test('parseArgs rejects invalid state codes', () => {
  assert.throws(
    () =>
      parseArgs([
        'node',
        'x',
        '--market',
        'm',
        '--market-area',
        'a',
        '--state',
        'XX',
        '--regions',
        '1:6',
        '--output',
        'o.json',
      ]),
    /Invalid US state/,
  );
});

test('buildGisParams sets condo uipt when condoOnly', () => {
  const all = buildGisParams({
    regionId: 18142,
    regionType: 6,
    start: 0,
    market: 'tampa',
  });
  assert.equal(all.get('uipt'), '1,2,3,4,5,6,7,8');

  const condo = buildGisParams({
    regionId: 18142,
    regionType: 6,
    start: 0,
    market: 'tampa',
    condoOnly: true,
  });
  assert.equal(condo.get('uipt'), String(CONDO_UI_PROPERTY_TYPE));
  assert.equal(condo.get('region_id'), '18142');
});

test('mapHome accepts non-FL states and sets state from home', () => {
  const listing = mapHome(sampleHome({ state: 'AL', city: 'Birmingham', zip: '35203' }), {
    marketArea: 'birmingham',
    sourceLabel: '1823-region',
    allowedStates: ['AL'],
  });
  assert.ok(listing);
  assert.equal(listing.state, 'AL');
  assert.equal(listing.market_area, 'birmingham');
  assert.equal(listing.property_type, 'condo');
  assert.equal(listing.hoa_monthly, 550);
  assert.equal(listing.mls_id, 'T3500123');
  assert.match(listing.listing_url, /^https:\/\/www\.redfin\.com\//);
});

test('mapHome rejects homes outside allowed states (legacy FL-only behavior)', () => {
  const listing = mapHome(sampleHome({ state: 'GA' }), {
    marketArea: 'tampa',
    sourceLabel: '18142-region',
    allowedStates: ['FL'],
  });
  assert.equal(listing, null);
});

test('mapHome condo-only skips non-condo', () => {
  const sfh = mapHome(sampleHome({ uiPropertyType: 1 }), {
    marketArea: 'tampa',
    sourceLabel: '18142-region',
    allowedStates: ['FL'],
    condoOnly: true,
  });
  assert.equal(sfh, null);

  const condo = mapHome(sampleHome({ uiPropertyType: 2 }), {
    marketArea: 'tampa',
    sourceLabel: '18142-region',
    allowedStates: ['FL'],
    condoOnly: true,
  });
  assert.equal(condo.property_type, 'condo');
});

test('mergeListingMaps unions source_zips for duplicate MLS', () => {
  const a = new Map([
    [
      'MLS1',
      {
        mls_id: 'MLS1',
        source_zips: ['111-region'],
      },
    ],
  ]);
  const b = new Map([
    [
      'MLS1',
      {
        mls_id: 'MLS1',
        source_zips: ['222-region'],
      },
    ],
    [
      'MLS2',
      {
        mls_id: 'MLS2',
        source_zips: ['222-region'],
      },
    ],
  ]);
  mergeListingMaps(a, b);
  assert.equal(a.size, 2);
  assert.deepEqual(a.get('MLS1').source_zips.sort(), ['111-region', '222-region']);
});

test('buildScrapePayload matches existing scrape envelope', () => {
  const listing = mapHome(sampleHome(), {
    marketArea: 'tampa',
    sourceLabel: '18142-region',
    allowedStates: ['FL'],
  });
  const payload = buildScrapePayload({
    market: 'tampa-fl',
    scrapedAt: '2026-08-16T12:00:00Z',
    notes: 'test notes',
    listings: [listing],
    states: ['FL'],
  });
  assert.equal(payload.source, 'redfin');
  assert.equal(payload.market, 'tampa-fl');
  assert.equal(payload.status_filter, 'active_for_sale');
  assert.equal(payload.count, 1);
  assert.equal(payload.listings[0].state, 'FL');
});

test('US_ACTIVE_MARKETS covers five TASK-015 markets with documented region ids', () => {
  const ids = US_ACTIVE_MARKETS.map((m) => m.id).sort();
  assert.deepEqual(ids, [
    'birmingham-al',
    'cleveland-oh',
    'jacksonville-fl',
    'memphis-tn',
    'tampa-fl',
  ]);
  const byId = Object.fromEntries(US_ACTIVE_MARKETS.map((m) => [m.id, m]));
  assert.equal(byId['tampa-fl'].regions, '18142:6');
  assert.equal(byId['jacksonville-fl'].regions, '8907:6');
  assert.equal(byId['birmingham-al'].regions, '1823:6');
  assert.equal(byId['memphis-tn'].regions, '12260:6');
  assert.equal(byId['cleveland-oh'].regions, '4145:6');
  assert.ok(US_STATE_CODES.has('OH'));
});

test('sync-shaped market listing rows validate for new US ACTIVE market areas', () => {
  const { validate } = buildValidator();
  const samples = [
    { market_area: 'tampa', market_id: 'tampa-fl', state: 'FL', zip: '33602' },
    { market_area: 'jacksonville', market_id: 'jacksonville-fl', state: 'FL', zip: '32202' },
    { market_area: 'birmingham', market_id: 'birmingham-al', state: 'AL', zip: '35203' },
    { market_area: 'memphis', market_id: 'memphis-tn', state: 'TN', zip: '38103' },
    { market_area: 'cleveland', market_id: 'cleveland-oh', state: 'OH', zip: '44113' },
  ];

  for (const sample of samples) {
    const row = {
      id: `test-${sample.market_id}`,
      address: '123 Test St Unit 1',
      city: 'Testville',
      state: sample.state,
      zip: sample.zip,
      market_area: sample.market_area,
      market_id: sample.market_id,
      asking_price: 250000,
      beds: 2,
      baths: 2,
      property_type: 'condo',
      hoa_monthly: 400,
      mls_id: 'TEST123',
      listing_url: 'https://www.redfin.com/test/home/1',
      source: 'redfin',
      scrape_batch: sample.market_id,
      scraped_at: '2026-08-16T12:00:00Z',
    };
    const { valid, errors } = validate('market-listing.json', row);
    assert.ok(valid, `${sample.market_id} failed: ${JSON.stringify(errors)}`);
  }
});

test('fixture scrape file loads with expected listing fields for sync dry-run shape', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reh-scrape-'));
  try {
    const listing = mapHome(sampleHome({ state: 'TN', city: 'Memphis', zip: '38103' }), {
      marketArea: 'memphis',
      sourceLabel: '12260-region',
      allowedStates: ['TN'],
    });
    const payload = buildScrapePayload({
      market: 'memphis-tn',
      scrapedAt: '2026-08-16T12:00:00Z',
      notes: 'fixture',
      listings: [listing],
      states: ['TN'],
    });
    const path = join(dir, 'memphis-tn-active-listings-2026-08-16.json');
    await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
    const loaded = JSON.parse(await readFile(path, 'utf-8'));
    assert.equal(loaded.count, 1);
    for (const field of [
      'address',
      'asking_price',
      'beds',
      'baths',
      'property_type',
      'hoa_monthly',
      'mls_id',
      'listing_url',
      'state',
    ]) {
      assert.ok(field in loaded.listings[0], `missing ${field}`);
    }
    assert.equal(loaded.listings[0].state, 'TN');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
