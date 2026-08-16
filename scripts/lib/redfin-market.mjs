/**
 * Shared helpers for Redfin GIS bulk scrapes (US multi-state).
 *
 * Region type codes: 6 = city, 2 = ZIP, 5 = county, 4 = metro.
 * Condo uiPropertyType: 2.
 */

export const PROPERTY_TYPE_BY_UI = {
  1: 'single_family',
  2: 'condo',
  3: 'townhouse',
  4: 'multi_family',
  5: 'land',
  6: 'mobile',
  7: 'co_op',
  8: 'other',
};

export const CONDO_UI_PROPERTY_TYPE = 2;

/** USPS state abbreviations accepted by --state / mapHome. */
export const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

/**
 * Parse CLI args for scrape-redfin-market.mjs.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const args = {
    market: null,
    marketArea: null,
    output: null,
    marketParam: 'florida',
    regions: [],
    notes: '',
    states: ['FL'],
    condoOnly: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--market' && value) {
      args.market = value;
      i += 1;
    } else if (flag === '--market-area' && value) {
      args.marketArea = value;
      i += 1;
    } else if (flag === '--output' && value) {
      args.output = value;
      i += 1;
    } else if (flag === '--market-param' && value) {
      args.marketParam = value;
      i += 1;
    } else if (flag === '--notes' && value) {
      args.notes = value;
      i += 1;
    } else if (flag === '--state' && value) {
      args.states = value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      i += 1;
    } else if (flag === '--condo-only') {
      args.condoOnly = true;
    } else if (flag === '--regions' && value) {
      for (const part of value.split(',')) {
        const [id, type = '6'] = part.split(':');
        if (!id) continue;
        args.regions.push({ id, type, label: `${id}-region` });
      }
      i += 1;
    }
  }

  for (const state of args.states) {
    if (!US_STATE_CODES.has(state)) {
      throw new Error(`Invalid US state code: ${state}`);
    }
  }

  if (!args.market || !args.marketArea || !args.output || !args.regions.length) {
    throw new Error('Required: --market --market-area --regions ID:TYPE --output');
  }

  return args;
}

/**
 * Build Redfin GIS query params.
 */
export function buildGisParams({ regionId, regionType, start, market, condoOnly = false }) {
  const params = {
    al: '1',
    market,
    num_homes: '350',
    start: String(start),
    page_number: '1',
    region_id: String(regionId),
    region_type: String(regionType),
    sf: '1,2,3,5,6,7',
    status: '9',
    uipt: condoOnly ? String(CONDO_UI_PROPERTY_TYPE) : '1,2,3,4,5,6,7,8',
    v: '8',
    ord: 'redfin-recommended-asc',
  };
  return new URLSearchParams(params);
}

/**
 * Map a Redfin GIS home payload to the scrape listing schema.
 * Returns null when the home should be skipped (wrong state / non-condo).
 *
 * @param {object} home
 * @param {{ marketArea: string, sourceLabel: string, allowedStates: string[], condoOnly?: boolean }} opts
 */
export function mapHome(home, { marketArea, sourceLabel, allowedStates, condoOnly = false }) {
  const state = String(home.state || allowedStates[0] || 'FL').toUpperCase();
  if (!allowedStates.includes(state)) return null;

  const uiType = home.uiPropertyType ?? home.propertyType;
  const propertyType = PROPERTY_TYPE_BY_UI[uiType] || 'other';
  if (condoOnly && propertyType !== 'condo') return null;

  const listingUrl = home.url?.startsWith('http')
    ? home.url
    : `https://www.redfin.com${home.url || ''}`;

  return {
    address: home.streetLine?.value || 'Unknown address',
    city: home.city || 'Unknown',
    zip: home.zip || home.postalCode?.value || undefined,
    asking_price: home.price?.value ?? null,
    beds: home.beds ?? null,
    baths: home.baths ?? null,
    sqft: home.sqFt?.value ?? null,
    hoa_monthly: home.hoa?.value ?? null,
    property_type: propertyType,
    year_built: home.yearBuilt?.value ?? null,
    days_on_market: home.dom?.value ?? null,
    mls_id: home.mlsId?.value || String(home.propertyId || home.listingId || ''),
    listing_url: listingUrl,
    lat: home.latLong?.value?.latitude ?? null,
    lng: home.latLong?.value?.longitude ?? null,
    market_area: marketArea,
    source_zips: [sourceLabel],
    state,
  };
}

/**
 * Merge regional listing maps by MLS id, unioning source_zips.
 * @param {Map<string, object>} target
 * @param {Map<string, object>} source
 */
export function mergeListingMaps(target, source) {
  for (const [mlsId, listing] of source) {
    if (target.has(mlsId)) {
      const existing = target.get(mlsId);
      existing.source_zips = [...new Set([...existing.source_zips, ...listing.source_zips])];
    } else {
      target.set(mlsId, listing);
    }
  }
  return target;
}

/**
 * Build the scrape JSON envelope matching existing data/scrapes files.
 */
export function buildScrapePayload({
  market,
  scrapedAt,
  notes,
  listings,
  condoOnly = false,
  states = [],
}) {
  const stateNote = states.length ? ` states=${states.join(',')}` : '';
  const condoNote = condoOnly ? ' condo-only;' : '';
  return {
    source: 'redfin',
    market,
    scraped_at: scrapedAt,
    status_filter: 'active_for_sale',
    notes:
      notes ||
      `Redfin bulk scrape for ${market};${condoNote}${stateNote} deduped by MLS.`,
    count: listings.length,
    listings,
  };
}
