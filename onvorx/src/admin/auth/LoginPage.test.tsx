import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import * as authModule from './useAuth'

function setup(login: ReturnType<typeof vi.fn>, status: 'anon' | 'authed' = 'anon') {
  vi.spyOn(authModule, 'useAuth').mockReturnValue({
    status, login, logout: vi.fn(), recheck: vi.fn(),
  } as never)
  return render(
    <MemoryRouter initialEntries={['/admin/login']}>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('submits the password and navigates to /admin on success', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => ({ ok: true }))
    setup(login)
    await user.type(screen.getByLabelText(/password/i), 's3cret')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(login).toHaveBeenCalledWith('s3cret')
    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('shows an error on failed login and does not navigate', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => ({ ok: false, reason: 'bad_password' }))
    setup(login)
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument()
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument()
  })

  it('shows a configuration message when the server is not configured', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => ({ ok: false, reason: 'not_configured' }))
    setup(login)
    await user.type(screen.getByLabelText(/password/i), 'whatever')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/isn't configured on the server yet/i)).toBeInTheDocument()
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument()
  })

  it('shows an error when login rejects (network failure) and does not navigate', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => {
      throw new Error('network down')
    })
    setup(login)
    await user.type(screen.getByLabelText(/password/i), 'whatever')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/couldn't reach the server/i)).toBeInTheDocument()
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
  })

  it('redirects to /admin if already authed', () => {
    setup(vi.fn(), 'authed')
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })
})
