import type { PropertyOpportunity, Confidence, Status } from '../types/property'
import { fetchOpportunitiesFromSupabase, isSupabaseConfigured } from './supabaseClient'

/**
 * Raw property file data structure (as stored in data/properties/{id}/)
 */
interface PropertyMeta {
  id: string
  address: string
  location: string
  listing_url: string
  workflow_state: string
}

interface FieldValueRaw {
  value: number | null
  status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  source?: string
  evidence?: string
  range_low?: number
  range_high?: number
}

interface PropertyEvidence {
  property_id: string
  purchase_price: FieldValueRaw
  monthly_rent: FieldValueRaw
  hoa_monthly: FieldValueRaw
  special_assessments: FieldValueRaw
}

interface PropertyUnderwriting {
  property_id: string
  annual_gross_rent: number
  annual_operating_expenses: number
  noi: number
  cap_rate: number
  proposed_status: Status
}

interface PropertyAudit {
  property_id: string
  result: 'PASS' | 'NEEDS_RESEARCH' | 'DOWNGRADE'
  final_status: Status
}

/**
 * Determine overall confidence from field values
 */
function computeOverallConfidence(fields: FieldValueRaw[]): Confidence {
  const confidences = fields.map((f) => f.confidence)

  if (confidences.includes('LOW')) return 'LOW'
  if (confidences.includes('MEDIUM')) return 'MEDIUM'
  return 'HIGH'
}

/**
 * Transform raw property files into PropertyOpportunity
 */
export function transformPropertyData(
  meta: PropertyMeta,
  evidence: PropertyEvidence,
  underwriting: PropertyUnderwriting,
  audit?: PropertyAudit
): PropertyOpportunity {
  const status = audit?.final_status ?? underwriting.proposed_status

  const keyFields = [
    evidence.purchase_price,
    evidence.monthly_rent,
    evidence.hoa_monthly,
    evidence.special_assessments,
  ]

  return {
    id: meta.id,
    address: meta.address,
    location: meta.location,
    listingUrl: meta.listing_url,

    purchasePrice: evidence.purchase_price,
    monthlyRent: evidence.monthly_rent,

    annualGrossRent: underwriting.annual_gross_rent,
    annualOperatingExpenses: underwriting.annual_operating_expenses,
    noi: underwriting.noi,
    capRate: underwriting.cap_rate,

    hoa: evidence.hoa_monthly,
    assessment: evidence.special_assessments,

    confidence: computeOverallConfidence(keyFields),
    status,

    sources: [{ label: 'Listing', url: meta.listing_url }],
    rankedAt: new Date().toISOString(),
  }
}

/**
 * Fetch published opportunities from Supabase via the shared read client.
 */
export async function fetchOpportunities(): Promise<PropertyOpportunity[]> {
  if (isSupabaseConfigured()) {
    return fetchOpportunitiesFromSupabase()
  }

  console.warn('Supabase not configured — falling back to static JSON')
  return fetchOpportunitiesFromStaticJson()
}

/**
 * Fetch opportunities from static JSON file.
 * Used as fallback when Supabase is not configured.
 */
export async function fetchOpportunitiesFromStaticJson(): Promise<PropertyOpportunity[]> {
  try {
    const response = await fetch('/data/opportunities.json')
    if (!response.ok) {
      console.warn('No opportunities data found, returning empty array')
      return []
    }
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch opportunities from static JSON:', error)
    return []
  }
}

/**
 * Sample data for development and testing
 */
export const sampleOpportunities: PropertyOpportunity[] = [
  {
    id: 'sample-viable-property',
    address: '456 Investment Ave, Tampa, FL 33606',
    location: 'Tampa, FL',
    listingUrl: 'https://example.com/listing/456',
    purchasePrice: {
      value: 180000,
      status: 'VERIFIED',
      confidence: 'HIGH',
      source: 'https://example.com/listing/456',
      evidence: 'Listing price $180,000',
    },
    monthlyRent: {
      value: 2100,
      status: 'VERIFIED',
      confidence: 'HIGH',
      source: 'Lease agreement',
      evidence: 'Current tenant paying $2,100/month',
    },
    annualGrossRent: 25200,
    annualOperatingExpenses: 6800,
    noi: 18400,
    capRate: 0.1022,
    hoa: {
      value: 250,
      status: 'VERIFIED',
      confidence: 'HIGH',
      source: 'HOA docs',
      evidence: 'HOA fee $250/month',
    },
    assessment: {
      value: 0,
      status: 'VERIFIED',
      confidence: 'HIGH',
      source: 'HOA disclosure',
      evidence: 'No special assessments',
    },
    confidence: 'HIGH',
    status: 'VIABLE',
    sources: [{ label: 'Listing', url: 'https://example.com/listing/456' }],
    rankedAt: '2026-08-09T12:00:00Z',
  },
  {
    id: 'sample-watchlist-property',
    address: '789 Pending St, Orlando, FL 32801',
    location: 'Orlando, FL',
    listingUrl: 'https://example.com/listing/789',
    purchasePrice: {
      value: 220000,
      status: 'VERIFIED',
      confidence: 'HIGH',
      source: 'https://example.com/listing/789',
      evidence: 'Listing price $220,000',
    },
    monthlyRent: {
      value: 2400,
      status: 'ESTIMATED',
      confidence: 'MEDIUM',
      source: 'Rent comps',
      evidence: 'Based on nearby comparable properties',
      range_low: 2200,
      range_high: 2600,
    },
    annualGrossRent: 28800,
    annualOperatingExpenses: 6500,
    noi: 22300,
    capRate: 0.1014,
    hoa: {
      value: 180,
      status: 'VERIFIED',
      confidence: 'HIGH',
      source: 'HOA docs',
      evidence: 'HOA fee $180/month',
    },
    assessment: {
      value: null,
      status: 'UNKNOWN',
      confidence: 'LOW',
      source: 'HOA disclosure pending',
      evidence: 'Assessment status unknown - awaiting HOA disclosure',
    },
    confidence: 'MEDIUM',
    status: 'WATCHLIST',
    sources: [{ label: 'Listing', url: 'https://example.com/listing/789' }],
    rankedAt: '2026-08-09T14:00:00Z',
  },
  {
    id: 'sample-rejected-property',
    address: '123 Example St, Tampa, FL 33602',
    location: 'Tampa, FL',
    listingUrl: 'https://example.com/listing/123',
    purchasePrice: {
      value: 200000,
      status: 'VERIFIED',
      confidence: 'HIGH',
      source: 'https://example.com/listing/123',
      evidence: 'Listing asking price $200,000',
    },
    monthlyRent: {
      value: 2200,
      status: 'ESTIMATED',
      confidence: 'MEDIUM',
      source: 'Rent comps',
      evidence: 'Comp A: $2,100/mo similar 2BR condo. Comp B: $2,300/mo same building.',
      range_low: 2100,
      range_high: 2300,
    },
    annualGrossRent: 26400,
    annualOperatingExpenses: 12572,
    noi: 13828,
    capRate: 0.0691,
    hoa: {
      value: 485,
      status: 'VERIFIED',
      confidence: 'HIGH',
      source: 'https://example.com/listing/123',
      evidence: 'Listing states HOA $485/month',
    },
    assessment: {
      value: 0,
      status: 'VERIFIED',
      confidence: 'HIGH',
      source: 'HOA disclosure document',
      evidence: 'HOA disclosure dated 2026-01 states no special assessments',
    },
    confidence: 'MEDIUM',
    status: 'REJECTED',
    sources: [{ label: 'Listing', url: 'https://example.com/listing/123' }],
    rankedAt: '2026-08-09T18:00:00Z',
  },
]
