import type { FieldValue } from '../types/property'

interface FieldValueDisplayProps {
  field: FieldValue
  format?: 'currency' | 'number'
  showStatus?: boolean
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function FieldValueDisplay({
  field,
  format = 'currency',
  showStatus = false,
}: FieldValueDisplayProps) {
  if (field.value === null) {
    return (
      <span className="field-value field-value-unknown" style={{ color: '#9ca3af' }}>
        Unknown
      </span>
    )
  }

  const formattedValue =
    format === 'currency' ? formatCurrency(field.value) : formatNumber(field.value)

  const statusIndicator =
    field.status === 'VERIFIED' ? '✓' : field.status === 'ESTIMATED' ? '~' : '?'

  const statusColor =
    field.status === 'VERIFIED'
      ? '#16a34a'
      : field.status === 'ESTIMATED'
        ? '#d97706'
        : '#9ca3af'

  return (
    <span
      className={`field-value field-value-${field.status.toLowerCase()}`}
      title={field.evidence || `Status: ${field.status}, Confidence: ${field.confidence}`}
    >
      {formattedValue}
      {showStatus && (
        <span
          style={{
            marginLeft: '0.25rem',
            color: statusColor,
            fontSize: '0.75em',
          }}
        >
          {statusIndicator}
        </span>
      )}
    </span>
  )
}
