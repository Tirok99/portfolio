import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'
import * as authModule from './useAuth'

function renderAt(status: 'checking' | 'authed' | 'anon') {
  vi.spyOn(authModule, 'useAuth').mockReturnValue({
    status,
    login: vi.fn(),
    logout: vi.fn(),
    recheck: vi.fn(),
  } as never)
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<RequireAuth><div>secret</div></RequireAuth>} />
        <Route path="/admin/login" element={<div>login screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
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
})
