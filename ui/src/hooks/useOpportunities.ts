import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PropertyOpportunity, SortConfig, SortField } from '../types/property'
import { fetchOpportunities, sampleOpportunities } from '../data/loader'
import { sortOpportunities, getNextSortDirection } from '../data/sorting'
import { isSampleDataEnabled } from '../data/supabase'

interface UseOpportunitiesOptions {
  /** Force use of sample data (for testing) - overrides VITE_USE_SAMPLE_DATA */
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
          if (data.length === 0 && isSampleDataEnabled()) {
            setOpportunities(sampleOpportunities)
          } else {
            setOpportunities(data)
          }
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e : new Error('Failed to load opportunities'))
          if (isSampleDataEnabled()) {
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
