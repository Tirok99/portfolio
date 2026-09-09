import { describe, it, expect } from 'vitest'
import { dispatchApi } from './admin-api-dev'
import { SESSION_COOKIE, signToken } from '../api/_lib/session'

const ENV = { ADMIN_PASSWORD: 'devpassword123', ADMIN_SESSION_SECRET: 'x'.repeat(40) }

describe('dispatchApi', () => {
  it('returns null for unknown api routes', async () => {
    expect(await dispatchApi({ url: '/api/other', method: 'GET', secure: false }, ENV)).toBeNull()
    expect(await dispatchApi({ url: '/', method: 'GET', secure: false }, ENV)).toBeNull()
  })

  it('handles login with a JSON body', async () => {
    const r = await dispatchApi(
      { url: '/api/admin/login', method: 'POST', jsonBody: { password: 'devpassword123' }, secure: false },
      ENV,
    )
    expect(r?.status).toBe(200)
    expect(r?.setCookie).toContain(`${SESSION_COOKIE}=`)
    expect(r?.setCookie).not.toContain('Secure')
  })

  it('handles session with a cookie header', async () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    const r = await dispatchApi(
      { url: '/api/admin/session', method: 'GET', cookieHeader: `${SESSION_COOKIE}=${tok}`, secure: false },
      ENV,
    )
    expect(r?.body).toEqual({ authenticated: true })
  })

  it('handles logout', async () => {
    const r = await dispatchApi({ url: '/api/admin/logout', method: 'POST', secure: false }, ENV)
    expect(r?.setCookie).toContain('Max-Age=0')
  })

  it('ignores query strings on the path match', async () => {
    const r = await dispatchApi({ url: '/api/admin/session?ts=1', method: 'GET', secure: false }, ENV)
    expect(r?.body).toEqual({ authenticated: false })
  })

  it('routes POST /api/estimate through handleEstimate', async () => {
    const r = await dispatchApi(
      { url: '/api/estimate', method: 'POST', jsonBody: { name: '' }, secure: false },
      { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    )
    expect(r?.status).toBe(400) // invalid body, but it was routed
  })

  it('405s a GET /api/estimate', async () => {
    const r = await dispatchApi(
      { url: '/api/estimate', method: 'GET', secure: false },
      { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    )
    expect(r?.status).toBe(405)
  })
})
