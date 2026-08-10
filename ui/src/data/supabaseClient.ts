import { SupabaseClient } from '@realestatehunter/supabase'
import type { PropertyOpportunity } from '../types/property'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null

/**
 * Check if Supabase is configured with required environment variables.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

/**
 * Get or create the Supabase client instance.
 * Returns null if Supabase is not configured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null
  }

  if (!client) {
    client = new SupabaseClient({
      url: SUPABASE_URL!,
      anonKey: SUPABASE_ANON_KEY!,
    })
  }

  return client
}

/**
 * Fetch opportunities from Supabase via the shared read client (TASK-007).
 */
export async function fetchOpportunitiesFromSupabase(): Promise<PropertyOpportunity[]> {
  const supabase = getSupabaseClient()

  if (!supabase) {
    console.warn('Supabase not configured — missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    return []
  }

  try {
    return await supabase.listOpportunities()
  } catch (error) {
    console.error('Failed to fetch from Supabase:', error)
    return []
  }
}

/**
 * Reset the client singleton (useful for testing).
 */
export function resetSupabaseClient(): void {
  client = null
}
