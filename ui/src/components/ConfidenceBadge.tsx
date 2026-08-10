import type { Confidence } from '../types/property'

interface ConfidenceBadgeProps {
  confidence: Confidence
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const colors = {
    HIGH: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    MEDIUM: { bg: '#e5e7eb', text: '#374151', border: '#9ca3af' },
    LOW: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  }

  const style = colors[confidence]

  return (
    <span
      className={`confidence-badge confidence-${confidence.toLowerCase()}`}
      data-confidence={confidence}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {confidence}
    </span>
  )
}
