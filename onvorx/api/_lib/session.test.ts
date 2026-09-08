import { describe, it, expect } from 'vitest'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signToken,
  verifyToken,
  parseCookies,
  serializeCookie,
} from './session'

const SECRET = 'test-secret-value-at-least-32-characters-long'

describe('signToken / verifyToken', () => {
  it('round-trips a fresh token', () => {
    const t = signToken(SECRET, 1_000_000)
    expect(t).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(verifyToken(t, SECRET, 1_000_001)).toBe(true)
  })

  it('rejects a token past its exp', () => {
    const t = signToken(SECRET, 1_000_000)
    expect(verifyToken(t, SECRET, 1_000_000 + SESSION_TTL_SECONDS + 1)).toBe(false)
  })

  it('rejects a tampered payload', () => {
    const t = signToken(SECRET, 1_000_000)
    const [, sig] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ iat: 0, exp: 9_999_999_999 }))
      .toString('base64url')
    expect(verifyToken(`${forged}.${sig}`, SECRET, 1_000_001)).toBe(false)
  })

  it('rejects a token signed with a different secret', () => {
    const t = signToken(SECRET, 1_000_000)
    expect(verifyToken(t, 'other-secret-other-secret-other-secret', 1_000_001)).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(verifyToken('', SECRET)).toBe(false)
    expect(verifyToken('onlyonepart', SECRET)).toBe(false)
    expect(verifyToken('a.b.c', SECRET)).toBe(false)
  })
})

describe('parseCookies', () => {
  it('parses a cookie header', () => {
    expect(parseCookies('a=1; admin_session=xyz.abc; b=2')).toEqual({
      a: '1',
      admin_session: 'xyz.abc',
      b: '2',
    })
  })
  it('returns {} for undefined / empty', () => {
    expect(parseCookies(undefined)).toEqual({})
    expect(parseCookies('')).toEqual({})
  })
})

describe('serializeCookie', () => {
  it('sets the security attributes and Max-Age', () => {
    const c = serializeCookie(SESSION_COOKIE, 'tok', { maxAge: 28800, secure: true })
    expect(c).toContain('admin_session=tok')
    expect(c).toContain('HttpOnly')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Path=/')
    expect(c).toContain('Secure')
    expect(c).toContain('Max-Age=28800')
  })
  it('omits Secure when secure=false and clears with Max-Age=0', () => {
    const c = serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: false })
    expect(c).not.toContain('Secure')
    expect(c).toContain('Max-Age=0')
    expect(c).toMatch(/Expires=/)
  })
})
