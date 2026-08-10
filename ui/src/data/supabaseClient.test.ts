import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockListOpportunities = vi.fn()

vi.mock('@realestatehunter/supabase', () => ({
  SupabaseClient: class MockSupabaseClient {
    listOpportunities = mockListOpportunities
  },
}))

describe('supabaseClient', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    mockListOpportunities.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  describe('isSupabaseConfigured', () => {
    it('returns true when both URL and key are set', async () => {
      const { isSupabaseConfigured } = await import('./supabaseClient')
      expect(isSupabaseConfigured()).toBe(true)
    })

    it('returns false when URL is missing', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '')
      vi.resetModules()
      const { isSupabaseConfigured } = await import('./supabaseClient')
      expect(isSupabaseConfigured()).toBe(false)
    })
  })

  describe('fetchOpportunitiesFromSupabase', () => {
    it('fetches opportunities via shared Supabase client', async () => {
      const mockOpportunity = {
        id: 'test-property',
        address: '123 Test St',
        location: 'Tampa, FL',
        listingUrl: 'https://example.com/123',
        purchasePrice: { value: 200000, status: 'VERIFIED', confidence: 'HIGH' },
        monthlyRent: { value: 2200, status: 'VERIFIED', confidence: 'HIGH' },
        annualGrossRent: 26400,
        annualOperatingExpenses: 12572,
        noi: 13828,
        capRate: 0.0691,
        hoa: { value: 485, status: 'VERIFIED', confidence: 'HIGH' },
        assessment: { value: 0, status: 'VERIFIED', confidence: 'HIGH' },
        confidence: 'HIGH',
        status: 'VIABLE',
      }
      mockListOpportunities.mockResolvedValue([mockOpportunity])

      const { fetchOpportunitiesFromSupabase, resetSupabaseClient } = await import('./supabaseClient')
      resetSupabaseClient()

      const result = await fetchOpportunitiesFromSupabase()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('test-property')
      expect(mockListOpportunities).toHaveBeenCalled()
    })

    it('returns empty array when Supabase is not configured', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
      vi.resetModules()

      const { fetchOpportunitiesFromSupabase } = await import('./supabaseClient')
      const result = await fetchOpportunitiesFromSupabase()

      expect(result).toEqual([])
    })

    it('returns empty array on client error', async () => {
      mockListOpportunities.mockRejectedValue(new Error('Database error'))
      vi.resetModules()

      const { fetchOpportunitiesFromSupabase, resetSupabaseClient } = await import('./supabaseClient')
      resetSupabaseClient()

      const result = await fetchOpportunitiesFromSupabase()
      expect(result).toEqual([])
    })
  })
})
