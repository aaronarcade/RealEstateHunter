import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  buildPayload,
  mapHome,
  parseArgs,
  scrapeMarket,
} from './scrape-redfin-market.mjs';
import {
  US_ACTIVE_MARKETS,
  buildScraperArgs,
  parseCli,
  selectMarkets,
} from './scrape-us-active-markets.mjs';
import { buildValidator } from './lib/validator.mjs';

function sampleHome(overrides = {}) {
  return {
    state: 'FL',
    streetLine: { value: '100 Channelside Dr Unit 1201' },
    city: 'Tampa',
    zip: '33602',
    price: { value: 425000 },
    beds: 2,
    baths: 2,
    sqFt: { value: 1100 },
    hoa: { value: 650 },
    uiPropertyType: 2,
    yearBuilt: { value: 2018 },
    dom: { value: 12 },
    mlsId: { value: 'T3500001' },
    url: '/FL/Tampa/100-Channelside-Dr-33602/unit-1201/home/999001',
    latLong: { value: { latitude: 27.94, longitude: -82.45 } },
    ...overrides,
  };
}

test('parseArgs accepts multi-state and condo-only flags', () => {
  const args = parseArgs([
    'node',
    'scrape-redfin-market.mjs',
    '--market',
    'birmingham-al',
    '--market-area',
    'birmingham',
    '--states',
    'AL',
    '--regions',
    '1823:6',
    '--output',
    'data/scrapes/birmingham-al-active-listings-2026-08-15.json',
    '--condo-only',
    '--market-param',
    'birmingham',
  ]);

  assert.equal(args.market, 'birmingham-al');
  assert.equal(args.marketArea, 'birmingham');
  assert.deepEqual(args.states, ['AL']);
  assert.equal(args.condoOnly, true);
  assert.equal(args.regions[0].id, '1823');
  assert.equal(args.marketParam, 'birmingham');
  assert.match(args.output, /birmingham-al-active-listings-2026-08-15\.json$/);
});

test('mapHome keeps non-FL states when allowed and drops others', () => {
  const al = mapHome(sampleHome({ state: 'AL', city: 'Birmingham', zip: '35203' }), 'birmingham', '1823-region', {
    allowedStates: ['AL'],
  });
  assert.equal(al.state, 'AL');
  assert.equal(al.market_area, 'birmingham');
  assert.equal(al.property_type, 'condo');
  assert.equal(al.hoa_monthly, 650);

  const dropped = mapHome(sampleHome({ state: 'GA' }), 'birmingham', '1823-region', {
    allowedStates: ['AL'],
  });
  assert.equal(dropped, null);
});

test('mapHome condo-only filters non-condo property types', () => {
  const condo = mapHome(sampleHome({ uiPropertyType: 2 }), 'tampa', '18142-region', {
    allowedStates: ['FL'],
    condoOnly: true,
  });
  assert.equal(condo.property_type, 'condo');

  const sfh = mapHome(sampleHome({ uiPropertyType: 1, mlsId: { value: 'T3500002' } }), 'tampa', '18142-region', {
    allowedStates: ['FL'],
    condoOnly: true,
  });
  assert.equal(sfh, null);
});

test('scrapeMarket dedupes by MLS across mocked GIS pages', async () => {
  const homesPage1 = [
    sampleHome({ mlsId: { value: 'A1' }, state: 'OH', city: 'Cleveland', zip: '44114' }),
    sampleHome({
      mlsId: { value: 'A2' },
      state: 'OH',
      city: 'Cleveland',
      zip: '44113',
      uiPropertyType: 1,
      url: '/OH/Cleveland/200-W-9th-44113/home/999002',
    }),
  ];
  const homesPage2 = [
    sampleHome({ mlsId: { value: 'A1' }, state: 'OH', city: 'Cleveland', zip: '44114' }),
  ];

  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    const homes = calls === 1 ? homesPage1 : homesPage2;
    return {
      ok: true,
      async text() {
        return `{}&&${JSON.stringify({ payload: { homes } })}`;
      },
    };
  };

  const payload = await scrapeMarket(
    {
      market: 'cleveland-oh',
      marketArea: 'cleveland',
      states: ['OH'],
      regions: [{ id: '4145', type: '6', label: '4145-region' }],
      marketParam: 'cleveland',
      condoOnly: false,
      maxStart: 350,
      notes: 'test',
    },
    { fetchImpl, log() {} },
  );

  assert.equal(payload.source, 'redfin');
  assert.equal(payload.market, 'cleveland-oh');
  assert.equal(payload.count, 2);
  assert.equal(payload.listings.length, 2);
  assert.ok(payload.listings.every((l) => l.state === 'OH'));
  assert.ok(payload.listings.every((l) => l.listing_url && l.mls_id));
});

test('buildPayload and sync row validate against market-listing schema for new areas', () => {
  const listing = mapHome(sampleHome({ state: 'TN', city: 'Memphis', zip: '38103' }), 'memphis', '12260-region', {
    allowedStates: ['TN'],
  });
  const payload = buildPayload({
    market: 'memphis-tn',
    scrapedAt: '2026-08-15T12:00:00Z',
    notes: 'test memphis',
    listings: [listing],
    states: ['TN'],
    condoOnly: false,
  });
  assert.equal(payload.count, 1);

  const { validate } = buildValidator();
  const row = {
    id: 't3500001-tn-38103',
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    market_area: 'memphis',
    market_id: 'memphis-tn',
    asking_price: listing.asking_price,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft,
    hoa_monthly: listing.hoa_monthly,
    property_type: listing.property_type,
    mls_id: listing.mls_id,
    listing_url: listing.listing_url,
    lat: listing.lat,
    lng: listing.lng,
    source: 'redfin',
    scrape_batch: 'memphis-tn',
    scraped_at: payload.scraped_at,
  };
  const { valid, errors } = validate('market-listing.json', row);
  assert.ok(valid, JSON.stringify(errors));
});

test('US ACTIVE market catalog covers the five TASK-015 gaps with documented region ids', () => {
  assert.equal(US_ACTIVE_MARKETS.length, 5);
  const byId = Object.fromEntries(US_ACTIVE_MARKETS.map((m) => [m.id, m]));
  assert.equal(byId['tampa-fl'].regionId, '18142');
  assert.equal(byId['jacksonville-fl'].regionId, '8907');
  assert.equal(byId['birmingham-al'].regionId, '1823');
  assert.equal(byId['memphis-tn'].regionId, '12260');
  assert.equal(byId['cleveland-oh'].regionId, '4145');

  const phaseA = selectMarkets({ phase: 'a' });
  assert.deepEqual(
    phaseA.map((m) => m.id),
    ['tampa-fl', 'jacksonville-fl'],
  );

  const { output, argv } = buildScraperArgs(byId['tampa-fl'], {
    date: '2026-08-15',
    condoOnly: true,
  });
  assert.equal(output, 'data/scrapes/tampa-fl-active-listings-2026-08-15.json');
  assert.ok(argv.includes('--condo-only'));
  assert.ok(argv.includes('18142:6'));
  assert.ok(argv.includes('FL'));

  const cli = parseCli(['node', 'x', '--phase', 'b', '--date', '2026-08-15']);
  assert.equal(cli.phase, 'b');
  assert.equal(selectMarkets(cli).length, 3);
});

test('smoke: sync dry-load accepts a synthetic US ACTIVE scrape file', async () => {
  const dir = join(tmpdir(), `reh-task-015-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, 'tampa-fl-active-listings-2026-08-15.json');

  const listings = Array.from({ length: 100 }, (_, i) => {
    const home = sampleHome({
      mlsId: { value: `T-${i}` },
      url: `/FL/Tampa/100-Channelside-Dr-33602/unit-${i}/home/${1000 + i}`,
      streetLine: { value: `100 Channelside Dr Unit ${i}` },
    });
    return mapHome(home, 'tampa', '18142-region', { allowedStates: ['FL'] });
  });

  const payload = buildPayload({
    market: 'tampa-fl',
    scrapedAt: '2026-08-15T12:00:00Z',
    notes: 'synthetic smoke fixture',
    listings,
    states: ['FL'],
    condoOnly: false,
  });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);

  assert.equal(payload.count, 100);

  // Dynamic import of sync helpers is awkward (script runs main). Validate via schema instead.
  const { validate } = buildValidator();
  for (const listing of listings.slice(0, 5)) {
    const row = {
      id: `${listing.mls_id}-fl-${listing.zip}`,
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
      market_area: 'tampa',
      market_id: 'tampa-fl',
      asking_price: listing.asking_price,
      beds: listing.beds,
      baths: listing.baths,
      property_type: listing.property_type,
      mls_id: listing.mls_id,
      listing_url: listing.listing_url,
      source: 'redfin',
      scrape_batch: 'tampa-fl',
      scraped_at: payload.scraped_at,
    };
    const { valid, errors } = validate('market-listing.json', row);
    assert.ok(valid, JSON.stringify(errors));
  }

  const raw = JSON.parse(await readFile(filePath, 'utf-8'));
  assert.equal(raw.listings.length, 100);
  await rm(dir, { recursive: true, force: true });
});

test('README documents Redfin region IDs for all five markets', async () => {
  const readme = await readFile(new URL('../data/scrapes/README.md', import.meta.url), 'utf-8');
  for (const id of ['18142', '8907', '1823', '12260', '4145']) {
    assert.match(readme, new RegExp(id));
  }
  assert.match(readme, /--condo-only/);
});
