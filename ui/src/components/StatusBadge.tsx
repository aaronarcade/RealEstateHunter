import type { Status } from '../types/property'

interface StatusBadgeProps {
  status: Status
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`status-badge status-${status.toLowerCase()}`}
      data-status={status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        backgroundColor:
          status === 'VIABLE'
            ? '#dcfce7'
            : status === 'WATCHLIST'
              ? '#fef3c7'
              : '#fee2e2',
        color:
          status === 'VIABLE'
            ? '#166534'
            : status === 'WATCHLIST'
              ? '#92400e'
              : '#991b1b',
        border: `1px solid ${
          status === 'VIABLE'
            ? '#86efac'
            : status === 'WATCHLIST'
              ? '#fcd34d'
              : '#fca5a5'
        }`,
      }}
    >
      {status}
    </span>
  )
}
