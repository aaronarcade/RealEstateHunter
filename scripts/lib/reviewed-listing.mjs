import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildValidator } from './validator.mjs';

const US_STATE_SUFFIXES = {
  fl: 'FL',
  al: 'AL',
  tn: 'TN',
  oh: 'OH',
};

const ECUADOR_MARKET_CITIES = {
  'manta-ec': 'Manta',
  'cuenca-ecuador': 'Cuenca',
  'quito-ec': 'Quito',
};

export function computeEstimatedCapRate(input) {
  const { asking_price, estimated_monthly_rent, hoa_monthly } = input;
  if (!asking_price || asking_price <= 0 || !estimated_monthly_rent) {
    return undefined;
  }

  if (hoa_monthly != null && hoa_monthly >= 0) {
    return ((estimated_monthly_rent - hoa_monthly) * 12) / asking_price;
  }

  return (estimated_monthly_rent * 12) / asking_price;
}

function parseCityFromMarketName(name) {
  const commaIndex = name.indexOf(',');
  if (commaIndex === -1) {
    return name.replace(/\s*\(.*\)\s*$/, '').trim();
  }
  return name.slice(0, commaIndex).trim();
}

function parseLocationFromString(location) {
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const last = parts[parts.length - 1].toLowerCase();
  if (last === 'ecuador') {
    return {
      city: parts[0],
      country: 'Ecuador',
      region: parts.length > 2 ? parts[1] : undefined,
    };
  }

  if (parts.length >= 2 && /^[A-Z]{2}$/.test(parts[parts.length - 1])) {
    return {
      city: parts[0],
      country: 'United States',
      region: parts[parts.length - 1],
    };
  }

  return {
    city: parts[0],
    country: parts[parts.length - 1],
    region: parts.length > 2 ? parts.slice(1, -1).join(', ') : undefined,
  };
}

export function parseLocation(input) {
  const markets = input.markets ?? [];
  const market = input.market_id
    ? markets.find((entry) => entry.id === input.market_id)
    : undefined;

  if (market) {
    const marketId = market.id;
    if (marketId.endsWith('-ec') || marketId.includes('ecuador')) {
      return {
        city: ECUADOR_MARKET_CITIES[marketId] ?? parseCityFromMarketName(market.name),
        country: 'Ecuador',
        region: input.location?.split(',')[1]?.trim(),
      };
    }

    const suffix = marketId.split('-').pop()?.toLowerCase();
    if (suffix && US_STATE_SUFFIXES[suffix]) {
      return {
        city: parseCityFromMarketName(market.name),
        country: 'United States',
        region: US_STATE_SUFFIXES[suffix],
      };
    }
  }

  if (input.market_id?.endsWith('-ec')) {
    return {
      city: ECUADOR_MARKET_CITIES[input.market_id] ?? 'Unknown',
      country: 'Ecuador',
    };
  }

  if (input.location) {
    const parsed = parseLocationFromString(input.location);
    if (parsed) {
      return parsed;
    }
  }

  return {
    city: 'Unknown',
    country: 'Unknown',
  };
}

export function generateId(address) {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

export function metaToReviewedListing(meta, options = {}) {
  const location = parseLocation({
    location: meta.location,
    market_id: meta.market_id,
    address: meta.address,
    markets: options.markets,
  });

  const askingPrice = meta.asking_price ?? meta.screening_snapshot?.price ?? 0;
  const estimatedMonthlyRent =
    meta.rough_monthly_rent ?? meta.screening_snapshot?.rough_monthly_rent;
  const hoaMonthly =
    meta.advertised_hoa ?? meta.screening_snapshot?.advertised_hoa ?? undefined;
  const roughGrossYield =
    meta.rough_gross_yield ?? meta.screening_snapshot?.rough_gross_yield;

  return {
    id: meta.id,
    address: meta.address,
    city: location.city,
    country: location.country,
    region: location.region,
    listing_url: meta.listing_url,
    asking_price: askingPrice,
    estimated_cap_rate: computeEstimatedCapRate({
      asking_price: askingPrice,
      estimated_monthly_rent: estimatedMonthlyRent,
      hoa_monthly: hoaMonthly,
    }),
    rough_gross_yield: roughGrossYield,
    estimated_monthly_rent: estimatedMonthlyRent,
    hoa_monthly: hoaMonthly ?? undefined,
    beds: meta.beds,
    baths: meta.baths,
    property_type: meta.property_type,
    market_id: meta.market_id,
    scout_decision: 'REJECT',
    reviewed_at:
      meta.last_screened_at ??
      meta.updated_at ??
      meta.created_at ??
      new Date().toISOString(),
    notes: options.notes ?? meta.scout_notes,
  };
}

export function screeningRejectToReviewedListing(reject, options = {}) {
  const id = generateId(reject.address);
  const location = parseLocation({
    address: reject.address,
    market_id: reject.market_id,
    markets: options.markets,
  });

  const estimatedMonthlyRent =
    reject.estimated_monthly_rent ??
    (reject.rough_gross_yield && reject.price
      ? (reject.rough_gross_yield * reject.price) / 12
      : undefined);

  return {
    id,
    address: reject.address,
    city: location.city,
    country: location.country,
    region: location.region,
    listing_url: reject.listing_url,
    asking_price: reject.price,
    estimated_cap_rate: computeEstimatedCapRate({
      asking_price: reject.price,
      estimated_monthly_rent: estimatedMonthlyRent,
      hoa_monthly: reject.hoa_monthly,
    }),
    rough_gross_yield: reject.rough_gross_yield,
    estimated_monthly_rent: estimatedMonthlyRent,
    hoa_monthly: reject.hoa_monthly,
    market_id: reject.market_id,
    scout_decision: 'REJECT',
    reviewed_at: options.reviewed_at ?? new Date().toISOString(),
    notes: reject.reason,
  };
}

export function readReviewedListings(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8').trim();
  if (!content) {
    return [];
  }

  const byId = new Map();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const entry = JSON.parse(trimmed);
    byId.set(entry.id, entry);
  }

  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function writeReviewedListings(filePath, entries) {
  const { validate } = buildValidator();

  for (const entry of entries) {
    const { valid, errors } = validate('reviewed-listing.json', entry);
    if (!valid) {
      throw new Error(`Invalid reviewed listing ${entry.id}: ${JSON.stringify(errors)}`);
    }
  }

  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const payload =
    sorted.length > 0 ? sorted.map((item) => JSON.stringify(item)).join('\n') + '\n' : '';
  writeFileSync(filePath, payload, 'utf-8');
}

export function discoverReviewedListingLines(reviewedFilePath) {
  if (!existsSync(reviewedFilePath)) {
    return [];
  }

  const content = readFileSync(reviewedFilePath, 'utf8').trim();
  if (!content) {
    return [];
  }

  return content
    .split('\n')
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0);
}
