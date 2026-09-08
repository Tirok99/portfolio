import { describe, it, expect, vi, afterEach } from 'vitest'
import loginHandler from './login'
import sessionHandler from './session'
import logoutHandler from './logout'

function mockRes() {
  const res: Record<string, unknown> = {}
  res.statusCode = 0
  res.headers = {} as Record<string, string>
  res.setHeader = vi.fn((k: string, v: string) => {
    ;(res.headers as Record<string, string>)[k] = v
  })
  res.status = vi.fn((c: number) => {
    res.statusCode = c
    return res
  })
  res.json = vi.fn((b: unknown) => {
    res.body = b
    return res
  })
  return res as never
}

const OLD = { ...process.env }
afterEach(() => {
  process.env = { ...OLD }
})

describe('login adapter', () => {
  it('passes the parsed body password through and sets a cookie on success', () => {
    process.env.ADMIN_PASSWORD = 'pw12345678'
    process.env.ADMIN_SESSION_SECRET = 'secretsecretsecretsecretsecret12'
    const res = mockRes()
    loginHandler(
      { method: 'POST', body: { password: 'pw12345678' }, headers: { 'x-forwarded-proto': 'https' } } as never,
      res,
    )
    expect((res as unknown as { statusCode: number }).statusCode).toBe(200)
    expect((res as unknown as { headers: Record<string, string> }).headers['Set-Cookie']).toContain('admin_session=')
  })
})

describe('session adapter', () => {
  it('returns authenticated:false with no cookie', () => {
    process.env.ADMIN_SESSION_SECRET = 'secretsecretsecretsecretsecret12'
    const res = mockRes()
    sessionHandler({ method: 'GET', headers: {} } as never, res)
    expect((res as unknown as { body: unknown }).body).toEqual({ authenticated: false })
  })
})

describe('logout adapter', () => {
  it('clears the cookie', () => {
    const res = mockRes()
    logoutHandler({ method: 'POST', headers: {} } as never, res)
    expect((res as unknown as { headers: Record<string, string> }).headers['Set-Cookie']).toContain('Max-Age=0')
  })
})
