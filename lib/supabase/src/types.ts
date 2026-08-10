/**
 * Supabase types for RealEstateHunter
 * These types match the PropertyOpportunity schema and Supabase table structure.
 */

export type FieldStatus = 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type PropertyStatus = 'VIABLE' | 'WATCHLIST' | 'REJECTED';
export type WorkflowState =
  | 'CANDIDATE'
  | 'SCREENED'
  | 'RESEARCHING'
  | 'READY_FOR_UNDERWRITING'
  | 'UNDERWRITTEN'
  | 'AUDIT'
  | 'RANKED'
  | 'PUBLISHED'
  | 'ARCHIVED';

export interface FieldValue {
  value: number | null;
  status: FieldStatus;
  confidence: Confidence;
  source?: string;
  evidence?: string;
  range_low?: number;
  range_high?: number;
}

export interface Source {
  label: string;
  url: string;
}

/**
 * Property row as stored in Supabase
 */
export interface PropertyRow {
  id: string;
  address: string;
  location: string;
  listing_url: string;
  purchase_price: FieldValue;
  monthly_rent: FieldValue;
  hoa: FieldValue;
  assessment: FieldValue;
  annual_gross_rent: number;
  annual_operating_expenses: number;
  noi: number;
  cap_rate: number;
  confidence: Confidence;
  status: PropertyStatus;
  workflow_state: WorkflowState;
  sources: Source[];
  ranked_at: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * PropertyOpportunity interface for UI consumption
 * Matches schemas/property-opportunity.json
 */
export interface PropertyOpportunity {
  id: string;
  address: string;
  location: string;
  listingUrl: string;
  purchasePrice: FieldValue;
  monthlyRent: FieldValue;
  annualGrossRent: number;
  annualOperatingExpenses: number;
  noi: number;
  capRate: number;
  hoa: FieldValue;
  assessment: FieldValue;
  confidence: Confidence;
  status: PropertyStatus;
  sources?: Source[];
  rankedAt?: string;
}

/**
 * Query options for listing properties
 */
export interface ListOpportunitiesOptions {
  status?: PropertyStatus;
  minCapRate?: number;
  maxCapRate?: number;
  confidence?: Confidence;
  workflowState?: WorkflowState | WorkflowState[];
  limit?: number;
  offset?: number;
  orderBy?: 'cap_rate' | 'noi' | 'ranked_at' | 'created_at';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Supabase database schema types for type-safe queries
 */
export interface Database {
  public: {
    Tables: {
      properties: {
        Row: PropertyRow;
        Insert: Omit<PropertyRow, 'synced_at' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PropertyRow, 'id'>>;
      };
      property_details: {
        Row: {
          property_id: string;
          evidence: Record<string, unknown> | null;
          underwriting: Record<string, unknown> | null;
          audit: Record<string, unknown> | null;
          synced_at: string;
        };
        Insert: {
          property_id: string;
          evidence?: Record<string, unknown> | null;
          underwriting?: Record<string, unknown> | null;
          audit?: Record<string, unknown> | null;
        };
        Update: Partial<{
          evidence: Record<string, unknown> | null;
          underwriting: Record<string, unknown> | null;
          audit: Record<string, unknown> | null;
        }>;
      };
    };
  };
}
