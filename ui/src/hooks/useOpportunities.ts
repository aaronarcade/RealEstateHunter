import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PropertyOpportunity, SortConfig, SortField } from '../types/property'
import { fetchOpportunities, sampleOpportunities } from '../data/loader'
import { sortOpportunities, getNextSortDirection } from '../data/sorting'

interface UseOpportunitiesOptions {
  useSampleData?: boolean
}

export function useOpportunities(options: UseOpportunitiesOptions = {}) {
  const { useSampleData = false } = options

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
        if (useSampleData) {
          setOpportunities(sampleOpportunities)
        } else {
          const data = await fetchOpportunities()
          if (data.length === 0) {
            setOpportunities(sampleOpportunities)
          } else {
            setOpportunities(data)
          }
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e : new Error('Failed to load opportunities'))
          setOpportunities(sampleOpportunities)
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
  }, [useSampleData])

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
