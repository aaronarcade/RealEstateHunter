import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PropertyOpportunity, SortConfig, SortField } from '../types/property'
import { fetchOpportunities, sampleOpportunities } from '../data/loader'
import { sortOpportunities, getNextSortDirection } from '../data/sorting'

/**
 * Check if sample data fallback is enabled via environment variable.
 * When true, sample data is used if Supabase returns empty results.
 */
const USE_SAMPLE_DATA_FALLBACK = import.meta.env.VITE_USE_SAMPLE_DATA === 'true'

interface UseOpportunitiesOptions {
  /**
   * Force sample data usage regardless of Supabase.
   * Primarily for testing or offline development.
   * @deprecated Prefer using VITE_USE_SAMPLE_DATA=true environment variable
   */
  forceSampleData?: boolean
}

export function useOpportunities(options: UseOpportunitiesOptions = {}) {
  const { forceSampleData = false } = options

  const [opportunities, setOpportunities] = useState<PropertyOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>(undefined)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        if (forceSampleData) {
          setOpportunities(sampleOpportunities)
        } else {
          const data = await fetchOpportunities()
          if (data.length === 0 && USE_SAMPLE_DATA_FALLBACK) {
            console.info('Supabase returned empty, using sample data fallback (VITE_USE_SAMPLE_DATA=true)')
            setOpportunities(sampleOpportunities)
          } else {
            setOpportunities(data)
          }
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e : new Error('Failed to load opportunities'))
          if (USE_SAMPLE_DATA_FALLBACK) {
            console.info('Error fetching opportunities, using sample data fallback')
            setOpportunities(sampleOpportunities)
          }
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [forceSampleData])

  const handleSort = useCallback((field: SortField) => {
    setSortConfig((current) => getNextSortDirection(current, field))
  }, [])

  const sortedOpportunities = useMemo(
    () => sortOpportunities(opportunities, sortConfig),
    [opportunities, sortConfig]
  )

  return {
    opportunities: sortedOpportunities,
    loading,
    error,
    sortConfig,
    handleSort,
    refresh: () => {
      setOpportunities([...opportunities])
    },
  }
}
