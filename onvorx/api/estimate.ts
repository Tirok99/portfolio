import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleEstimate } from './_lib/estimateHandler'
import { send } from './_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Prefer x-real-ip (Vercel sets it to the true client IP). Fall back to the
  // LAST element of x-forwarded-for — the first element is client-spoofable if
  // Vercel appends rather than replaces the header.
  const realIp = req.headers['x-real-ip']
  const xff = req.headers['x-forwarded-for']
  const xffStr = Array.isArray(xff) ? xff[xff.length - 1] : (xff ?? '')
  const xffLast = xffStr.split(',').pop() ?? ''
  const ip = ((Array.isArray(realIp) ? realIp[0] : realIp) ?? xffLast).trim()
  const result = await handleEstimate(
    { method: req.method ?? 'GET', body: req.body ?? {}, ip },
    {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  )
  send(res, result)
}
