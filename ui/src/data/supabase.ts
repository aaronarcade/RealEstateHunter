import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { PropertyOpportunity, FieldValue, Status, Confidence } from '../types/property'

/**
 * Supabase database types matching the opportunities table schema
 */
export interface SupabaseOpportunityRow {
  id: string
  address: string
  location: string
  listing_url: string

  purchase_price: number | null
  purchase_price_status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN'
  purchase_price_confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  purchase_price_source?: string
  purchase_price_evidence?: string

  monthly_rent: number | null
  monthly_rent_status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN'
  monthly_rent_confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  monthly_rent_source?: string
  monthly_rent_evidence?: string
  monthly_rent_range_low?: number
  monthly_rent_range_high?: number

  annual_gross_rent: number
  annual_operating_expenses: number
  noi: number
  cap_rate: number

  hoa_monthly: number | null
  hoa_monthly_status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN'
  hoa_monthly_confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  hoa_monthly_source?: string
  hoa_monthly_evidence?: string

  special_assessments: number | null
  special_assessments_status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN'
  special_assessments_confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  special_assessments_source?: string
  special_assessments_evidence?: string

  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'VIABLE' | 'WATCHLIST' | 'REJECTED'

  sources?: Array<{ label?: string; url?: string }>
  ranked_at?: string

  created_at?: string
  updated_at?: string
}

/**
 * Environment variables for Supabase connection
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Check if Supabase is configured with required environment variables
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

/**
 * Singleton Supabase client instance
 */
let supabaseClient: SupabaseClient | null = null

/**
 * Get the Supabase client instance.
 * Returns null if Supabase is not configured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  }

  return supabaseClient
}

/**
 * Transform a Supabase row into a PropertyOpportunity
 */
export function transformSupabaseRow(row: SupabaseOpportunityRow): PropertyOpportunity {
  const purchasePrice: FieldValue = {
    value: row.purchase_price,
    status: row.purchase_price_status,
    confidence: row.purchase_price_confidence,
    source: row.purchase_price_source,
    evidence: row.purchase_price_evidence,
  }

  const monthlyRent: FieldValue = {
    value: row.monthly_rent,
    status: row.monthly_rent_status,
    confidence: row.monthly_rent_confidence,
    source: row.monthly_rent_source,
    evidence: row.monthly_rent_evidence,
    range_low: row.monthly_rent_range_low,
    range_high: row.monthly_rent_range_high,
  }

  const hoa: FieldValue = {
    value: row.hoa_monthly,
    status: row.hoa_monthly_status,
    confidence: row.hoa_monthly_confidence,
    source: row.hoa_monthly_source,
    evidence: row.hoa_monthly_evidence,
  }

  const assessment: FieldValue = {
    value: row.special_assessments,
    status: row.special_assessments_status,
    confidence: row.special_assessments_confidence,
    source: row.special_assessments_source,
    evidence: row.special_assessments_evidence,
  }

  return {
    id: row.id,
    address: row.address,
    location: row.location,
    listingUrl: row.listing_url,

    purchasePrice,
    monthlyRent,

    annualGrossRent: row.annual_gross_rent,
    annualOperatingExpenses: row.annual_operating_expenses,
    noi: row.noi,
    capRate: row.cap_rate,

    hoa,
    assessment,

    confidence: row.confidence as Confidence,
    status: row.status as Status,

    sources: row.sources,
    rankedAt: row.ranked_at,
  }
}

/**
 * Fetch opportunities from Supabase.
 * Returns an empty array if Supabase is not configured or on error.
 */
export async function fetchOpportunitiesFromSupabase(): Promise<PropertyOpportunity[]> {
  const client = getSupabaseClient()

  if (!client) {
    console.warn('Supabase not configured — missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    return []
  }

  try {
    const { data, error } = await client
      .from('opportunities')
      .select('*')
      .order('ranked_at', { ascending: false })

    if (error) {
      console.error('Supabase query error:', error.message)
      return []
    }

    if (!data || data.length === 0) {
      return []
    }

    return data.map(transformSupabaseRow)
  } catch (error) {
    console.error('Failed to fetch from Supabase:', error)
    return []
  }
}

/**
 * Reset the Supabase client (useful for testing)
 */
export function resetSupabaseClient(): void {
  supabaseClient = null
}
