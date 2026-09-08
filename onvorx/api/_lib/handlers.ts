import { timingSafeEqual } from 'node:crypto'
import type { AuthEnv, HandlerResult } from './types'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  parseCookies,
  serializeCookie,
  signToken,
  verifyToken,
} from './session'

function passwordMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function handleLogin(
  input: { method: string; password: unknown; secure: boolean },
  env: AuthEnv,
): HandlerResult {
  if (input.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } }
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
    return { status: 500, body: { error: 'auth_not_configured' } }
  }
  const pw = typeof input.password === 'string' ? input.password : ''
  if (!pw || !passwordMatches(pw, env.ADMIN_PASSWORD)) {
    return { status: 401, body: { authenticated: false } }
  }
  const token = signToken(env.ADMIN_SESSION_SECRET)
  return {
    status: 200,
    body: { authenticated: true },
    setCookie: serializeCookie(SESSION_COOKIE, token, {
      maxAge: SESSION_TTL_SECONDS,
      secure: input.secure,
    }),
  }
}

/**
 * Verify the admin session cookie. Shared by `handleSession` and (Plan 3) every
 * mutating admin endpoint, so nothing re-derives the cookie/verify dance.
 * `parseCookies` is guaranteed not to throw; a missing secret means "not
 * configured" → treated as unauthenticated.
 */
export function requireSession(cookieHeader: string | undefined, env: AuthEnv): boolean {
  const secret = env.ADMIN_SESSION_SECRET
  if (!secret) return false
  const token = parseCookies(cookieHeader)[SESSION_COOKIE] ?? ''
  return verifyToken(token, secret)
}

export function handleSession(
  input: { method: string; cookieHeader: string | undefined },
  env: AuthEnv,
): HandlerResult {
  if (input.method !== 'GET') return { status: 405, body: { error: 'method_not_allowed' } }
  return { status: 200, body: { authenticated: requireSession(input.cookieHeader, env) } }
}

export function handleLogout(input: { method: string; secure: boolean }): HandlerResult {
  if (input.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } }
  return {
    status: 200,
    body: { authenticated: false },
    setCookie: serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: input.secure }),
  }
}
