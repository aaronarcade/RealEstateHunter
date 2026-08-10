/**
 * Field value with provenance tracking - mirrors schemas/field-value.json
 */
export interface FieldValue {
  value: number | null
  status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  source?: string
  evidence?: string
  range_low?: number
  range_high?: number
}

/**
 * Source reference for property data
 */
export interface Source {
  label?: string
  url?: string
}

/**
 * Investment status classification
 */
export type Status = 'VIABLE' | 'WATCHLIST' | 'REJECTED'

/**
 * Confidence level for overall analysis
 */
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * Published property opportunity - mirrors schemas/property-opportunity.json
 * This is the primary interface for UI display and ranking
 */
export interface PropertyOpportunity {
  id: string
  address: string
  location: string
  listingUrl: string

  purchasePrice: FieldValue
  monthlyRent: FieldValue

  annualGrossRent: number
  annualOperatingExpenses: number
  noi: number
  capRate: number

  hoa: FieldValue
  assessment: FieldValue

  confidence: Confidence
  status: Status

  sources?: Source[]
  rankedAt?: string
}

/**
 * Sort configuration for opportunity list
 */
export interface SortConfig {
  field: SortField
  direction: 'asc' | 'desc'
}

export type SortField = 'status' | 'confidence' | 'capRate' | 'noi'
