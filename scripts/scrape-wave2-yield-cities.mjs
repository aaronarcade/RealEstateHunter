#!/usr/bin/env node

/**
 * Wave 2: scrape 10 non-US yield cities into data/scrapes/*-active-listings-2026-08-10.json
 *
 * Usage: node scripts/scrape-wave2-yield-cities.mjs [--city slug] [--max-listings N]
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRAPER = join(REPO_ROOT, 'scripts/scrape-international-market.mjs');
const DATE_SUFFIX = '2026-08-10';

const CITIES = [
  {
    slug: 'tbilisi-ge',
    marketArea: 'tbilisi',
    source: 'ssge',
    url: 'https://home.ss.ge/en/real-estate/l/Flat/For-Sale/Tbilisi',
    city: 'Tbilisi',
    state: 'Tbilisi',
    country: 'Georgia',
    currency: 'USD',
    maxListings: 500,
    notes: 'Yield evidence: Global Property Guide / expat forums cite 10-14% gross on Tbilisi LTR condos. Source: ss.ge flats for sale (USD prices).',
  },
  {
    slug: 'budapest-hu',
    source: 'realtor_graphql',
    marketArea: 'budapest',
    countryCode: 'hu',
    where: 'budapest',
    city: 'Budapest',
    state: 'Budapest',
    country: 'Hungary',
    currency: 'HUF',
    maxListings: 500,
    notes: 'Yield evidence: Central EU gross yields often 8-12%+ in Budapest districts (Global Property Guide, Numbeo). Source: Realtor.com International GraphQL.',
  },
  {
    slug: 'bucharest-ro',
    source: 'realtor_graphql',
    marketArea: 'bucharest',
    countryCode: 'ro',
    where: 'bucharest',
    city: 'Bucharest',
    state: 'Bucharest',
    country: 'Romania',
    currency: 'EUR',
    maxListings: 500,
    notes: 'Yield evidence: Bucharest gross yields among highest in EU (~8-10%+). Source: Realtor.com International GraphQL.',
  },
  {
    slug: 'medellin-co',
    source: 'realtor_graphql',
    marketArea: 'medellin',
    countryCode: 'co',
    where: 'medellin',
    city: 'Medellín',
    state: 'Antioquia',
    country: 'Colombia',
    currency: 'COP',
    maxListings: 1000,
    notes: 'Yield evidence: El Poblado/Laureles STR/LTR expat market; 8-12% gross common (Properati/FincaRaíz comps). Source: Realtor.com International GraphQL.',
  },
  {
    slug: 'panama-city-pa',
    source: 'realtor_graphql',
    marketArea: 'panama-city-pa',
    countryCode: 'pa',
    where: 'panama-city',
    city: 'Panama City',
    state: 'Panamá',
    country: 'Panama',
    currency: 'USD',
    maxListings: 1000,
    notes: 'Yield evidence: USD economy; Costa del Este/Punta Pacifica condo gross yields 7-10%+. Source: Realtor.com International GraphQL.',
  },
  {
    slug: 'manila-ph',
    source: 'realtor_graphql',
    marketArea: 'manila',
    countryCode: 'ph',
    where: 'manila',
    city: 'Manila',
    state: 'Metro Manila',
    country: 'Philippines',
    currency: 'PHP',
    maxListings: 100,
    notes: 'Yield evidence: Metro Manila condo rental gross yields often 10%+ (Numbeo, Lamudi). Small inventory on Realtor intl (~18). Source: Realtor.com International GraphQL.',
  },
  {
    slug: 'chiang-mai-th',
    source: 'realtor_graphql',
    marketArea: 'chiang-mai',
    countryCode: 'th',
    where: 'chiang-mai',
    city: 'Chiang Mai',
    state: 'Chiang Mai',
    country: 'Thailand',
    currency: 'THB',
    maxListings: 1000,
    notes: 'Yield evidence: Nomad/LTR hub; gross yields in viable range per Global Property Guide / DotProperty comps. Source: Realtor.com International GraphQL.',
  },
  {
    slug: 'bali-id',
    source: 'realtor_graphql',
    marketArea: 'bali',
    countryCode: 'id',
    where: 'bali',
    city: 'Bali',
    state: 'Bali',
    country: 'Indonesia',
    currency: 'USD',
    maxListings: 1000,
    notes: 'Yield evidence: Seminyak/Canggu STR gross can exceed 10% on paper (FazWaz, DotProperty). Source: Realtor.com International GraphQL.',
  },
  {
    slug: 'krakow-pl',
    source: 'realtor_graphql',
    marketArea: 'krakow',
    countryCode: 'pl',
    where: 'malopolskie',
    filterCity: 'krakow',
    city: 'Kraków',
    state: 'Małopolskie',
    country: 'Poland',
    currency: 'EUR',
    maxListings: 500,
    notes: 'Yield evidence: EU yield play; Kraków gross 7-10%+ (Global Property Guide). Realtor krakow slug returns empty listings — scraped Małopolskie filtered to Kraków city.',
  },
  {
    slug: 'playa-del-carmen-mx',
    source: 'realtor_graphql',
    marketArea: 'playa-del-carmen',
    countryCode: 'mx',
    where: 'playa-del-carmen',
    city: 'Playa del Carmen',
    state: 'Quintana Roo',
    country: 'Mexico',
    currency: 'MXN',
    maxListings: 1000,
    notes: 'Yield evidence: Riviera Maya STR tourism gross yields (Properati/Inmuebles24 comps). Source: Realtor.com International GraphQL.',
  },
];

function runScrape(city, maxListingsOverride) {
  const output = `data/scrapes/${city.slug}-active-listings-${DATE_SUFFIX}.json`;
  const maxListings = maxListingsOverride ?? city.maxListings;
  const args = [
    SCRAPER,
    '--source', city.source,
    '--market', city.slug,
    '--market-area', city.marketArea,
    '--output', output,
    '--notes', city.notes,
    '--currency', city.currency,
    '--city', city.city,
    '--state', city.state,
    '--country', city.country,
    '--max-listings', String(maxListings),
  ];

  if (city.url) args.push('--url', city.url);
  if (city.countryCode) args.push('--country-code', city.countryCode);
  if (city.where) args.push('--where', city.where);
  if (city.filterCity) args.push('--filter-city', city.filterCity);

  return new Promise((resolve, reject) => {
    console.log(`\n=== ${city.slug} (${city.source}) ===`);
    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve({ slug: city.slug, output });
      else reject(new Error(`${city.slug} failed with exit ${code}`));
    });
  });
}

async function main() {
  const cityArgIndex = process.argv.indexOf('--city');
  const onlyCity = cityArgIndex >= 0 ? process.argv[cityArgIndex + 1] : null;
  const maxArgIndex = process.argv.indexOf('--max-listings');
  const maxListings = maxArgIndex >= 0 ? Number(process.argv[maxArgIndex + 1]) : null;

  const selected = onlyCity
    ? CITIES.filter((c) => c.slug === onlyCity || c.marketArea === onlyCity)
    : CITIES;

  if (!selected.length) {
    console.error(`Unknown city: ${onlyCity}`);
    process.exit(1);
  }

  const results = [];
  for (const city of selected) {
    results.push(await runScrape(city, maxListings));
  }

  console.log('\nWave 2 complete:');
  for (const r of results) console.log(`  ${r.slug} -> ${r.output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
