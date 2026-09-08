import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'
import { useState } from 'react'

function Probe() {
  const { status, login, logout } = useAuth()
  const [result, setResult] = useState('')
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="result">{result}</span>
      <button onClick={async () => setResult(JSON.stringify(await login('pw')))}>login</button>
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

  it('login failure (401) keeps status anon and reports reason bad_password', async () => {
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
    await waitFor(() =>
      expect(screen.getByTestId('result')).toHaveTextContent('{"ok":false,"reason":"bad_password"}'),
    )
  })

  it('login against an unconfigured server (500) reports reason not_configured', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/session')
        ? new Response(JSON.stringify({ authenticated: false }), { status: 200 })
        : new Response(JSON.stringify({ error: 'auth_not_configured' }), { status: 500 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    wrap()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anon'))
    await act(async () => {
      screen.getByText('login').click()
    })
    expect(screen.getByTestId('status')).toHaveTextContent('anon')
    await waitFor(() =>
      expect(screen.getByTestId('result')).toHaveTextContent('{"ok":false,"reason":"not_configured"}'),
    )
  })
})
