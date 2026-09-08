import { describe, it, expect } from 'vitest'
import { handleLogin, handleSession, handleLogout, requireSession } from './handlers'
import { SESSION_COOKIE, signToken } from './session'

const ENV = {
  ADMIN_PASSWORD: 'correct horse battery staple',
  ADMIN_SESSION_SECRET: 'secret-secret-secret-secret-secret-secret',
}

describe('handleLogin', () => {
  it('405 on non-POST', () => {
    expect(handleLogin({ method: 'GET', password: 'x', secure: true }, ENV).status).toBe(405)
  })
  it('500 when env is not configured', () => {
    expect(handleLogin({ method: 'POST', password: 'x', secure: true }, {}).status).toBe(500)
  })
  it('401 on wrong password, no cookie', () => {
    const r = handleLogin({ method: 'POST', password: 'nope', secure: true }, ENV)
    expect(r.status).toBe(401)
    expect(r.setCookie).toBeUndefined()
  })
  it('401 on missing/non-string password', () => {
    expect(handleLogin({ method: 'POST', password: undefined, secure: true }, ENV).status).toBe(401)
    expect(handleLogin({ method: 'POST', password: 123, secure: true }, ENV).status).toBe(401)
  })
  it('200 + Secure session cookie on correct password', () => {
    const r = handleLogin(
      { method: 'POST', password: 'correct horse battery staple', secure: true },
      ENV,
    )
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ authenticated: true })
    expect(r.setCookie).toContain(`${SESSION_COOKIE}=`)
    expect(r.setCookie).toContain('HttpOnly')
    expect(r.setCookie).toContain('Secure')
  })
  it('omits Secure when secure=false (dev http)', () => {
    const r = handleLogin(
      { method: 'POST', password: 'correct horse battery staple', secure: false },
      ENV,
    )
    expect(r.setCookie).not.toContain('Secure')
  })
})

describe('handleSession', () => {
  it('405 on non-GET', () => {
    expect(handleSession({ method: 'POST', cookieHeader: '' }, ENV).status).toBe(405)
  })
  it('authenticated:false with no cookie', () => {
    const r = handleSession({ method: 'GET', cookieHeader: undefined }, ENV)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ authenticated: false })
  })
  it('authenticated:true with a valid cookie', () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    const r = handleSession({ method: 'GET', cookieHeader: `${SESSION_COOKIE}=${tok}` }, ENV)
    expect(r.body).toEqual({ authenticated: true })
  })
  it('authenticated:false with a garbage cookie', () => {
    const r = handleSession(
      { method: 'GET', cookieHeader: `${SESSION_COOKIE}=not.a.real.token` },
      ENV,
    )
    expect(r.body).toEqual({ authenticated: false })
  })
  it('authenticated:false with a malformed cookie header (does not throw)', () => {
    const r = handleSession({ method: 'GET', cookieHeader: 'admin_session=%' }, ENV)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ authenticated: false })
  })
})

describe('requireSession', () => {
  it('true for a valid session cookie', () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    expect(requireSession(`${SESSION_COOKIE}=${tok}`, ENV)).toBe(true)
  })
  it('false with no cookie', () => {
    expect(requireSession(undefined, ENV)).toBe(false)
  })
  it('false with a garbage cookie', () => {
    expect(requireSession(`${SESSION_COOKIE}=not.a.token`, ENV)).toBe(false)
  })
  it('false with a malformed cookie header (does not throw)', () => {
    expect(() => requireSession('admin_session=%', ENV)).not.toThrow()
    expect(requireSession('admin_session=%', ENV)).toBe(false)
  })
  it('false for an expired cookie', () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET, 1000)
    expect(requireSession(`${SESSION_COOKIE}=${tok}`, ENV)).toBe(false)
  })
  it('false when the secret is missing', () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    expect(requireSession(`${SESSION_COOKIE}=${tok}`, {})).toBe(false)
  })
})

describe('handleLogout', () => {
  it('405 on non-POST', () => {
    expect(handleLogout({ method: 'GET', secure: true }).status).toBe(405)
  })
  it('clears the cookie', () => {
    const r = handleLogout({ method: 'POST', secure: true })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ authenticated: false })
    expect(r.setCookie).toContain(`${SESSION_COOKIE}=;`)
    expect(r.setCookie).toContain('Max-Age=0')
  })
})
