/**
 * Shared Redfin GIS bulk-scrape helpers.
 *
 * Region IDs are Redfin city identifiers (region_type=6) from /city/{id}/{ST}/{Name} URLs.
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

/** US ACTIVE markets with zero scout bulk coverage (TASK-015). */
export const US_ACTIVE_MARKETS = [
  {
    id: 'tampa-fl',
    city: 'Tampa',
    state: 'FL',
    marketArea: 'tampa',
    marketParam: 'florida',
    regions: [{ id: '18142', type: '6', label: '18142-region' }],
    redfinUrl: 'https://www.redfin.com/city/18142/FL/Tampa',
  },
  {
    id: 'jacksonville-fl',
    city: 'Jacksonville',
    state: 'FL',
    marketArea: 'jacksonville',
    marketParam: 'florida',
    regions: [{ id: '8907', type: '6', label: '8907-region' }],
    redfinUrl: 'https://www.redfin.com/city/8907/FL/Jacksonville',
  },
  {
    id: 'birmingham-al',
    city: 'Birmingham',
    state: 'AL',
    marketArea: 'birmingham',
    marketParam: 'alabama',
    regions: [{ id: '1823', type: '6', label: '1823-region' }],
    redfinUrl: 'https://www.redfin.com/city/1823/AL/Birmingham',
  },
  {
    id: 'memphis-tn',
    city: 'Memphis',
    state: 'TN',
    marketArea: 'memphis',
    marketParam: 'tennessee',
    regions: [{ id: '12260', type: '6', label: '12260-region' }],
    redfinUrl: 'https://www.redfin.com/city/12260/TN/Memphis',
  },
  {
    id: 'cleveland-oh',
    city: 'Cleveland',
    state: 'OH',
    marketArea: 'cleveland',
    marketParam: 'ohio',
    regions: [{ id: '4145', type: '6', label: '4145-region' }],
    redfinUrl: 'https://www.redfin.com/city/4145/OH/Cleveland',
  },
];

export function parseRedfinArgs(argv) {
  const args = {
    market: null,
    marketArea: null,
    output: null,
    marketParam: 'florida',
    state: 'FL',
    regions: [],
    notes: '',
    condoOnly: false,
    repoRoot: null,
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
    } else if (flag === '--state' && value) {
      args.state = value.toUpperCase();
      i += 1;
    } else if (flag === '--notes' && value) {
      args.notes = value;
      i += 1;
    } else if (flag === '--condo-only') {
      args.condoOnly = true;
    } else if (flag === '--regions' && value) {
      for (const part of value.split(',')) {
        const [id, type = '6'] = part.split(':');
        args.regions.push({ id, type, label: `${id}-region` });
      }
      i += 1;
    }
  }

  return args;
}

export function propertyTypesParam(condoOnly) {
  return condoOnly ? '2' : '1,2,3,4,5,6,7,8';
}

export async function fetchGisBatch({ regionId, regionType, start, market, condoOnly = false, fetchImpl = fetch }) {
  const params = new URLSearchParams({
    al: '1',
    market,
    num_homes: '350',
    start: String(start),
    page_number: '1',
    region_id: String(regionId),
    region_type: String(regionType),
    sf: '1,2,3,5,6,7',
    status: '9',
    uipt: propertyTypesParam(condoOnly),
    v: '8',
    ord: 'redfin-recommended-asc',
  });
  const response = await fetchImpl(`https://www.redfin.com/stingray/api/gis?${params}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  });
  if (!response.ok) {
    throw new Error(`Redfin GIS failed (${response.status}) for region ${regionId}`);
  }
  const text = (await response.text()).replace(/^\{\}&&/, '');
  return JSON.parse(text).payload?.homes ?? [];
}

export function mapHome(home, { marketArea, sourceLabel, state }) {
  const listingState = (home.state || state || '').toUpperCase();
  if (state && listingState && listingState !== state.toUpperCase()) {
    return null;
  }

  const listingUrl = home.url?.startsWith('http') ? home.url : `https://www.redfin.com${home.url}`;
  return {
    address: home.streetLine?.value || 'Unknown address',
    city: home.city || 'Unknown',
    zip: home.zip || home.postalCode?.value || undefined,
    asking_price: home.price?.value ?? null,
    beds: home.beds ?? null,
    baths: home.baths ?? null,
    sqft: home.sqFt?.value ?? null,
    hoa_monthly: home.hoa?.value ?? null,
    property_type:
      PROPERTY_TYPE_BY_UI[home.uiPropertyType] || PROPERTY_TYPE_BY_UI[home.propertyType] || 'other',
    year_built: home.yearBuilt?.value ?? null,
    days_on_market: home.dom?.value ?? null,
    mls_id: home.mlsId?.value || String(home.propertyId || home.listingId || ''),
    listing_url: listingUrl,
    lat: home.latLong?.value?.latitude ?? null,
    lng: home.latLong?.value?.longitude ?? null,
    market_area: marketArea,
    source_zips: [sourceLabel],
    state: listingState || state,
  };
}

export async function scrapeRegion(region, { marketArea, marketParam, state, condoOnly = false, fetchImpl = fetch }) {
  const byMls = new Map();
  for (let start = 0; start <= 15000; start += 350) {
    const batch = await fetchGisBatch({
      regionId: region.id,
      regionType: region.type,
      start,
      market: marketParam,
      condoOnly,
      fetchImpl,
    });
    if (!batch.length) break;

    let added = 0;
    for (const home of batch) {
      const listing = mapHome(home, { marketArea, sourceLabel: region.label, state });
      if (!listing?.listing_url || !listing.mls_id) continue;
      if (!byMls.has(listing.mls_id)) {
        byMls.set(listing.mls_id, listing);
        added += 1;
      }
    }

    if (typeof process !== 'undefined' && process.stdout?.write) {
      console.log(`  region ${region.id} start=${start} batch=${batch.length} added=${added} total=${byMls.size}`);
    }

    if (batch.length < 350 || added === 0) break;
  }
  return byMls;
}

export function mergeRegionalMaps(regionalMaps) {
  const combined = new Map();
  for (const regional of regionalMaps) {
    for (const [mlsId, listing] of regional) {
      if (combined.has(mlsId)) {
        combined.get(mlsId).source_zips = [
          ...new Set([...combined.get(mlsId).source_zips, ...listing.source_zips]),
        ];
      } else {
        combined.set(mlsId, listing);
      }
    }
  }
  return combined;
}

export function buildScrapePayload({ market, listings, scrapedAt, notes, condoOnly = false }) {
  return {
    source: 'redfin',
    market,
    scraped_at: scrapedAt,
    status_filter: 'active_for_sale',
    notes,
    condo_only: condoOnly || undefined,
    count: listings.length,
    listings,
  };
}

export function scrapeDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function defaultOutputPath(repoRoot, marketId, dateStamp = scrapeDateStamp()) {
  return `${repoRoot}/data/scrapes/${marketId}-active-listings-${dateStamp}.json`;
}

export async function scrapeMarketConfig(config, { condoOnly = false, fetchImpl = fetch } = {}) {
  const regionalMaps = [];
  for (const region of config.regions) {
    regionalMaps.push(
      await scrapeRegion(region, {
        marketArea: config.marketArea,
        marketParam: config.marketParam,
        state: config.state,
        condoOnly,
        fetchImpl,
      }),
    );
  }
  return Array.from(mergeRegionalMaps(regionalMaps).values());
}
