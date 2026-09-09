import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { HandlerResult } from './types'

/**
 * Whether to mark the session cookie `Secure`. A client can forge
 * `x-forwarded-proto`, so we don't trust that header alone: when running on
 * Vercel (`VERCEL === '1'`) traffic is always TLS-terminated at the edge, so the
 * cookie must always be `Secure` there. Local dev paths (the Vite plugin, and
 * `vercel dev` over plain http) don't set `VERCEL=1`, so they stay unaffected.
 */
export function isSecure(req: VercelRequest): boolean {
  const proto = req.headers['x-forwarded-proto']
  const value = Array.isArray(proto) ? proto[0] : proto
  return value === 'https' || process.env.VERCEL === '1'
}

export function send(res: VercelResponse, result: HandlerResult): void {
  // Auth responses carry the session decision and/or Set-Cookie — never cache.
  res.setHeader('Cache-Control', 'no-store')
  if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie)
  res.status(result.status).json(result.body)
}
