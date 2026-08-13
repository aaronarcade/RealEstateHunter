import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  mapHome,
  parseArgs,
  buildScrapePayload,
  fetchGisBatch,
  PROPERTY_TYPE_BY_UI,
} from './scrape-redfin-market.mjs';
import { US_ACTIVE_MARKETS } from './scrape-us-active-markets.mjs';

function sampleHome(overrides = {}) {
  return {
    state: 'FL',
    streetLine: { value: '100 Channelside Dr Unit 1205' },
    city: 'Tampa',
    zip: '33602',
    price: { value: 275000 },
    beds: 2,
    baths: 2,
    sqFt: { value: 1100 },
    hoa: { value: 450 },
    uiPropertyType: 2,
    yearBuilt: { value: 2018 },
    dom: { value: 12 },
    mlsId: { value: 'TB999001' },
    url: '/FL/Tampa/100-Channelside-Dr-33602/unit-1205/home/111',
    latLong: { value: { latitude: 27.94, longitude: -82.45 } },
    ...overrides,
  };
}

test('PROPERTY_TYPE_BY_UI maps condo ui type 2', () => {
  assert.equal(PROPERTY_TYPE_BY_UI[2], 'condo');
});

test('mapHome accepts non-FL states when allowedState matches', () => {
  const listing = mapHome(
    sampleHome({
      state: 'AL',
      city: 'Birmingham',
      zip: '35203',
      url: '/AL/Birmingham/2001-Park-Pl-S-35203/unit-10/home/222',
      mlsId: { value: 'AL100' },
    }),
    'birmingham',
    '1823-region',
    { allowedState: 'AL' },
  );

  assert.ok(listing);
  assert.equal(listing.state, 'AL');
  assert.equal(listing.market_area, 'birmingham');
  assert.equal(listing.property_type, 'condo');
  assert.equal(listing.hoa_monthly, 450);
  assert.equal(listing.mls_id, 'AL100');
  assert.match(listing.listing_url, /^https:\/\/www\.redfin\.com\//);
});

test('mapHome rejects homes outside allowedState (legacy FL filter)', () => {
  const listing = mapHome(sampleHome({ state: 'GA' }), 'tampa', '18142-region', {
    allowedState: 'FL',
  });
  assert.equal(listing, null);
});

test('mapHome condoOnly filters non-condo property types', () => {
  const condo = mapHome(sampleHome({ uiPropertyType: 2 }), 'tampa', 'r', {
    allowedState: 'FL',
    condoOnly: true,
  });
  const sfh = mapHome(sampleHome({ uiPropertyType: 1, mlsId: { value: 'SFH1' } }), 'tampa', 'r', {
    allowedState: 'FL',
    condoOnly: true,
  });
  assert.equal(condo?.property_type, 'condo');
  assert.equal(sfh, null);
});

test('parseArgs supports --state and --condo-only', () => {
  const args = parseArgs([
    'node',
    'scrape-redfin-market.mjs',
    '--market',
    'memphis-tn',
    '--market-area',
    'memphis',
    '--state',
    'tn',
    '--market-param',
    'tennessee',
    '--regions',
    '12260:6',
    '--output',
    'data/scrapes/memphis-tn-active-listings-2026-08-13.json',
    '--condo-only',
  ]);

  assert.equal(args.market, 'memphis-tn');
  assert.equal(args.state, 'TN');
  assert.equal(args.condoOnly, true);
  assert.equal(args.regions[0].id, '12260');
  assert.equal(args.regions[0].type, '6');
  assert.match(args.output, /memphis-tn-active-listings-2026-08-13\.json$/);
});

test('buildScrapePayload matches existing scrape schema shape', () => {
  const listing = mapHome(sampleHome(), 'tampa', '18142-region', { allowedState: 'FL' });
  const payload = buildScrapePayload({
    market: 'tampa-fl',
    listings: [listing],
    scrapedAt: '2026-08-13T12:00:00Z',
    notes: 'test',
    condoOnly: false,
    state: 'FL',
  });

  assert.equal(payload.source, 'redfin');
  assert.equal(payload.market, 'tampa-fl');
  assert.equal(payload.count, 1);
  assert.equal(payload.status_filter, 'active_for_sale');
  assert.ok(Array.isArray(payload.listings));
  for (const key of [
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
    assert.ok(key in payload.listings[0], `missing ${key}`);
  }
});

test('US_ACTIVE_MARKETS covers five zero-coverage markets with documented region IDs', () => {
  const byId = Object.fromEntries(US_ACTIVE_MARKETS.map((m) => [m.id, m]));
  assert.deepEqual(Object.keys(byId).sort(), [
    'birmingham-al',
    'cleveland-oh',
    'jacksonville-fl',
    'memphis-tn',
    'tampa-fl',
  ]);
  assert.equal(byId['tampa-fl'].regions, '18142:6');
  assert.equal(byId['jacksonville-fl'].regions, '8907:6');
  assert.equal(byId['birmingham-al'].regions, '1823:6');
  assert.equal(byId['memphis-tn'].regions, '12260:6');
  assert.equal(byId['cleveland-oh'].regions, '4145:6');
  assert.equal(byId['birmingham-al'].state, 'AL');
  assert.equal(byId['memphis-tn'].state, 'TN');
  assert.equal(byId['cleveland-oh'].state, 'OH');
});

test('fetchGisBatch passes condo-only uipt=2', async () => {
  let seenUrl = '';
  const fetchImpl = async (url) => {
    seenUrl = url;
    return {
      ok: true,
      text: async () => JSON.stringify({ payload: { homes: [] } }),
    };
  };

  await fetchGisBatch({
    regionId: 18142,
    regionType: 6,
    start: 0,
    market: 'florida',
    condoOnly: true,
    fetchImpl,
  });

  assert.match(seenUrl, /uipt=2/);
  assert.match(seenUrl, /region_id=18142/);
});
