import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleEstimate } from './_lib/estimateHandler'
import { send } from './_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const fwd = req.headers['x-forwarded-for']
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd ?? '').split(',')[0].trim()
  const result = await handleEstimate(
    { method: req.method ?? 'GET', body: req.body ?? {}, ip },
    {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  )
  send(res, result)
}
