import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseOpportunityRow } from './supabase'

const mockSupabaseData: SupabaseOpportunityRow[] = [
  {
    id: 'test-property-1',
    address: '123 Test St, Tampa, FL 33602',
    location: 'Tampa, FL',
    listing_url: 'https://example.com/listing/123',
    purchase_price: 200000,
    purchase_price_status: 'VERIFIED',
    purchase_price_confidence: 'HIGH',
    purchase_price_source: 'https://example.com/listing/123',
    purchase_price_evidence: 'Listing price',
    monthly_rent: 2200,
    monthly_rent_status: 'ESTIMATED',
    monthly_rent_confidence: 'MEDIUM',
    monthly_rent_source: 'Rent comps',
    monthly_rent_evidence: 'Based on nearby rentals',
    monthly_rent_range_low: 2000,
    monthly_rent_range_high: 2400,
    annual_gross_rent: 26400,
    annual_operating_expenses: 12572,
    noi: 13828,
    cap_rate: 0.0691,
    hoa_monthly: 485,
    hoa_monthly_status: 'VERIFIED',
    hoa_monthly_confidence: 'HIGH',
    hoa_monthly_source: 'Listing',
    hoa_monthly_evidence: 'Stated in listing',
    special_assessments: 0,
    special_assessments_status: 'VERIFIED',
    special_assessments_confidence: 'HIGH',
    special_assessments_source: 'HOA docs',
    special_assessments_evidence: 'No assessments',
    confidence: 'MEDIUM',
    status: 'VIABLE',
    sources: [{ label: 'Listing', url: 'https://example.com/listing/123' }],
    ranked_at: '2026-08-09T12:00:00Z',
  },
]

const mockSelectReturn = {
  order: vi.fn().mockResolvedValue({ data: mockSupabaseData, error: null }),
}

const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue(mockSelectReturn),
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

describe('supabase module', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  describe('isSupabaseConfigured', () => {
    it('returns true when both URL and key are set', async () => {
      const { isSupabaseConfigured } = await import('./supabase')
      expect(isSupabaseConfigured()).toBe(true)
    })

    it('returns false when URL is missing', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '')
      vi.resetModules()
      const { isSupabaseConfigured } = await import('./supabase')
      expect(isSupabaseConfigured()).toBe(false)
    })

    it('returns false when key is missing', async () => {
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
      vi.resetModules()
      const { isSupabaseConfigured } = await import('./supabase')
      expect(isSupabaseConfigured()).toBe(false)
    })
  })

  describe('transformSupabaseRow', () => {
    it('transforms a Supabase row to PropertyOpportunity', async () => {
      const { transformSupabaseRow } = await import('./supabase')
      const result = transformSupabaseRow(mockSupabaseData[0])

      expect(result.id).toBe('test-property-1')
      expect(result.address).toBe('123 Test St, Tampa, FL 33602')
      expect(result.location).toBe('Tampa, FL')
      expect(result.listingUrl).toBe('https://example.com/listing/123')

      expect(result.purchasePrice).toEqual({
        value: 200000,
        status: 'VERIFIED',
        confidence: 'HIGH',
        source: 'https://example.com/listing/123',
        evidence: 'Listing price',
      })

      expect(result.monthlyRent).toEqual({
        value: 2200,
        status: 'ESTIMATED',
        confidence: 'MEDIUM',
        source: 'Rent comps',
        evidence: 'Based on nearby rentals',
        range_low: 2000,
        range_high: 2400,
      })

      expect(result.noi).toBe(13828)
      expect(result.capRate).toBe(0.0691)
      expect(result.status).toBe('VIABLE')
      expect(result.confidence).toBe('MEDIUM')
      expect(result.rankedAt).toBe('2026-08-09T12:00:00Z')
    })
  })

  describe('fetchOpportunitiesFromSupabase', () => {
    it('fetches and transforms opportunities from Supabase', async () => {
      const { fetchOpportunitiesFromSupabase, resetSupabaseClient } = await import('./supabase')
      resetSupabaseClient()

      const result = await fetchOpportunitiesFromSupabase()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('test-property-1')
      expect(result[0].status).toBe('VIABLE')
    })

    it('returns empty array when Supabase is not configured', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
      vi.resetModules()

      const { fetchOpportunitiesFromSupabase } = await import('./supabase')
      const result = await fetchOpportunitiesFromSupabase()

      expect(result).toEqual([])
    })

    it('returns empty array on Supabase error', async () => {
      mockSelectReturn.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      })
      vi.resetModules()

      const { fetchOpportunitiesFromSupabase, resetSupabaseClient } = await import('./supabase')
      resetSupabaseClient()

      const result = await fetchOpportunitiesFromSupabase()
      expect(result).toEqual([])
    })

    it('returns empty array when no data', async () => {
      mockSelectReturn.order.mockResolvedValueOnce({
        data: [],
        error: null,
      })
      vi.resetModules()

      const { fetchOpportunitiesFromSupabase, resetSupabaseClient } = await import('./supabase')
      resetSupabaseClient()

      const result = await fetchOpportunitiesFromSupabase()
      expect(result).toEqual([])
    })
  })
})
