import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'
import * as authModule from './useAuth'

function mockStatus(status: 'checking' | 'authed' | 'anon') {
  vi.spyOn(authModule, 'useAuth').mockReturnValue({
    status,
    login: vi.fn(),
    logout: vi.fn(),
    recheck: vi.fn(),
  } as never)
}

function renderAt(status: 'checking' | 'authed' | 'anon') {
  mockStatus(status)
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<RequireAuth><div>secret</div></RequireAuth>} />
        <Route path="/admin/login" element={<div>login screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function FromProbe() {
  const location = useLocation()
  return <div data-testid="from">{(location.state as { from?: string } | null)?.from ?? ''}</div>
}

describe('RequireAuth', () => {
  it('shows a placeholder while checking', () => {
    renderAt('checking')
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.queryByText('login screen')).not.toBeInTheDocument()
  })
  it('redirects to login when anon', () => {
    renderAt('anon')
    expect(screen.getByText('login screen')).toBeInTheDocument()
  })
  it('renders children when authed', () => {
    renderAt('authed')
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
  it('round-trips a deep link with query and hash in navigation state', () => {
    mockStatus('anon')
    render(
      <MemoryRouter initialEntries={['/admin/requests?status=open#row-3']}>
        <Routes>
          <Route path="/admin/requests" element={<RequireAuth><div>secret</div></RequireAuth>} />
          <Route path="/admin/login" element={<FromProbe />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('from')).toHaveTextContent('/admin/requests?status=open#row-3')
  })
})
