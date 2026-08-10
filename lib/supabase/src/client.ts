/**
 * Supabase client factory for RealEstateHunter
 */

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.js';

export type SupabaseClientType = SupabaseClient<Database>;

export interface ClientOptions {
  url?: string;
  key?: string;
}

/**
 * Create a Supabase client instance.
 *
 * Uses environment variables by default:
 * - SUPABASE_URL or VITE_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (server) or SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY (browser)
 *
 * @param options Override URL and key if needed
 * @returns Typed Supabase client
 */
export function createClient(options: ClientOptions = {}): SupabaseClientType {
  const url =
    options.url ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const key =
    options.key ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      'Supabase URL not configured. Set SUPABASE_URL or VITE_SUPABASE_URL environment variable.'
    );
  }

  if (!key) {
    throw new Error(
      'Supabase key not configured. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable.'
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof globalThis !== 'undefined' && 'window' in globalThis;
}

/**
 * Validate that environment is properly configured
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url) {
    errors.push('Missing SUPABASE_URL or VITE_SUPABASE_URL');
  }

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!key) {
    errors.push('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
