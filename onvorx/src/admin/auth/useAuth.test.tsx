import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'

function Probe() {
  const { status, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <button onClick={() => login('pw')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  )
}

const wrap = () => render(<AuthProvider><Probe /></AuthProvider>)

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useAuth', () => {
  it('checks the session on mount → anon', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ authenticated: false }), { status: 200 })))
    wrap()
    expect(screen.getByTestId('status')).toHaveTextContent('checking')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anon'))
  })

  it('checks the session on mount → authed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ authenticated: true }), { status: 200 })))
    wrap()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authed'))
  })

  it('login success flips status to authed', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/session')
        ? new Response(JSON.stringify({ authenticated: false }), { status: 200 })
        : new Response(JSON.stringify({ authenticated: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    wrap()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anon'))
    await act(async () => {
      screen.getByText('login').click()
    })
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authed'))
  })

  it('login failure (401) keeps status anon', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/session')
        ? new Response(JSON.stringify({ authenticated: false }), { status: 200 })
        : new Response(JSON.stringify({ authenticated: false }), { status: 401 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    wrap()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anon'))
    await act(async () => {
      screen.getByText('login').click()
    })
    expect(screen.getByTestId('status')).toHaveTextContent('anon')
  })
})
