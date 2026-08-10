import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { PropertyOpportunity, FieldValue } from '../types/property'

/**
 * Database row shape from Supabase properties table
 */
interface PropertyRow {
  id: string
  address: string
  location: string
  listing_url: string
  purchase_price: FieldValue
  monthly_rent: FieldValue
  annual_gross_rent: number
  annual_operating_expenses: number
  noi: number
  cap_rate: number
  hoa: FieldValue
  assessment: FieldValue
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'VIABLE' | 'WATCHLIST' | 'REJECTED'
  workflow_state: string
  sources?: Array<{ label?: string; url?: string }>
  ranked_at?: string
}

/**
 * Map a database row to the PropertyOpportunity interface
 */
function rowToOpportunity(row: PropertyRow): PropertyOpportunity {
  return {
    id: row.id,
    address: row.address,
    location: row.location,
    listingUrl: row.listing_url,
    purchasePrice: row.purchase_price,
    monthlyRent: row.monthly_rent,
    annualGrossRent: row.annual_gross_rent,
    annualOperatingExpenses: row.annual_operating_expenses,
    noi: row.noi,
    capRate: row.cap_rate,
    hoa: row.hoa,
    assessment: row.assessment,
    confidence: row.confidence,
    status: row.status,
    sources: row.sources,
    rankedAt: row.ranked_at,
  }
}

let supabaseClient: SupabaseClient | null = null

/**
 * Get or create a Supabase client instance.
 * Uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient
  }

  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.warn(
      'Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
    )
    return null
  }

  supabaseClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabaseClient
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

/**
 * Check if sample data fallback is enabled
 */
export function isSampleDataEnabled(): boolean {
  return import.meta.env.VITE_USE_SAMPLE_DATA === 'true'
}

/**
 * Fetch opportunities from Supabase
 * Returns empty array if Supabase is not configured or query fails
 */
export async function fetchOpportunitiesFromSupabase(): Promise<PropertyOpportunity[]> {
  const client = getSupabaseClient()
  if (!client) {
    return []
  }

  try {
    const { data, error } = await client
      .from('properties')
      .select('*')
      .order('cap_rate', { ascending: false })

    if (error) {
      console.error('Failed to fetch opportunities from Supabase:', error.message)
      return []
    }

    return (data as PropertyRow[]).map(rowToOpportunity)
  } catch (err) {
    console.error('Supabase query error:', err)
    return []
  }
}

/**
 * Reset the Supabase client (useful for testing)
 */
export function resetSupabaseClient(): void {
  supabaseClient = null
}
