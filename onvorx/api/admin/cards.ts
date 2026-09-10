import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAdminCards } from '../_lib/adminCardsHandler'
import { send } from '../_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const query = req.query as Record<string, string | undefined>
  const result = await handleAdminCards(
    { method: req.method ?? 'GET', cookieHeader: req.headers.cookie, query, body: req.body ?? {} },
    {
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_MEDIA_BUCKET: process.env.SUPABASE_MEDIA_BUCKET,
    },
  )
  send(res, result)
}
