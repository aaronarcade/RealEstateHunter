import { useState } from 'react'
import { OpportunityTable, OpportunityCard } from './components'
import { useOpportunities } from './hooks/useOpportunities'
import './App.css'

type ViewMode = 'table' | 'card'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const { opportunities, loading, error, sortConfig, handleSort } = useOpportunities()

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#111827',
              }}
            >
              RealEstateHunter
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
              Investment Opportunities
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: viewMode === 'table' ? '#111827' : '#ffffff',
                color: viewMode === 'table' ? '#ffffff' : '#374151',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('card')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: viewMode === 'card' ? '#111827' : '#ffffff',
                color: viewMode === 'card' ? '#ffffff' : '#374151',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Cards
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            Loading opportunities...
          </div>
        )}

        {error && (
          <div
            style={{
              textAlign: 'center',
              padding: '1.5rem',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            {error.message}
          </div>
        )}

        {!loading && viewMode === 'table' && (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
            }}
          >
            <OpportunityTable
              opportunities={opportunities}
              sortConfig={sortConfig}
              onSort={handleSort}
            />
          </div>
        )}

        {!loading && viewMode === 'card' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1rem',
            }}
          >
            {opportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        )}

        {!loading && opportunities.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#6b7280',
            }}
          >
            No opportunities found
          </div>
        )}

        <footer
          style={{
            marginTop: '2rem',
            padding: '1rem 0',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '0.75rem',
          }}
        >
          <p>
            Ranking priority: Status (VIABLE first) → Confidence → Cap Rate → NOI
          </p>
          <p style={{ marginTop: '0.25rem' }}>
            Target: ≥10% unlevered cap rate with verified inputs
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
