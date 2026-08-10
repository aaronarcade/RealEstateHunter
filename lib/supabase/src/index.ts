export { SupabaseClient, listOpportunities, getProperty } from './client.js';
export { rowToOpportunity, opportunityToRow, deriveConfidence, deriveSources } from './mapper.js';
export type {
  FieldValue,
  PropertyStatus,
  Source,
  PropertyOpportunity,
  SupabaseConfig,
  PropertyRow,
  ListOpportunitiesOptions,
  SyncResult,
} from './types.js';
