import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { transformPropertyData, sampleOpportunities, fetchOpportunities, fetchOpportunitiesFromStaticJson } from './loader'
import * as supabaseModule from './supabase'

vi.mock('./supabase', () => ({
  isSupabaseConfigured: vi.fn(),
  fetchOpportunitiesFromSupabase: vi.fn(),
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
  const mockOpportunity = {
    id: 'supabase-property',
    address: '456 Supabase St',
    location: 'Tampa, FL',
    listingUrl: 'https://example.com/456',
    purchasePrice: { value: 250000, status: 'VERIFIED' as const, confidence: 'HIGH' as const },
    monthlyRent: { value: 2500, status: 'VERIFIED' as const, confidence: 'HIGH' as const },
    annualGrossRent: 30000,
    annualOperatingExpenses: 8000,
    noi: 22000,
    capRate: 0.088,
    hoa: { value: 300, status: 'VERIFIED' as const, confidence: 'HIGH' as const },
    assessment: { value: 0, status: 'VERIFIED' as const, confidence: 'HIGH' as const },
    confidence: 'HIGH' as const,
    status: 'VIABLE' as const,
    sources: [],
    rankedAt: '2026-08-09T12:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches from Supabase when configured', async () => {
    vi.mocked(supabaseModule.isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabaseModule.fetchOpportunitiesFromSupabase).mockResolvedValue([mockOpportunity])

    const result = await fetchOpportunities()

    expect(supabaseModule.isSupabaseConfigured).toHaveBeenCalled()
    expect(supabaseModule.fetchOpportunitiesFromSupabase).toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('supabase-property')
  })

  it('falls back to static JSON when Supabase is not configured', async () => {
    vi.mocked(supabaseModule.isSupabaseConfigured).mockReturnValue(false)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockOpportunity]),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchOpportunities()

    expect(supabaseModule.isSupabaseConfigured).toHaveBeenCalled()
    expect(supabaseModule.fetchOpportunitiesFromSupabase).not.toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith('/data/opportunities.json')

    vi.unstubAllGlobals()
  })
})

describe('fetchOpportunitiesFromStaticJson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches from static JSON file', async () => {
    const mockData = [{ id: 'static-property' }]
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchOpportunitiesFromStaticJson()

    expect(mockFetch).toHaveBeenCalledWith('/data/opportunities.json')
    expect(result).toEqual(mockData)
  })

  it('returns empty array when fetch fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchOpportunitiesFromStaticJson()

    expect(result).toEqual([])
  })

  it('returns empty array on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchOpportunitiesFromStaticJson()

    expect(result).toEqual([])
  })
})
