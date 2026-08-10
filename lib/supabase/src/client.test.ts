import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rowToOpportunity, opportunityToRow, deriveConfidence, deriveSources } from './mapper.js';
import type { PropertyRow, PropertyOpportunity, FieldValue } from './types.js';

const mockFieldValue = (value: number | null, status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' = 'VERIFIED', confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'): FieldValue => ({
  value,
  status,
  confidence,
  source: 'https://example.com',
  evidence: 'Test evidence',
});

const mockPropertyRow: PropertyRow = {
  id: '_example',
  address: '123 Example St, Tampa, FL 33602',
  location: 'Tampa, FL',
  listing_url: 'https://example.com/listing/123',
  purchase_price: mockFieldValue(200000),
  monthly_rent: mockFieldValue(2200, 'ESTIMATED', 'MEDIUM'),
  annual_gross_rent: 26400,
  annual_operating_expenses: 12572,
  noi: 13828,
  cap_rate: 0.0691,
  hoa: mockFieldValue(485),
  assessment: mockFieldValue(0),
  confidence: 'MEDIUM',
  status: 'REJECTED',
  workflow_state: 'PUBLISHED',
  sources: [{ label: 'Listing', url: 'https://example.com/listing/123' }],
  ranked_at: '2026-08-09T18:00:00Z',
};

const mockOpportunity: PropertyOpportunity = {
  id: '_example',
  address: '123 Example St, Tampa, FL 33602',
  location: 'Tampa, FL',
  listingUrl: 'https://example.com/listing/123',
  purchasePrice: mockFieldValue(200000),
  monthlyRent: mockFieldValue(2200, 'ESTIMATED', 'MEDIUM'),
  annualGrossRent: 26400,
  annualOperatingExpenses: 12572,
  noi: 13828,
  capRate: 0.0691,
  hoa: mockFieldValue(485),
  assessment: mockFieldValue(0),
  confidence: 'MEDIUM',
  status: 'REJECTED',
  sources: [{ label: 'Listing', url: 'https://example.com/listing/123' }],
  rankedAt: '2026-08-09T18:00:00Z',
};

describe('mapper', () => {
  describe('rowToOpportunity', () => {
    it('should convert a Supabase row to PropertyOpportunity', () => {
      const result = rowToOpportunity(mockPropertyRow);

      expect(result.id).toBe('_example');
      expect(result.address).toBe('123 Example St, Tampa, FL 33602');
      expect(result.location).toBe('Tampa, FL');
      expect(result.listingUrl).toBe('https://example.com/listing/123');
      expect(result.purchasePrice.value).toBe(200000);
      expect(result.monthlyRent.value).toBe(2200);
      expect(result.annualGrossRent).toBe(26400);
      expect(result.annualOperatingExpenses).toBe(12572);
      expect(result.noi).toBe(13828);
      expect(result.capRate).toBe(0.0691);
      expect(result.hoa.value).toBe(485);
      expect(result.assessment.value).toBe(0);
      expect(result.confidence).toBe('MEDIUM');
      expect(result.status).toBe('REJECTED');
      expect(result.rankedAt).toBe('2026-08-09T18:00:00Z');
    });

    it('should handle missing optional fields', () => {
      const minimalRow: PropertyRow = {
        id: 'minimal',
        address: '123 Test St',
        location: 'Test City',
        listing_url: 'https://example.com',
        purchase_price: mockFieldValue(100000),
        monthly_rent: mockFieldValue(1000),
        annual_gross_rent: 12000,
        annual_operating_expenses: 4000,
        noi: 8000,
        cap_rate: 0.08,
        hoa: mockFieldValue(0),
        assessment: mockFieldValue(0),
        confidence: 'HIGH',
        status: 'WATCHLIST',
        workflow_state: 'RANKED',
      };

      const result = rowToOpportunity(minimalRow);

      expect(result.id).toBe('minimal');
      expect(result.sources).toBeUndefined();
      expect(result.rankedAt).toBeUndefined();
    });
  });

  describe('opportunityToRow', () => {
    it('should convert a PropertyOpportunity to Supabase row', () => {
      const result = opportunityToRow(mockOpportunity);

      expect(result.id).toBe('_example');
      expect(result.listing_url).toBe('https://example.com/listing/123');
      expect(result.purchase_price.value).toBe(200000);
      expect(result.monthly_rent.value).toBe(2200);
      expect(result.workflow_state).toBe('PUBLISHED');
    });

    it('should use custom workflow state', () => {
      const result = opportunityToRow(mockOpportunity, 'RANKED');

      expect(result.workflow_state).toBe('RANKED');
    });
  });

  describe('deriveConfidence', () => {
    it('should return minimum confidence across fields', () => {
      expect(deriveConfidence(
        mockFieldValue(100, 'VERIFIED', 'HIGH'),
        mockFieldValue(100, 'VERIFIED', 'HIGH'),
        mockFieldValue(100, 'VERIFIED', 'HIGH')
      )).toBe('HIGH');

      expect(deriveConfidence(
        mockFieldValue(100, 'VERIFIED', 'HIGH'),
        mockFieldValue(100, 'ESTIMATED', 'MEDIUM'),
        mockFieldValue(100, 'VERIFIED', 'HIGH')
      )).toBe('MEDIUM');

      expect(deriveConfidence(
        mockFieldValue(100, 'VERIFIED', 'HIGH'),
        mockFieldValue(100, 'ESTIMATED', 'MEDIUM'),
        mockFieldValue(100, 'UNKNOWN', 'LOW')
      )).toBe('LOW');
    });

    it('should return LOW when no fields provided', () => {
      expect(deriveConfidence(undefined, undefined, undefined)).toBe('LOW');
    });

    it('should handle partial fields', () => {
      expect(deriveConfidence(
        mockFieldValue(100, 'VERIFIED', 'HIGH'),
        undefined,
        undefined
      )).toBe('HIGH');
    });
  });

  describe('deriveSources', () => {
    it('should extract unique sources from fields', () => {
      const sources = deriveSources(
        { value: 100, status: 'VERIFIED', confidence: 'HIGH', source: 'https://example.com/listing' },
        { value: 100, status: 'VERIFIED', confidence: 'HIGH', source: 'Rent comps' },
        { value: 100, status: 'VERIFIED', confidence: 'HIGH', source: 'https://example.com/hoa' }
      );

      expect(sources).toHaveLength(3);
      expect(sources[0]).toEqual({ label: 'Purchase Price', url: 'https://example.com/listing' });
      expect(sources[1]).toEqual({ label: 'Rent comps', url: undefined });
      expect(sources[2]).toEqual({ label: 'HOA', url: 'https://example.com/hoa' });
    });

    it('should deduplicate sources by URL', () => {
      const sources = deriveSources(
        { value: 100, status: 'VERIFIED', confidence: 'HIGH', source: 'https://example.com/listing' },
        { value: 100, status: 'VERIFIED', confidence: 'HIGH', source: 'https://example.com/listing' },
        { value: 100, status: 'VERIFIED', confidence: 'HIGH', source: 'https://example.com/listing' }
      );

      expect(sources).toHaveLength(1);
    });

    it('should return empty array when no sources', () => {
      const sources = deriveSources(undefined, undefined, undefined);
      expect(sources).toEqual([]);
    });
  });
});

describe('SupabaseClient', () => {
  describe('constructor', () => {
    it('should throw if SUPABASE_URL is not provided', async () => {
      const originalUrl = process.env.SUPABASE_URL;
      const originalAnon = process.env.SUPABASE_ANON_KEY;
      const originalService = process.env.SUPABASE_SERVICE_ROLE_KEY;

      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const { SupabaseClient } = await import('./client.js');

      expect(() => new SupabaseClient()).toThrow('SUPABASE_URL is required');

      process.env.SUPABASE_URL = originalUrl;
      process.env.SUPABASE_ANON_KEY = originalAnon;
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalService;
    });

    it('should throw if no key is provided', async () => {
      const originalAnon = process.env.SUPABASE_ANON_KEY;
      const originalService = process.env.SUPABASE_SERVICE_ROLE_KEY;

      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const { SupabaseClient } = await import('./client.js');

      expect(() => new SupabaseClient({ url: 'https://test.supabase.co' })).toThrow('Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required');

      process.env.SUPABASE_ANON_KEY = originalAnon;
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalService;
    });
  });
});
