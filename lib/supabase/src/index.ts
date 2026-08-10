/**
 * Supabase client for RealEstateHunter
 *
 * @module @realestatehunter/supabase
 */

export { createClient, validateConfig, isBrowser } from './client.js';
export type { SupabaseClientType, ClientOptions } from './client.js';

export {
  listOpportunities,
  getProperty,
  getPropertyWithDetails,
  countOpportunities,
  getViableOpportunities,
  getWatchlistOpportunities,
  rowToOpportunity,
} from './queries.js';

export type {
  FieldStatus,
  Confidence,
  PropertyStatus,
  WorkflowState,
  FieldValue,
  Source,
  PropertyRow,
  PropertyOpportunity,
  ListOpportunitiesOptions,
  Database,
} from './types.js';
