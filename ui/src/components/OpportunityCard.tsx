import type { PropertyOpportunity } from '../types/property'
import { StatusBadge } from './StatusBadge'
import { ConfidenceBadge } from './ConfidenceBadge'
import { FieldValueDisplay } from './FieldValueDisplay'

interface OpportunityCardProps {
  opportunity: PropertyOpportunity
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%'
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const statusBorderColor =
    opportunity.status === 'VIABLE'
      ? '#22c55e'
      : opportunity.status === 'WATCHLIST'
        ? '#eab308'
        : '#ef4444'

  return (
    <article
      className={`opportunity-card opportunity-${opportunity.status.toLowerCase()}`}
      data-testid={`opportunity-card-${opportunity.id}`}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        borderLeft: `4px solid ${statusBorderColor}`,
        padding: '1.25rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        transition: 'box-shadow 0.2s',
      }}
    >
      <header style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#111827',
            }}
          >
            {opportunity.address}
          </h3>
          <StatusBadge status={opportunity.status} />
        </div>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
          {opportunity.location}
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.125rem' }}>
            Price
          </div>
          <div style={{ fontWeight: 500 }}>
            <FieldValueDisplay field={opportunity.purchasePrice} showStatus />
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.125rem' }}>
            Monthly Rent
          </div>
          <div style={{ fontWeight: 500 }}>
            <FieldValueDisplay field={opportunity.monthlyRent} showStatus />
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.125rem' }}>
            NOI
          </div>
          <div style={{ fontWeight: 500, color: '#059669' }}>
            {formatCurrency(opportunity.noi)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.125rem' }}>
            Cap Rate
          </div>
          <div
            style={{
              fontWeight: 600,
              color: opportunity.capRate >= 0.1 ? '#059669' : '#dc2626',
              fontSize: '1.125rem',
            }}
          >
            {formatPercent(opportunity.capRate)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.125rem' }}>
            HOA
          </div>
          <div>
            <FieldValueDisplay field={opportunity.hoa} showStatus />
            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>/mo</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.125rem' }}>
            Assessments
          </div>
          <div>
            <FieldValueDisplay field={opportunity.assessment} showStatus />
          </div>
        </div>
      </div>

      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '0.75rem',
          borderTop: '1px solid #f3f4f6',
        }}
      >
        <ConfidenceBadge confidence={opportunity.confidence} />
        <a
          href={opportunity.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#2563eb',
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}
        >
          View Listing →
        </a>
      </footer>
    </article>
  )
}
