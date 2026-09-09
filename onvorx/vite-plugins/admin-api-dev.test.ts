import { describe, it, expect } from 'vitest'
import { dispatchAdminApi } from './admin-api-dev'
import { SESSION_COOKIE, signToken } from '../api/_lib/session'

const ENV = { ADMIN_PASSWORD: 'devpassword123', ADMIN_SESSION_SECRET: 'x'.repeat(40) }

describe('dispatchAdminApi', () => {
  it('returns null for non-admin routes', () => {
    expect(dispatchAdminApi({ url: '/api/other', method: 'GET', secure: false }, ENV)).toBeNull()
    expect(dispatchAdminApi({ url: '/', method: 'GET', secure: false }, ENV)).toBeNull()
  })

  it('handles login with a JSON body', () => {
    const r = dispatchAdminApi(
      { url: '/api/admin/login', method: 'POST', jsonBody: { password: 'devpassword123' }, secure: false },
      ENV,
    )
    expect(r?.status).toBe(200)
    expect(r?.setCookie).toContain(`${SESSION_COOKIE}=`)
    expect(r?.setCookie).not.toContain('Secure')
  })

  it('handles session with a cookie header', () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    const r = dispatchAdminApi(
      { url: '/api/admin/session', method: 'GET', cookieHeader: `${SESSION_COOKIE}=${tok}`, secure: false },
      ENV,
    )
    expect(r?.body).toEqual({ authenticated: true })
  })

  it('handles logout', () => {
    const r = dispatchAdminApi({ url: '/api/admin/logout', method: 'POST', secure: false }, ENV)
    expect(r?.setCookie).toContain('Max-Age=0')
  })

  it('ignores query strings on the path match', () => {
    const r = dispatchAdminApi({ url: '/api/admin/session?ts=1', method: 'GET', secure: false }, ENV)
    expect(r?.body).toEqual({ authenticated: false })
  })
})
