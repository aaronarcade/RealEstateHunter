import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders VIABLE status', () => {
    render(<StatusBadge status="VIABLE" />)

    const badge = screen.getByText('VIABLE')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('data-status', 'VIABLE')
  })

  it('renders WATCHLIST status', () => {
    render(<StatusBadge status="WATCHLIST" />)

    const badge = screen.getByText('WATCHLIST')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('data-status', 'WATCHLIST')
  })

  it('renders REJECTED status', () => {
    render(<StatusBadge status="REJECTED" />)

    const badge = screen.getByText('REJECTED')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('data-status', 'REJECTED')
  })

  it('has appropriate class for styling', () => {
    render(<StatusBadge status="VIABLE" />)

    const badge = screen.getByText('VIABLE')
    expect(badge.className).toContain('status-badge')
    expect(badge.className).toContain('status-viable')
  })
})
