import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'admin_session'
export const SESSION_TTL_SECONDS = 28_800 // 8 hours

const b64url = (buf: Buffer | string): string =>
  Buffer.from(buf).toString('base64url')

function hmac(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function signToken(secret: string, now = Math.floor(Date.now() / 1000)): string {
  const payload = { iat: now, exp: now + SESSION_TTL_SECONDS }
  const payloadB64 = b64url(JSON.stringify(payload))
  return `${payloadB64}.${hmac(payloadB64, secret)}`
}

export function verifyToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payloadB64, sig] = parts
  if (!payloadB64 || !sig) return false
  if (!safeEqual(sig, hmac(payloadB64, secret))) return false
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      exp?: unknown
    }
    return typeof payload.exp === 'number' && now < payload.exp
  } catch {
    return false
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (!k) continue
    // decodeURIComponent throws URIError on a stray `%` in ANY cookie on the
    // domain — never let one malformed cookie break auth. Fall back to the raw value.
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  }
  return out
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { maxAge: number; secure: boolean },
): string {
  const bits = [
    `${name}=${value}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${opts.maxAge}`,
  ]
  if (opts.secure) bits.push('Secure')
  if (opts.maxAge === 0) bits.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  return bits.join('; ')
}
