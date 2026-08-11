import { describe, expect, it } from 'vitest';
import {
  computeEstimatedCapRate,
  metaToReviewedListing,
  parseLocation,
  screeningRejectToReviewedListing,
} from './reviewed-listing.js';
import type { PropertyMeta } from './types.js';

const MARKETS = [
  { id: 'panama-city-beach-fl', name: 'Panama City Beach, FL' },
  { id: 'manta-ec', name: 'Manta, Ecuador' },
  { id: 'cuenca-ecuador', name: 'Cuenca, Ecuador' },
];

describe('computeEstimatedCapRate', () => {
  it('uses HOA-adjusted rent when HOA is known', () => {
    const rate = computeEstimatedCapRate({
      asking_price: 199000,
      estimated_monthly_rent: 1300,
      hoa_monthly: 369,
    });
    expect(rate).toBeCloseTo(((1300 - 369) * 12) / 199000, 5);
  });

  it('falls back to gross yield when HOA is missing', () => {
    const rate = computeEstimatedCapRate({
      asking_price: 200000,
      estimated_monthly_rent: 1800,
    });
    expect(rate).toBeCloseTo(0.108, 5);
  });

  it('returns undefined when rent is missing', () => {
    expect(
      computeEstimatedCapRate({
        asking_price: 200000,
      }),
    ).toBeUndefined();
  });
});

describe('parseLocation', () => {
  it('parses US market ids', () => {
    expect(
      parseLocation({
        market_id: 'panama-city-beach-fl',
        markets: MARKETS,
      }),
    ).toEqual({
      city: 'Panama City Beach',
      country: 'United States',
      region: 'FL',
    });
  });

  it('parses Ecuador market ids', () => {
    expect(
      parseLocation({
        market_id: 'manta-ec',
        location: 'Manta, Manabí, Ecuador',
        markets: MARKETS,
      }),
    ).toEqual({
      city: 'Manta',
      country: 'Ecuador',
      region: 'Manabí',
    });
  });

  it('parses free-form location strings', () => {
    expect(
      parseLocation({
        location: 'Cuenca, Azuay, Ecuador',
      }),
    ).toEqual({
      city: 'Cuenca',
      country: 'Ecuador',
      region: 'Azuay',
    });
  });
});

describe('metaToReviewedListing', () => {
  it('maps archived scout meta into a reviewed listing', () => {
    const meta: PropertyMeta = {
      id: 'poseidon-unit-7f-barbasquillo-manta-ec',
      address: 'Poseidon Building Unit 7F, Barbasquillo, Manta, Manabí, Ecuador',
      location: 'Manta, Manabí, Ecuador',
      listing_url: 'https://example.com/listing',
      workflow_state: 'ARCHIVED',
      scout_decision: 'REJECT',
      asking_price: 199000,
      rough_monthly_rent: 1300,
      rough_gross_yield: 0.0784,
      advertised_hoa: 369,
      market_id: 'manta-ec',
      beds: 2,
      baths: 2,
      property_type: 'condo',
      scout_notes: 'Yield too low',
      last_screened_at: '2026-08-10T05:00:00Z',
      created_at: '2026-08-10T05:00:00Z',
      updated_at: '2026-08-10T05:00:00Z',
    };

    const listing = metaToReviewedListing(meta, { markets: MARKETS });
    expect(listing.id).toBe(meta.id);
    expect(listing.city).toBe('Manta');
    expect(listing.country).toBe('Ecuador');
    expect(listing.scout_decision).toBe('REJECT');
    expect(listing.estimated_cap_rate).toBeCloseTo(((1300 - 369) * 12) / 199000, 5);
    expect(listing.notes).toBe('Yield too low');
  });
});

describe('screeningRejectToReviewedListing', () => {
  it('derives monthly rent from gross yield when needed', () => {
    const listing = screeningRejectToReviewedListing(
      {
        listing_url: 'https://example.com/reject',
        address: '4114 Holiday Drive #15, Panama City Beach, FL 32408',
        price: 145000,
        rough_gross_yield: 0.176,
        reason: 'Fails beds filter',
        market_id: 'panama-city-beach-fl',
      },
      { markets: MARKETS, reviewed_at: '2026-08-10T04:00:00Z' },
    );

    expect(listing.city).toBe('Panama City Beach');
    expect(listing.country).toBe('United States');
    expect(listing.estimated_monthly_rent).toBeCloseTo((0.176 * 145000) / 12, 2);
    expect(listing.notes).toBe('Fails beds filter');
  });
});
