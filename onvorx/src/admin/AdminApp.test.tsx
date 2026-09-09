import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../i18n/i18n'
import { SiteContentProvider } from '../content/SiteContentProvider'
import AdminApp from './AdminApp'

const fetchAuthed = (authed: boolean) =>
  vi.fn(async () => new Response(JSON.stringify({ authenticated: authed }), { status: 200 }))

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

const wrap = (path: string) =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/admin/*" element={<AdminApp />} />
          </Routes>
        </MemoryRouter>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('AdminApp', () => {
  it('renders the login screen at /admin/login', async () => {
    vi.stubGlobal('fetch', fetchAuthed(false))
    wrap('/admin/login')
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('redirects an anonymous visitor from /admin to the login screen', async () => {
    vi.stubGlobal('fetch', fetchAuthed(false))
    wrap('/admin')
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows the admin layout (sidebar nav) when authed', async () => {
    vi.stubGlobal('fetch', fetchAuthed(true))
    wrap('/admin')
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: /admin/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /content/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /requests/i })).toBeInTheDocument()
  })
})
