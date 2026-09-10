import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAdminRequests } from '../_lib/adminRequestsHandler'
import { send } from '../_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const result = await handleAdminRequests(
    { method: req.method ?? 'GET', cookieHeader: req.headers.cookie, body: req.body ?? {} },
    {
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  )
  send(res, result)
}
