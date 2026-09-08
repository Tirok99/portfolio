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

export function handleSession(
  input: { method: string; cookieHeader: string | undefined },
  env: AuthEnv,
): HandlerResult {
  if (input.method !== 'GET') return { status: 405, body: { error: 'method_not_allowed' } }
  const secret = env.ADMIN_SESSION_SECRET
  let token = ''
  try {
    token = parseCookies(input.cookieHeader)[SESSION_COOKIE] ?? ''
  } catch {
    // Malformed cookie header (e.g., URIError from decodeURIComponent)
    // Fall through with empty token
  }
  const ok = Boolean(secret) && verifyToken(token, secret as string)
  return { status: 200, body: { authenticated: ok } }
}

export function handleLogout(input: { method: string; secure: boolean }): HandlerResult {
  if (input.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } }
  return {
    status: 200,
    body: { authenticated: false },
    setCookie: serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: input.secure }),
  }
}
