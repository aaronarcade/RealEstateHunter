/**
 * Query functions for RealEstateHunter Supabase data
 */

import type { SupabaseClientType } from './client.js';
import type {
  PropertyRow,
  PropertyOpportunity,
  ListOpportunitiesOptions,
} from './types.js';

/**
 * Convert a Supabase row to a PropertyOpportunity
 */
export function rowToOpportunity(row: PropertyRow): PropertyOpportunity {
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
    rankedAt: row.ranked_at ?? undefined,
  };
}

/**
 * List property opportunities with optional filters
 *
 * @param client Supabase client
 * @param options Filter and pagination options
 * @returns Array of PropertyOpportunity objects
 */
export async function listOpportunities(
  client: SupabaseClientType,
  options: ListOpportunitiesOptions = {}
): Promise<PropertyOpportunity[]> {
  let query = client.from('properties').select('*');

  // Apply filters
  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.minCapRate !== undefined) {
    query = query.gte('cap_rate', options.minCapRate);
  }

  if (options.maxCapRate !== undefined) {
    query = query.lte('cap_rate', options.maxCapRate);
  }

  if (options.confidence) {
    query = query.eq('confidence', options.confidence);
  }

  if (options.workflowState) {
    if (Array.isArray(options.workflowState)) {
      query = query.in('workflow_state', options.workflowState);
    } else {
      query = query.eq('workflow_state', options.workflowState);
    }
  }

  // Apply ordering
  const orderBy = options.orderBy ?? 'cap_rate';
  const orderDirection = options.orderDirection ?? 'desc';
  query = query.order(orderBy, { ascending: orderDirection === 'asc' });

  // Apply pagination
  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  if (options.offset !== undefined) {
    query = query.range(options.offset, options.offset + (options.limit ?? 100) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list opportunities: ${error.message}`);
  }

  return (data ?? []).map(rowToOpportunity);
}

/**
 * Get a single property by ID
 *
 * @param client Supabase client
 * @param id Property ID (slug)
 * @returns PropertyOpportunity or null if not found
 */
export async function getProperty(
  client: SupabaseClientType,
  id: string
): Promise<PropertyOpportunity | null> {
  const { data, error } = await client
    .from('properties')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get property ${id}: ${error.message}`);
  }

  return data ? rowToOpportunity(data) : null;
}

/**
 * Get property with full details (evidence, underwriting, audit)
 *
 * @param client Supabase client
 * @param id Property ID (slug)
 * @returns Property with details or null if not found
 */
export async function getPropertyWithDetails(
  client: SupabaseClientType,
  id: string
): Promise<(PropertyOpportunity & {
  evidence?: Record<string, unknown>;
  underwriting?: Record<string, unknown>;
  audit?: Record<string, unknown>;
}) | null> {
  const { data: property, error: propertyError } = await client
    .from('properties')
    .select('*')
    .eq('id', id)
    .single();

  if (propertyError) {
    if (propertyError.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get property ${id}: ${propertyError.message}`);
  }

  if (!property) {
    return null;
  }

  const { data: details, error: detailsError } = await client
    .from('property_details')
    .select('*')
    .eq('property_id', id)
    .single();

  if (detailsError && detailsError.code !== 'PGRST116') {
    throw new Error(`Failed to get property details ${id}: ${detailsError.message}`);
  }

  const detailsRecord = details as {
    evidence?: Record<string, unknown>;
    underwriting?: Record<string, unknown>;
    audit?: Record<string, unknown>;
  } | null;

  return {
    ...rowToOpportunity(property),
    evidence: detailsRecord?.evidence ?? undefined,
    underwriting: detailsRecord?.underwriting ?? undefined,
    audit: detailsRecord?.audit ?? undefined,
  };
}

/**
 * Count properties matching filters
 *
 * @param client Supabase client
 * @param options Filter options (same as listOpportunities)
 * @returns Count of matching properties
 */
export async function countOpportunities(
  client: SupabaseClientType,
  options: Omit<ListOpportunitiesOptions, 'limit' | 'offset' | 'orderBy' | 'orderDirection'> = {}
): Promise<number> {
  let query = client
    .from('properties')
    .select('*', { count: 'exact', head: true });

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.minCapRate !== undefined) {
    query = query.gte('cap_rate', options.minCapRate);
  }

  if (options.maxCapRate !== undefined) {
    query = query.lte('cap_rate', options.maxCapRate);
  }

  if (options.confidence) {
    query = query.eq('confidence', options.confidence);
  }

  if (options.workflowState) {
    if (Array.isArray(options.workflowState)) {
      query = query.in('workflow_state', options.workflowState);
    } else {
      query = query.eq('workflow_state', options.workflowState);
    }
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count opportunities: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Get VIABLE opportunities sorted by cap rate
 *
 * Convenience function for the most common UI query.
 */
export async function getViableOpportunities(
  client: SupabaseClientType,
  limit = 50
): Promise<PropertyOpportunity[]> {
  return listOpportunities(client, {
    status: 'VIABLE',
    workflowState: ['RANKED', 'PUBLISHED'],
    orderBy: 'cap_rate',
    orderDirection: 'desc',
    limit,
  });
}

/**
 * Get opportunities on watchlist
 */
export async function getWatchlistOpportunities(
  client: SupabaseClientType,
  limit = 50
): Promise<PropertyOpportunity[]> {
  return listOpportunities(client, {
    status: 'WATCHLIST',
    workflowState: ['RANKED', 'PUBLISHED'],
    orderBy: 'cap_rate',
    orderDirection: 'desc',
    limit,
  });
}
