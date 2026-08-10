import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resetSupabaseClient } from './supabase'

const mockSelect = vi.fn()
const mockOrder = vi.fn()
const mockFrom = vi.fn()
const mockCreateClient = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

describe('supabase module', () => {
  const originalEnv = { ...import.meta.env }

  beforeEach(() => {
    vi.resetModules()
    resetSupabaseClient()
    mockCreateClient.mockReset()
    mockFrom.mockReset()
    mockSelect.mockReset()
    mockOrder.mockReset()
  })

  afterEach(() => {
    Object.assign(import.meta.env, originalEnv)
  })

  describe('isSupabaseConfigured', () => {
    it('returns false when VITE_SUPABASE_URL is not set', async () => {
      import.meta.env.VITE_SUPABASE_URL = ''
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-key'

      const { isSupabaseConfigured } = await import('./supabase')
      expect(isSupabaseConfigured()).toBe(false)
    })

    it('returns false when VITE_SUPABASE_ANON_KEY is not set', async () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = ''

      const { isSupabaseConfigured } = await import('./supabase')
      expect(isSupabaseConfigured()).toBe(false)
    })

    it('returns true when both env vars are set', async () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-key'

      const { isSupabaseConfigured } = await import('./supabase')
      expect(isSupabaseConfigured()).toBe(true)
    })
  })

  describe('isSampleDataEnabled', () => {
    it('returns false when VITE_USE_SAMPLE_DATA is not set', async () => {
      import.meta.env.VITE_USE_SAMPLE_DATA = ''

      const { isSampleDataEnabled } = await import('./supabase')
      expect(isSampleDataEnabled()).toBe(false)
    })

    it('returns true when VITE_USE_SAMPLE_DATA is "true"', async () => {
      import.meta.env.VITE_USE_SAMPLE_DATA = 'true'

      const { isSampleDataEnabled } = await import('./supabase')
      expect(isSampleDataEnabled()).toBe(true)
    })

    it('returns false when VITE_USE_SAMPLE_DATA is "false"', async () => {
      import.meta.env.VITE_USE_SAMPLE_DATA = 'false'

      const { isSampleDataEnabled } = await import('./supabase')
      expect(isSampleDataEnabled()).toBe(false)
    })
  })

  describe('getSupabaseClient', () => {
    it('returns null when Supabase is not configured', async () => {
      import.meta.env.VITE_SUPABASE_URL = ''
      import.meta.env.VITE_SUPABASE_ANON_KEY = ''

      const { getSupabaseClient } = await import('./supabase')
      expect(getSupabaseClient()).toBeNull()
    })

    it('creates client when properly configured', async () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-key'

      const mockClient = { from: mockFrom }
      mockCreateClient.mockReturnValue(mockClient)

      const { getSupabaseClient } = await import('./supabase')
      const client = getSupabaseClient()

      expect(client).toBe(mockClient)
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-key',
        expect.objectContaining({
          auth: { autoRefreshToken: false, persistSession: false },
        })
      )
    })

    it('returns cached client on subsequent calls', async () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-key'

      const mockClient = { from: mockFrom }
      mockCreateClient.mockReturnValue(mockClient)

      const { getSupabaseClient } = await import('./supabase')
      const client1 = getSupabaseClient()
      const client2 = getSupabaseClient()

      expect(client1).toBe(client2)
      expect(mockCreateClient).toHaveBeenCalledTimes(1)
    })
  })

  describe('fetchOpportunitiesFromSupabase', () => {
    it('returns empty array when client is not configured', async () => {
      import.meta.env.VITE_SUPABASE_URL = ''
      import.meta.env.VITE_SUPABASE_ANON_KEY = ''

      const { fetchOpportunitiesFromSupabase } = await import('./supabase')
      const result = await fetchOpportunitiesFromSupabase()

      expect(result).toEqual([])
    })

    it('fetches and transforms opportunities from Supabase', async () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-key'

      const mockRow = {
        id: 'test-property',
        address: '123 Test St',
        location: 'Tampa, FL',
        listing_url: 'https://example.com/listing',
        purchase_price: { value: 200000, status: 'VERIFIED', confidence: 'HIGH' },
        monthly_rent: { value: 2000, status: 'VERIFIED', confidence: 'HIGH' },
        annual_gross_rent: 24000,
        annual_operating_expenses: 6000,
        noi: 18000,
        cap_rate: 0.09,
        hoa: { value: 300, status: 'VERIFIED', confidence: 'HIGH' },
        assessment: { value: 0, status: 'VERIFIED', confidence: 'HIGH' },
        confidence: 'HIGH',
        status: 'VIABLE',
        workflow_state: 'PUBLISHED',
        sources: [{ label: 'Listing', url: 'https://example.com/listing' }],
        ranked_at: '2026-08-01T00:00:00Z',
      }

      mockOrder.mockResolvedValue({ data: [mockRow], error: null })
      mockSelect.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({ select: mockSelect })
      mockCreateClient.mockReturnValue({ from: mockFrom })

      const { fetchOpportunitiesFromSupabase } = await import('./supabase')
      const result = await fetchOpportunitiesFromSupabase()

      expect(mockFrom).toHaveBeenCalledWith('properties')
      expect(mockSelect).toHaveBeenCalledWith('*')
      expect(mockOrder).toHaveBeenCalledWith('cap_rate', { ascending: false })

      expect(result).toEqual([
        {
          id: 'test-property',
          address: '123 Test St',
          location: 'Tampa, FL',
          listingUrl: 'https://example.com/listing',
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
          sources: [{ label: 'Listing', url: 'https://example.com/listing' }],
          rankedAt: '2026-08-01T00:00:00Z',
        },
      ])
    })

    it('returns empty array on Supabase error', async () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-key'

      mockOrder.mockResolvedValue({ data: null, error: { message: 'Test error' } })
      mockSelect.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({ select: mockSelect })
      mockCreateClient.mockReturnValue({ from: mockFrom })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { fetchOpportunitiesFromSupabase } = await import('./supabase')
      const result = await fetchOpportunitiesFromSupabase()

      expect(result).toEqual([])
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to fetch opportunities from Supabase:',
        'Test error'
      )

      consoleError.mockRestore()
    })
  })
})
