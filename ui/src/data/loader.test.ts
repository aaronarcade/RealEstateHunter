import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transformPropertyData, sampleOpportunities, fetchOpportunities } from './loader'

vi.mock('./supabase', () => ({
  isSupabaseConfigured: vi.fn(() => false),
  fetchOpportunitiesFromSupabase: vi.fn(() => Promise.resolve([])),
}))

describe('transformPropertyData', () => {
  const mockMeta = {
    id: 'test-property',
    address: '123 Test St, Tampa, FL 33602',
    location: 'Tampa, FL',
    listing_url: 'https://example.com/listing/123',
    workflow_state: 'AUDIT',
  }

  const mockEvidence = {
    property_id: 'test-property',
    purchase_price: {
      value: 200000,
      status: 'VERIFIED' as const,
      confidence: 'HIGH' as const,
      source: 'https://example.com/listing/123',
      evidence: 'Listing price',
    },
    monthly_rent: {
      value: 2200,
      status: 'ESTIMATED' as const,
      confidence: 'MEDIUM' as const,
      source: 'Rent comps',
      evidence: 'Based on nearby rentals',
    },
    hoa_monthly: {
      value: 485,
      status: 'VERIFIED' as const,
      confidence: 'HIGH' as const,
      source: 'Listing',
      evidence: 'Stated in listing',
    },
    special_assessments: {
      value: 0,
      status: 'VERIFIED' as const,
      confidence: 'HIGH' as const,
      source: 'HOA docs',
      evidence: 'No assessments',
    },
  }

  const mockUnderwriting = {
    property_id: 'test-property',
    annual_gross_rent: 26400,
    annual_operating_expenses: 12572,
    noi: 13828,
    cap_rate: 0.0691,
    proposed_status: 'REJECTED' as const,
  }

  it('transforms property data correctly', () => {
    const result = transformPropertyData(mockMeta, mockEvidence, mockUnderwriting)

    expect(result.id).toBe('test-property')
    expect(result.address).toBe('123 Test St, Tampa, FL 33602')
    expect(result.location).toBe('Tampa, FL')
    expect(result.listingUrl).toBe('https://example.com/listing/123')
    expect(result.purchasePrice.value).toBe(200000)
    expect(result.monthlyRent.value).toBe(2200)
    expect(result.noi).toBe(13828)
    expect(result.capRate).toBe(0.0691)
    expect(result.status).toBe('REJECTED')
  })

  it('uses audit final_status when available', () => {
    const mockAudit = {
      property_id: 'test-property',
      result: 'PASS' as const,
      final_status: 'WATCHLIST' as const,
    }

    const result = transformPropertyData(
      mockMeta,
      mockEvidence,
      mockUnderwriting,
      mockAudit
    )

    expect(result.status).toBe('WATCHLIST')
  })

  it('computes overall confidence as LOW when any field is LOW', () => {
    const evidenceWithLow = {
      ...mockEvidence,
      hoa_monthly: {
        ...mockEvidence.hoa_monthly,
        confidence: 'LOW' as const,
      },
    }

    const result = transformPropertyData(mockMeta, evidenceWithLow, mockUnderwriting)

    expect(result.confidence).toBe('LOW')
  })

  it('computes overall confidence as MEDIUM when any field is MEDIUM and none LOW', () => {
    const result = transformPropertyData(mockMeta, mockEvidence, mockUnderwriting)

    expect(result.confidence).toBe('MEDIUM')
  })

  it('computes overall confidence as HIGH when all fields are HIGH', () => {
    const allHighEvidence = {
      ...mockEvidence,
      monthly_rent: {
        ...mockEvidence.monthly_rent,
        confidence: 'HIGH' as const,
      },
    }

    const result = transformPropertyData(mockMeta, allHighEvidence, mockUnderwriting)

    expect(result.confidence).toBe('HIGH')
  })

  it('includes listing source', () => {
    const result = transformPropertyData(mockMeta, mockEvidence, mockUnderwriting)

    expect(result.sources).toEqual([
      { label: 'Listing', url: 'https://example.com/listing/123' },
    ])
  })

  it('includes rankedAt timestamp', () => {
    const result = transformPropertyData(mockMeta, mockEvidence, mockUnderwriting)

    expect(result.rankedAt).toBeDefined()
    expect(new Date(result.rankedAt!).getTime()).not.toBeNaN()
  })
})

describe('sampleOpportunities', () => {
  it('contains sample data for development', () => {
    expect(sampleOpportunities.length).toBeGreaterThan(0)
  })

  it('includes VIABLE, WATCHLIST, and REJECTED properties', () => {
    const statuses = sampleOpportunities.map((o) => o.status)

    expect(statuses).toContain('VIABLE')
    expect(statuses).toContain('WATCHLIST')
    expect(statuses).toContain('REJECTED')
  })

  it('has valid property structure', () => {
    for (const opportunity of sampleOpportunities) {
      expect(opportunity.id).toBeTruthy()
      expect(opportunity.address).toBeTruthy()
      expect(opportunity.location).toBeTruthy()
      expect(opportunity.listingUrl).toBeTruthy()
      expect(typeof opportunity.noi).toBe('number')
      expect(typeof opportunity.capRate).toBe('number')
      expect(['VIABLE', 'WATCHLIST', 'REJECTED']).toContain(opportunity.status)
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(opportunity.confidence)
    }
  })
})

describe('fetchOpportunities', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns empty array when Supabase is not configured', async () => {
    const { isSupabaseConfigured } = await import('./supabase')
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await fetchOpportunities()

    expect(result).toEqual([])
    expect(consoleWarn).toHaveBeenCalledWith(
      'Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    )

    consoleWarn.mockRestore()
  })

  it('calls fetchOpportunitiesFromSupabase when configured', async () => {
    const mockData = [
      {
        id: 'test',
        address: '123 Test',
        location: 'Tampa, FL',
        listingUrl: 'https://example.com',
        purchasePrice: { value: 200000, status: 'VERIFIED', confidence: 'HIGH' },
        monthlyRent: { value: 2000, status: 'VERIFIED', confidence: 'HIGH' },
        annualGrossRent: 24000,
        annualOperatingExpenses: 6000,
        noi: 18000,
        capRate: 0.09,
        hoa: { value: 300, status: 'VERIFIED', confidence: 'HIGH' },
        assessment: { value: 0, status: 'VERIFIED', confidence: 'HIGH' },
        confidence: 'HIGH',
        status: 'VIABLE',
      },
    ]

    const { isSupabaseConfigured, fetchOpportunitiesFromSupabase } = await import('./supabase')
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(fetchOpportunitiesFromSupabase).mockResolvedValue(mockData as any)

    const result = await fetchOpportunities()

    expect(isSupabaseConfigured).toHaveBeenCalled()
    expect(fetchOpportunitiesFromSupabase).toHaveBeenCalled()
    expect(result).toEqual(mockData)
  })
})
