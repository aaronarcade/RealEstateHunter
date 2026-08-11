import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getValidator } from './validator.js';
import { PropertyRecordManager } from './property-record.js';
import type { PropertyMeta } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ReviewedScoutDecision = 'REJECT' | 'SKIPPED';

export interface ReviewedListing {
  id: string;
  address: string;
  city: string;
  country: string;
  region?: string;
  listing_url: string;
  asking_price: number;
  estimated_cap_rate?: number;
  rough_gross_yield?: number;
  estimated_monthly_rent?: number;
  hoa_monthly?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  property_type?: string;
  market_id?: string;
  scout_decision: ReviewedScoutDecision;
  reviewed_at: string;
  notes?: string;
}

export interface ParsedLocation {
  city: string;
  country: string;
  region?: string;
}

const US_STATE_SUFFIXES: Record<string, string> = {
  fl: 'FL',
  al: 'AL',
  tn: 'TN',
  oh: 'OH',
};

const ECUADOR_MARKET_CITIES: Record<string, string> = {
  'manta-ec': 'Manta',
  'cuenca-ecuador': 'Cuenca',
  'quito-ec': 'Quito',
};

/**
 * Compute low-fidelity estimated cap rate from scout inputs.
 */
export function computeEstimatedCapRate(input: {
  asking_price: number;
  estimated_monthly_rent?: number;
  hoa_monthly?: number | null;
}): number | undefined {
  const { asking_price, estimated_monthly_rent, hoa_monthly } = input;
  if (!asking_price || asking_price <= 0 || !estimated_monthly_rent) {
    return undefined;
  }

  if (hoa_monthly != null && hoa_monthly >= 0) {
    return ((estimated_monthly_rent - hoa_monthly) * 12) / asking_price;
  }

  return (estimated_monthly_rent * 12) / asking_price;
}

function parseCityFromMarketName(name: string): string {
  const commaIndex = name.indexOf(',');
  if (commaIndex === -1) {
    return name.replace(/\s*\(.*\)\s*$/, '').trim();
  }
  return name.slice(0, commaIndex).trim();
}

function parseLocationFromString(location: string): ParsedLocation | null {
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

/**
 * Derive city, country, and region from market_id and location text.
 */
export function parseLocation(input: {
  location?: string;
  market_id?: string;
  address?: string;
  markets?: Array<{ id: string; name: string }>;
}): ParsedLocation {
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

  if (input.address) {
    const addressParts = input.address.split(',').map((part) => part.trim()).filter(Boolean);
    if (addressParts.length >= 2) {
      const parsed = parseLocationFromString(addressParts.slice(-3).join(', '));
      if (parsed) {
        return parsed;
      }
    }
  }

  return {
    city: 'Unknown',
    country: 'Unknown',
  };
}

export class ReviewedListingStore {
  private filePath: string;
  private validator = getValidator();

  constructor(reviewedFilePath?: string) {
    this.filePath =
      reviewedFilePath ?? resolve(__dirname, '../../../data/reviewed/listings.ndjson');
  }

  getFilePath(): string {
    return this.filePath;
  }

  listReviewedListings(): ReviewedListing[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    const content = readFileSync(this.filePath, 'utf-8').trim();
    if (!content) {
      return [];
    }

    const byId = new Map<string, ReviewedListing>();
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const entry = JSON.parse(trimmed) as ReviewedListing;
      byId.set(entry.id, entry);
    }

    return Array.from(byId.values()).sort((a, b) =>
      b.reviewed_at.localeCompare(a.reviewed_at),
    );
  }

  appendReviewedListing(entry: ReviewedListing): ReviewedListing {
    const validation = this.validator.validateReviewedListing(entry);
    if (!validation.valid) {
      throw new Error(
        `Invalid reviewed listing ${entry.id}: ${JSON.stringify(validation.errors)}`,
      );
    }

    const listings = this.listReviewedListings();
    const byId = new Map(listings.map((item) => [item.id, item]));
    byId.set(entry.id, entry);
    this.writeReviewedListings(Array.from(byId.values()));
    return entry;
  }

  writeReviewedListings(entries: ReviewedListing[]): void {
    for (const entry of entries) {
      const validation = this.validator.validateReviewedListing(entry);
      if (!validation.valid) {
        throw new Error(
          `Invalid reviewed listing ${entry.id}: ${JSON.stringify(validation.errors)}`,
        );
      }
    }

    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
    const payload =
      sorted.length > 0 ? sorted.map((item) => JSON.stringify(item)).join('\n') + '\n' : '';
    writeFileSync(this.filePath, payload, 'utf-8');
  }
}

export function metaToReviewedListing(
  meta: PropertyMeta,
  options?: { markets?: Array<{ id: string; name: string }>; notes?: string },
): ReviewedListing {
  const location = parseLocation({
    location: meta.location,
    market_id: meta.market_id,
    address: meta.address,
    markets: options?.markets,
  });

  const askingPrice =
    meta.asking_price ?? meta.screening_snapshot?.price ?? 0;
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
    notes: options?.notes ?? meta.scout_notes,
  };
}

export function screeningRejectToReviewedListing(
  reject: {
    listing_url: string;
    address: string;
    price: number;
    rough_gross_yield?: number;
    reason?: string;
    estimated_monthly_rent?: number;
    hoa_monthly?: number;
    market_id?: string;
  },
  options?: {
    markets?: Array<{ id: string; name: string }>;
    reviewed_at?: string;
  },
): ReviewedListing {
  const id = PropertyRecordManager.generateId(reject.address);
  const location = parseLocation({
    address: reject.address,
    market_id: reject.market_id,
    markets: options?.markets,
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
    reviewed_at: options?.reviewed_at ?? new Date().toISOString(),
    notes: reject.reason,
  };
}

let _store: ReviewedListingStore | null = null;

export function getReviewedListingStore(reviewedFilePath?: string): ReviewedListingStore {
  if (!_store || reviewedFilePath) {
    _store = new ReviewedListingStore(reviewedFilePath);
  }
  return _store;
}
