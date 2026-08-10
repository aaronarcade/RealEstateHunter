import type { PropertyOpportunity, SortConfig, SortField } from '../types/property'
import { StatusBadge } from './StatusBadge'
import { ConfidenceBadge } from './ConfidenceBadge'
import { FieldValueDisplay } from './FieldValueDisplay'

interface OpportunityTableProps {
  opportunities: PropertyOpportunity[]
  sortConfig?: SortConfig
  onSort?: (field: SortField) => void
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

interface SortableHeaderProps {
  field: SortField
  label: string
  sortConfig?: SortConfig
  onSort?: (field: SortField) => void
}

function SortableHeader({ field, label, sortConfig, onSort }: SortableHeaderProps) {
  const isActive = sortConfig?.field === field
  const direction = isActive ? sortConfig.direction : null

  return (
    <th
      onClick={() => onSort?.(field)}
      style={{
        padding: '0.75rem 1rem',
        textAlign: 'left',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: isActive ? '#111827' : '#6b7280',
        backgroundColor: '#f9fafb',
        cursor: onSort ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {direction && (
        <span style={{ marginLeft: '0.25rem' }}>
          {direction === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </th>
  )
}

export function OpportunityTable({
  opportunities,
  sortConfig,
  onSort,
}: OpportunityTableProps) {
  if (opportunities.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#6b7280',
        }}
      >
        No opportunities to display
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
        }}
        data-testid="opportunity-table"
      >
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th
              style={{
                padding: '0.75rem 1rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
              }}
            >
              Property
            </th>
            <th
              style={{
                padding: '0.75rem 1rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
              }}
            >
              Location
            </th>
            <th
              style={{
                padding: '0.75rem 1rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
              }}
            >
              Price
            </th>
            <th
              style={{
                padding: '0.75rem 1rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
              }}
            >
              Rent
            </th>
            <SortableHeader
              field="noi"
              label="NOI"
              sortConfig={sortConfig}
              onSort={onSort}
            />
            <SortableHeader
              field="capRate"
              label="Cap Rate"
              sortConfig={sortConfig}
              onSort={onSort}
            />
            <th
              style={{
                padding: '0.75rem 1rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
              }}
            >
              HOA
            </th>
            <th
              style={{
                padding: '0.75rem 1rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
              }}
            >
              Assessments
            </th>
            <SortableHeader
              field="confidence"
              label="Confidence"
              sortConfig={sortConfig}
              onSort={onSort}
            />
            <SortableHeader
              field="status"
              label="Status"
              sortConfig={sortConfig}
              onSort={onSort}
            />
            <th
              style={{
                padding: '0.75rem 1rem',
                textAlign: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
              }}
            >
              Link
            </th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opportunity) => (
            <tr
              key={opportunity.id}
              data-testid={`opportunity-row-${opportunity.id}`}
              className={`opportunity-row opportunity-${opportunity.status.toLowerCase()}`}
              style={{
                borderBottom: '1px solid #e5e7eb',
                backgroundColor:
                  opportunity.status === 'VIABLE'
                    ? '#f0fdf4'
                    : opportunity.status === 'WATCHLIST'
                      ? '#fffbeb'
                      : '#fef2f2',
              }}
            >
              <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                {opportunity.address}
              </td>
              <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>
                {opportunity.location}
              </td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                <FieldValueDisplay field={opportunity.purchasePrice} showStatus />
              </td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                <FieldValueDisplay field={opportunity.monthlyRent} showStatus />
              </td>
              <td
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'right',
                  fontWeight: 500,
                  color: '#059669',
                }}
              >
                {formatCurrency(opportunity.noi)}
              </td>
              <td
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: opportunity.capRate >= 0.1 ? '#059669' : '#dc2626',
                }}
              >
                {formatPercent(opportunity.capRate)}
              </td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                <FieldValueDisplay field={opportunity.hoa} showStatus />
              </td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                <FieldValueDisplay field={opportunity.assessment} showStatus />
              </td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                <ConfidenceBadge confidence={opportunity.confidence} />
              </td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                <StatusBadge status={opportunity.status} />
              </td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                <a
                  href={opportunity.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#2563eb',
                    textDecoration: 'none',
                  }}
                  title="View listing"
                >
                  🔗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
