import { createClient, SupabaseClient as BaseSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseConfig, PropertyRow, ListOpportunitiesOptions, SyncResult, PropertyOpportunity } from './types.js';
import { rowToOpportunity, opportunityToRow } from './mapper.js';

const PROPERTIES_TABLE = 'properties';

export class SupabaseClient {
  private client: BaseSupabaseClient;
  private config: SupabaseConfig;

  constructor(config?: Partial<SupabaseConfig>) {
    this.config = {
      url: config?.url || process.env.SUPABASE_URL || '',
      anonKey: config?.anonKey || process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: config?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    if (!this.config.url) {
      throw new Error('SUPABASE_URL is required. Set it in environment or pass to constructor.');
    }

    const key = this.config.serviceRoleKey || this.config.anonKey;
    if (!key) {
      throw new Error('Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required.');
    }

    this.client = createClient(this.config.url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getBaseClient(): BaseSupabaseClient {
    return this.client;
  }

  async listOpportunities(options: ListOpportunitiesOptions = {}): Promise<PropertyOpportunity[]> {
    let query = this.client
      .from(PROPERTIES_TABLE)
      .select('*');

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      query = query.in('status', statuses);
    }

    if (options.minCapRate !== undefined) {
      query = query.gte('cap_rate', options.minCapRate);
    }

    query = query.order('cap_rate', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list opportunities: ${error.message}`);
    }

    return (data as PropertyRow[]).map(rowToOpportunity);
  }

  async getProperty(id: string): Promise<PropertyOpportunity | null> {
    const { data, error } = await this.client
      .from(PROPERTIES_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get property: ${error.message}`);
    }

    return rowToOpportunity(data as PropertyRow);
  }

  async upsertProperty(opportunity: PropertyOpportunity, workflowState: string = 'PUBLISHED'): Promise<void> {
    const row = opportunityToRow(opportunity, workflowState);
    
    const { error } = await this.client
      .from(PROPERTIES_TABLE)
      .upsert(row, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to upsert property ${opportunity.id}: ${error.message}`);
    }
  }

  async upsertProperties(opportunities: PropertyOpportunity[], workflowState: string = 'PUBLISHED'): Promise<SyncResult> {
    const result: SyncResult = { inserted: 0, updated: 0, errors: [] };

    const existingIds = new Set<string>();
    const { data: existing } = await this.client
      .from(PROPERTIES_TABLE)
      .select('id')
      .in('id', opportunities.map(o => o.id));

    if (existing) {
      for (const row of existing) {
        existingIds.add(row.id);
      }
    }

    const rows = opportunities.map(o => opportunityToRow(o, workflowState));

    const { error } = await this.client
      .from(PROPERTIES_TABLE)
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      result.errors.push({ id: 'batch', error: error.message });
    } else {
      for (const row of rows) {
        if (existingIds.has(row.id)) {
          result.updated++;
        } else {
          result.inserted++;
        }
      }
    }

    return result;
  }

  async deleteProperty(id: string): Promise<boolean> {
    const { error, count } = await this.client
      .from(PROPERTIES_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete property ${id}: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }
}

export async function listOpportunities(
  client: SupabaseClient,
  options: ListOpportunitiesOptions = {}
): Promise<PropertyOpportunity[]> {
  return client.listOpportunities(options);
}

export async function getProperty(
  client: SupabaseClient,
  id: string
): Promise<PropertyOpportunity | null> {
  return client.getProperty(id);
}
