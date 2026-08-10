export interface FieldValue {
  value: number | null;
  status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source?: string;
  evidence?: string;
  range_low?: number;
  range_high?: number;
}

export type PropertyStatus = 'VIABLE' | 'WATCHLIST' | 'REJECTED';

export interface Source {
  label?: string;
  url?: string;
}

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
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  status: PropertyStatus;
  sources?: Source[];
  rankedAt?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey?: string;
  serviceRoleKey?: string;
}

export interface PropertyRow {
  id: string;
  address: string;
  location: string;
  listing_url: string;
  purchase_price: FieldValue;
  monthly_rent: FieldValue;
  annual_gross_rent: number;
  annual_operating_expenses: number;
  noi: number;
  cap_rate: number;
  hoa: FieldValue;
  assessment: FieldValue;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  status: PropertyStatus;
  workflow_state: string;
  sources?: Array<{ label?: string; url?: string }>;
  ranked_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ListOpportunitiesOptions {
  status?: PropertyStatus | PropertyStatus[];
  minCapRate?: number;
  limit?: number;
  offset?: number;
}

export interface SyncResult {
  inserted: number;
  updated: number;
  errors: Array<{ id: string; error: string }>;
}
