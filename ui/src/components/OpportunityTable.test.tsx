import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OpportunityTable } from './OpportunityTable'
import type { PropertyOpportunity } from '../types/property'

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

describe('OpportunityTable', () => {
  it('renders empty state when no opportunities', () => {
    render(<OpportunityTable opportunities={[]} />)

    expect(screen.getByText('No opportunities to display')).toBeInTheDocument()
  })

  it('renders table with opportunities', () => {
    const opportunities = [
      createOpportunity({ id: 'prop-1', address: '123 Main St' }),
      createOpportunity({ id: 'prop-2', address: '456 Oak Ave' }),
    ]

    render(<OpportunityTable opportunities={opportunities} />)

    expect(screen.getByTestId('opportunity-table')).toBeInTheDocument()
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
    expect(screen.getByText('456 Oak Ave')).toBeInTheDocument()
  })

  it('displays all required fields', () => {
    const opportunity = createOpportunity({
      id: 'test',
      address: '789 Test Blvd',
      location: 'Tampa, FL',
    })

    render(<OpportunityTable opportunities={[opportunity]} />)

    expect(screen.getByText('789 Test Blvd')).toBeInTheDocument()
    expect(screen.getByText('Tampa, FL')).toBeInTheDocument()
    expect(screen.getByText('$200,000')).toBeInTheDocument()
    expect(screen.getByText('$2,000')).toBeInTheDocument()
    expect(screen.getByText('$20,000')).toBeInTheDocument()
    expect(screen.getByText('10.0%')).toBeInTheDocument()
  })

  it('shows status badge for each opportunity', () => {
    const opportunities = [
      createOpportunity({ id: 'viable', status: 'VIABLE' }),
      createOpportunity({ id: 'rejected', status: 'REJECTED' }),
    ]

    render(<OpportunityTable opportunities={opportunities} />)

    expect(screen.getByText('VIABLE')).toBeInTheDocument()
    expect(screen.getByText('REJECTED')).toBeInTheDocument()
  })

  it('shows confidence badge for each opportunity', () => {
    const opportunities = [
      createOpportunity({ id: 'high', confidence: 'HIGH' }),
      createOpportunity({ id: 'low', confidence: 'LOW' }),
    ]

    render(<OpportunityTable opportunities={opportunities} />)

    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('LOW')).toBeInTheDocument()
  })

  it('calls onSort when sortable header clicked', () => {
    const onSort = vi.fn()
    const opportunities = [createOpportunity({ id: 'test' })]

    render(
      <OpportunityTable opportunities={opportunities} onSort={onSort} />
    )

    fireEvent.click(screen.getByText('Cap Rate'))

    expect(onSort).toHaveBeenCalledWith('capRate')
  })

  it('shows sort indicator for active sort field', () => {
    const opportunities = [createOpportunity({ id: 'test' })]
    const sortConfig = { field: 'capRate' as const, direction: 'desc' as const }

    render(
      <OpportunityTable
        opportunities={opportunities}
        sortConfig={sortConfig}
        onSort={() => {}}
      />
    )

    const header = screen.getByText('Cap Rate')
    expect(header.textContent).toContain('↓')
  })

  it('renders listing link for each opportunity', () => {
    const opportunity = createOpportunity({
      id: 'test',
      listingUrl: 'https://example.com/listing/123',
    })

    render(<OpportunityTable opportunities={[opportunity]} />)

    const link = screen.getByTitle('View listing')
    expect(link).toHaveAttribute('href', 'https://example.com/listing/123')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('applies status-based row styling', () => {
    const opportunities = [
      createOpportunity({ id: 'viable', status: 'VIABLE' }),
      createOpportunity({ id: 'watchlist', status: 'WATCHLIST' }),
      createOpportunity({ id: 'rejected', status: 'REJECTED' }),
    ]

    render(<OpportunityTable opportunities={opportunities} />)

    const viableRow = screen.getByTestId('opportunity-row-viable')
    const watchlistRow = screen.getByTestId('opportunity-row-watchlist')
    const rejectedRow = screen.getByTestId('opportunity-row-rejected')

    expect(viableRow.className).toContain('opportunity-viable')
    expect(watchlistRow.className).toContain('opportunity-watchlist')
    expect(rejectedRow.className).toContain('opportunity-rejected')
  })
})
