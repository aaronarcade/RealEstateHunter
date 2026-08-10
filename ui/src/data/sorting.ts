import type { PropertyOpportunity, SortConfig, SortField, Status, Confidence } from '../types/property'

/**
 * Status priority order (VIABLE first per PRODUCT.md ranking rules)
 */
const STATUS_ORDER: Record<Status, number> = {
  VIABLE: 0,
  WATCHLIST: 1,
  REJECTED: 2,
}

/**
 * Confidence priority order (HIGH first per PRODUCT.md ranking rules)
 */
const CONFIDENCE_ORDER: Record<Confidence, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
}

/**
 * Compare two opportunities by a given field (ascending order)
 * All comparisons return positive if a > b, negative if a < b
 */
function compareByField(a: PropertyOpportunity, b: PropertyOpportunity, field: SortField): number {
  switch (field) {
    case 'status':
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]

    case 'confidence':
      return CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence]

    case 'capRate':
      return a.capRate - b.capRate

    case 'noi':
      return a.noi - b.noi

    default:
      return 0
  }
}

/**
 * Sort opportunities according to PRODUCT.md ranking rules:
 * 1. Status (VIABLE first)
 * 2. Confidence in the analysis
 * 3. Cap rate (higher is better)
 * 4. Estimated annual cash generation (NOI, higher is better)
 */
export function sortOpportunities(
  opportunities: PropertyOpportunity[],
  config?: SortConfig
): PropertyOpportunity[] {
  const sorted = [...opportunities]

  if (config) {
    sorted.sort((a, b) => {
      const result = compareByField(a, b, config.field)
      return config.direction === 'desc' ? -result : result
    })
  } else {
    sorted.sort((a, b) => {
      let result = compareByField(a, b, 'status')
      if (result !== 0) return result

      result = compareByField(a, b, 'confidence')
      if (result !== 0) return result

      result = -compareByField(a, b, 'capRate')
      if (result !== 0) return result

      return -compareByField(a, b, 'noi')
    })
  }

  return sorted
}

/**
 * Get the next sort direction for toggling
 */
export function getNextSortDirection(
  currentConfig: SortConfig | undefined,
  field: SortField
): SortConfig {
  if (currentConfig?.field === field) {
    return {
      field,
      direction: currentConfig.direction === 'asc' ? 'desc' : 'asc',
    }
  }
  const defaultDesc: SortField[] = ['capRate', 'noi']
  return {
    field,
    direction: defaultDesc.includes(field) ? 'desc' : 'asc',
  }
}
