import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { HandlerResult } from './types'

export function isSecure(req: VercelRequest): boolean {
  const proto = req.headers['x-forwarded-proto']
  return (Array.isArray(proto) ? proto[0] : proto) === 'https'
}

export function send(res: VercelResponse, result: HandlerResult): void {
  if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie)
  res.status(result.status).json(result.body)
}
