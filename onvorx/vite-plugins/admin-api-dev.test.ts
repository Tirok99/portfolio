import { describe, it, expect } from 'vitest'
import { dispatchApi, KNOWN_API_PATHS, apiMiddlewareDecision } from './admin-api-dev'
import { SESSION_COOKIE, signToken } from '../api/_lib/session'

const ENV = { ADMIN_PASSWORD: 'devpassword123', ADMIN_SESSION_SECRET: 'x'.repeat(40) }

describe('dispatchApi', () => {
  it('returns null for unknown api routes', async () => {
    expect(await dispatchApi({ url: '/api/other', method: 'GET', secure: false }, ENV)).toBeNull()
    expect(await dispatchApi({ url: '/', method: 'GET', secure: false }, ENV)).toBeNull()
  })

  it('KNOWN_API_PATHS lists exactly the served routes', () => {
    expect([...KNOWN_API_PATHS].sort()).toEqual([
      '/api/admin/cards', '/api/admin/content', '/api/admin/login',
      '/api/admin/logout', '/api/admin/requests', '/api/admin/session',
      '/api/admin/upload', '/api/estimate',
    ])
  })
})

describe('apiMiddlewareDecision', () => {
  it('returns dispatch-no-body for known GET routes', () => {
    expect(apiMiddlewareDecision('/api/admin/session', 'GET')).toBe('dispatch-no-body')
  })

  it('returns dispatch-no-body for known HEAD routes', () => {
    expect(apiMiddlewareDecision('/api/admin/session', 'HEAD')).toBe('dispatch-no-body')
  })

  it('returns dispatch-with-body for known PUT routes', () => {
    expect(apiMiddlewareDecision('/api/admin/content?x=1', 'PUT')).toBe('dispatch-with-body')
  })

  it('returns dispatch-with-body for known POST routes', () => {
    expect(apiMiddlewareDecision('/api/estimate', 'POST')).toBe('dispatch-with-body')
  })

  it('returns dispatch-with-body for known PATCH routes', () => {
    expect(apiMiddlewareDecision('/api/admin/requests', 'PATCH')).toBe('dispatch-with-body')
  })

  it('returns dispatch-with-body for known DELETE routes', () => {
    expect(apiMiddlewareDecision('/api/admin/upload', 'DELETE')).toBe('dispatch-with-body')
  })

  it('returns skip for unknown /api/* routes', () => {
    expect(apiMiddlewareDecision('/api/unknown', 'POST')).toBe('skip')
  })

  it('returns skip for non-/api/ routes', () => {
    expect(apiMiddlewareDecision('/assets/x.js', 'GET')).toBe('skip')
  })
})

describe('dispatchApi', () => {
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

  it('routes PUT /api/admin/content through handleAdminContent (401 without a cookie)', async () => {
    const r = await dispatchApi(
      { url: '/api/admin/content', method: 'PUT', jsonBody: { kind: 'section', key: 'hero', patch: {} }, secure: false },
      { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    )
    expect(r?.status).toBe(401)
  })

  it('PUT /api/admin/content with a valid cookie dispatches past auth (bad key → 400)', async () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    const r = await dispatchApi(
      {
        url: '/api/admin/content',
        method: 'PUT',
        cookieHeader: `${SESSION_COOKIE}=${tok}`,
        jsonBody: { kind: 'section', key: 'bogus', patch: { title: { en: 'x', uk: 'x' } } },
        secure: false,
      },
      { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    )
    expect(r?.status).toBe(400)
  })

  it('routes GET /api/admin/requests through handleAdminRequests (401 without a cookie)', async () => {
    const r = await dispatchApi(
      { url: '/api/admin/requests', method: 'GET', secure: false },
      { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    )
    expect(r?.status).toBe(401)
  })

  it('PATCH /api/admin/requests with a valid cookie dispatches past auth (bad status → 400)', async () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    const r = await dispatchApi(
      {
        url: '/api/admin/requests',
        method: 'PATCH',
        cookieHeader: `${SESSION_COOKIE}=${tok}`,
        jsonBody: { id: 'r1', status: 'nope' },
        secure: false,
      },
      { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    )
    expect(r?.status).toBe(400)
  })

  it('routes POST /api/admin/cards through handleAdminCards (401 without a cookie)', async () => {
    const r = await dispatchApi(
      {
        url: '/api/admin/cards?type=project',
        method: 'POST',
        jsonBody: { list: 'home', card: { id: 'p1', title: { en: 'x', uk: 'x' } } },
        secure: false,
      },
      { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    )
    expect(r?.status).toBe(401)
  })

  it('POST /api/admin/cards with a valid cookie dispatches past auth (create body has no id → 400)', async () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    const r = await dispatchApi(
      {
        url: '/api/admin/cards?type=project',
        method: 'POST',
        cookieHeader: `${SESSION_COOKIE}=${tok}`,
        jsonBody: { list: 'home', card: { title: { en: 'x', uk: 'x' } } },
        secure: false,
      },
      { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    )
    expect(r?.status).toBe(400)
  })

  it('routes POST /api/admin/upload through handleAdminUpload (401 without a cookie)', async () => {
    const r = await dispatchApi(
      { url: '/api/admin/upload', method: 'POST', secure: false },
      { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    )
    expect(r?.status).toBe(401)
  })

  it('DELETE /api/admin/upload with a valid cookie but bad path dispatches past auth (400)', async () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    const r = await dispatchApi(
      {
        url: '/api/admin/upload',
        method: 'DELETE',
        cookieHeader: `${SESSION_COOKIE}=${tok}`,
        jsonBody: { path: '../secrets' },
        secure: false,
      },
      { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    )
    expect(r?.status).toBe(400)
  })
})
