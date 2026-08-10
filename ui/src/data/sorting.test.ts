import { describe, it, expect } from 'vitest'
import { sortOpportunities, getNextSortDirection } from './sorting'
import type { PropertyOpportunity, SortConfig } from '../types/property'

const createOpportunity = (
  overrides: Partial<PropertyOpportunity>
): PropertyOpportunity => ({
  id: 'test-id',
  address: '123 Test St',
  location: 'Test City, FL',
  listingUrl: 'https://example.com',
  purchasePrice: { value: 200000, status: 'VERIFIED', confidence: 'HIGH' },
  monthlyRent: { value: 2000, status: 'VERIFIED', confidence: 'HIGH' },
  annualGrossRent: 24000,
  annualOperatingExpenses: 4000,
  noi: 20000,
  capRate: 0.1,
  hoa: { value: 200, status: 'VERIFIED', confidence: 'HIGH' },
  assessment: { value: 0, status: 'VERIFIED', confidence: 'HIGH' },
  confidence: 'HIGH',
  status: 'VIABLE',
  ...overrides,
})

describe('sortOpportunities', () => {
  it('returns empty array for empty input', () => {
    expect(sortOpportunities([])).toEqual([])
  })

  it('sorts by default ranking (status > confidence > cap rate > NOI)', () => {
    const opportunities: PropertyOpportunity[] = [
      createOpportunity({ id: 'rejected', status: 'REJECTED', capRate: 0.08 }),
      createOpportunity({ id: 'viable-low', status: 'VIABLE', confidence: 'LOW' }),
      createOpportunity({ id: 'viable-high', status: 'VIABLE', confidence: 'HIGH' }),
      createOpportunity({ id: 'watchlist', status: 'WATCHLIST' }),
    ]

    const sorted = sortOpportunities(opportunities)

    expect(sorted.map((o) => o.id)).toEqual([
      'viable-high',
      'viable-low',
      'watchlist',
      'rejected',
    ])
  })

  it('sorts by status when configured', () => {
    const opportunities: PropertyOpportunity[] = [
      createOpportunity({ id: 'rejected', status: 'REJECTED' }),
      createOpportunity({ id: 'viable', status: 'VIABLE' }),
      createOpportunity({ id: 'watchlist', status: 'WATCHLIST' }),
    ]

    const config: SortConfig = { field: 'status', direction: 'asc' }
    const sorted = sortOpportunities(opportunities, config)

    expect(sorted.map((o) => o.id)).toEqual(['viable', 'watchlist', 'rejected'])
  })

  it('reverses status order for desc direction', () => {
    const opportunities: PropertyOpportunity[] = [
      createOpportunity({ id: 'viable', status: 'VIABLE' }),
      createOpportunity({ id: 'rejected', status: 'REJECTED' }),
    ]

    const config: SortConfig = { field: 'status', direction: 'desc' }
    const sorted = sortOpportunities(opportunities, config)

    expect(sorted.map((o) => o.id)).toEqual(['rejected', 'viable'])
  })

  it('sorts by cap rate descending by default', () => {
    const opportunities: PropertyOpportunity[] = [
      createOpportunity({ id: 'low', capRate: 0.08 }),
      createOpportunity({ id: 'high', capRate: 0.12 }),
      createOpportunity({ id: 'mid', capRate: 0.1 }),
    ]

    const config: SortConfig = { field: 'capRate', direction: 'desc' }
    const sorted = sortOpportunities(opportunities, config)

    expect(sorted.map((o) => o.id)).toEqual(['high', 'mid', 'low'])
  })

  it('sorts by NOI descending', () => {
    const opportunities: PropertyOpportunity[] = [
      createOpportunity({ id: 'low', noi: 15000 }),
      createOpportunity({ id: 'high', noi: 25000 }),
      createOpportunity({ id: 'mid', noi: 20000 }),
    ]

    const config: SortConfig = { field: 'noi', direction: 'desc' }
    const sorted = sortOpportunities(opportunities, config)

    expect(sorted.map((o) => o.id)).toEqual(['high', 'mid', 'low'])
  })

  it('sorts by confidence', () => {
    const opportunities: PropertyOpportunity[] = [
      createOpportunity({ id: 'medium', confidence: 'MEDIUM' }),
      createOpportunity({ id: 'high', confidence: 'HIGH' }),
      createOpportunity({ id: 'low', confidence: 'LOW' }),
    ]

    const config: SortConfig = { field: 'confidence', direction: 'asc' }
    const sorted = sortOpportunities(opportunities, config)

    expect(sorted.map((o) => o.id)).toEqual(['high', 'medium', 'low'])
  })

  it('does not mutate original array', () => {
    const original: PropertyOpportunity[] = [
      createOpportunity({ id: 'b' }),
      createOpportunity({ id: 'a' }),
    ]

    const sorted = sortOpportunities(original)

    expect(sorted).not.toBe(original)
    expect(original[0].id).toBe('b')
  })
})

describe('getNextSortDirection', () => {
  it('returns asc for new status field', () => {
    const result = getNextSortDirection(undefined, 'status')
    expect(result).toEqual({ field: 'status', direction: 'asc' })
  })

  it('returns desc for new capRate field', () => {
    const result = getNextSortDirection(undefined, 'capRate')
    expect(result).toEqual({ field: 'capRate', direction: 'desc' })
  })

  it('returns desc for new noi field', () => {
    const result = getNextSortDirection(undefined, 'noi')
    expect(result).toEqual({ field: 'noi', direction: 'desc' })
  })

  it('toggles direction when same field clicked', () => {
    const current: SortConfig = { field: 'status', direction: 'asc' }
    const result = getNextSortDirection(current, 'status')
    expect(result).toEqual({ field: 'status', direction: 'desc' })
  })

  it('resets direction when different field clicked', () => {
    const current: SortConfig = { field: 'status', direction: 'desc' }
    const result = getNextSortDirection(current, 'capRate')
    expect(result).toEqual({ field: 'capRate', direction: 'desc' })
  })
})
