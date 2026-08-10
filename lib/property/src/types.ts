/**
 * Field value with provenance - used throughout evidence and underwriting
 */
export interface FieldValue {
  value: number | null;
  status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source?: string;
  evidence?: string;
  range_low?: number;
  range_high?: number;
}

/**
 * Workflow states for a property candidate
 */
export type WorkflowState =
  | 'CANDIDATE'
  | 'SCREENED'
  | 'RESEARCHING'
  | 'READY_FOR_UNDERWRITING'
  | 'UNDERWRITTEN'
  | 'AUDIT'
  | 'RANKED'
  | 'PUBLISHED';

/**
 * Scout decision outcome
 */
export type ScoutDecision = 'REJECT' | 'RESEARCH';

/**
 * Property classification status
 */
export type PropertyStatus = 'VIABLE' | 'WATCHLIST' | 'REJECTED';

/**
 * Audit result outcome
 */
export type AuditResult = 'PASS' | 'NEEDS_RESEARCH' | 'DOWNGRADE';

/**
 * Audit finding severity
 */
export type FindingSeverity = 'info' | 'warning' | 'blocking';

/**
 * Property metadata - workflow state and listing info
 */
export interface PropertyMeta {
  id: string;
  address: string;
  location?: string;
  listing_url: string;
  workflow_state: WorkflowState;
  scout_decision?: ScoutDecision;
  created_at: string;
  updated_at: string;
}

/**
 * Researcher-owned evidence record
 */
export interface PropertyEvidence {
  property_id: string;
  researched_at: string;
  purchase_price?: FieldValue;
  monthly_rent?: FieldValue;
  hoa_monthly?: FieldValue;
  special_assessments?: FieldValue;
  property_taxes_annual?: FieldValue;
  insurance_annual?: FieldValue;
  management_annual?: FieldValue;
  utilities_annual?: FieldValue;
  other_expenses_annual?: FieldValue;
  rental_restrictions?: FieldValue;
  str_restrictions?: FieldValue;
  notes?: string;
}

/**
 * Input summary for underwriting
 */
export interface InputSummary {
  [key: string]: {
    status?: string;
    confidence?: string;
  };
}

/**
 * Underwriter-owned analysis output
 */
export interface PropertyUnderwriting {
  property_id: string;
  annual_gross_rent: number;
  annual_operating_expenses: number;
  noi: number;
  cap_rate: number;
  proposed_status: PropertyStatus;
  proposed_status_reason?: string;
  input_summary?: InputSummary;
  computed_at: string;
}

/**
 * Audit finding
 */
export interface AuditFinding {
  severity: FindingSeverity;
  field?: string;
  message: string;
}

/**
 * Auditor-owned validation output
 */
export interface PropertyAudit {
  property_id: string;
  result: AuditResult;
  final_status: PropertyStatus;
  underwriter_proposed_status?: PropertyStatus;
  findings?: AuditFinding[];
  audited_at: string;
}

/**
 * Source reference
 */
export interface Source {
  label?: string;
  url?: string;
}

/**
 * Published opportunity for UI display
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
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  status: PropertyStatus;
  sources?: Source[];
  rankedAt?: string;
}

/**
 * Complete property record containing all files
 */
export interface PropertyRecord {
  meta: PropertyMeta;
  evidence?: PropertyEvidence;
  underwriting?: PropertyUnderwriting;
  audit?: PropertyAudit;
}
