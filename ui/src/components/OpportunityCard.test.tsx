import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OpportunityCard } from './OpportunityCard'
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

describe('OpportunityCard', () => {
  it('renders property address and location', () => {
    const opportunity = createOpportunity({
      address: '456 Investment Ave',
      location: 'Tampa, FL',
    })

    render(<OpportunityCard opportunity={opportunity} />)

    expect(screen.getByText('456 Investment Ave')).toBeInTheDocument()
    expect(screen.getByText('Tampa, FL')).toBeInTheDocument()
  })

  it('displays financial information', () => {
    const opportunity = createOpportunity({
      noi: 18000,
      capRate: 0.09,
    })

    render(<OpportunityCard opportunity={opportunity} />)

    expect(screen.getByText('$18,000')).toBeInTheDocument()
    expect(screen.getByText('9.0%')).toBeInTheDocument()
  })

  it('shows status badge', () => {
    const opportunity = createOpportunity({ status: 'WATCHLIST' })

    render(<OpportunityCard opportunity={opportunity} />)

    expect(screen.getByText('WATCHLIST')).toBeInTheDocument()
  })

  it('shows confidence badge', () => {
    const opportunity = createOpportunity({ confidence: 'MEDIUM' })

    render(<OpportunityCard opportunity={opportunity} />)

    expect(screen.getByText('MEDIUM')).toBeInTheDocument()
  })

  it('renders listing link', () => {
    const opportunity = createOpportunity({
      listingUrl: 'https://example.com/listing/789',
    })

    render(<OpportunityCard opportunity={opportunity} />)

    const link = screen.getByText('View Listing →')
    expect(link).toHaveAttribute('href', 'https://example.com/listing/789')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('applies correct test id', () => {
    const opportunity = createOpportunity({ id: 'my-property' })

    render(<OpportunityCard opportunity={opportunity} />)

    expect(screen.getByTestId('opportunity-card-my-property')).toBeInTheDocument()
  })

  it('highlights cap rate >= 10% in green', () => {
    const opportunity = createOpportunity({ capRate: 0.102 })

    render(<OpportunityCard opportunity={opportunity} />)

    const capRateElement = screen.getByText('10.2%')
    expect(capRateElement.style.color).toBe('rgb(5, 150, 105)')
  })

  it('highlights cap rate < 10% in red', () => {
    const opportunity = createOpportunity({ capRate: 0.08 })

    render(<OpportunityCard opportunity={opportunity} />)

    const capRateElement = screen.getByText('8.0%')
    expect(capRateElement.style.color).toBe('rgb(220, 38, 38)')
  })

  it('shows HOA value with status indicator', () => {
    const opportunity = createOpportunity({
      hoa: {
        value: 350,
        status: 'VERIFIED',
        confidence: 'HIGH',
      },
    })

    render(<OpportunityCard opportunity={opportunity} />)

    expect(screen.getByText('$350')).toBeInTheDocument()
    expect(screen.getByText('/mo')).toBeInTheDocument()
  })
})
