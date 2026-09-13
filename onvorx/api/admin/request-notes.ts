import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAdminRequestNotes } from '../_lib/adminRequestNotesHandler'
import { send } from '../_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const query = req.query as Record<string, string | undefined>
  const method = req.method ?? 'GET'
  const body = method === 'POST' ? { ...(req.body ?? {}), author: 'Admin (web)' } : (req.body ?? {})
  const result = await handleAdminRequestNotes(
    {
      method,
      cookieHeader: req.headers.cookie,
      query: { requestId: query.requestId },
      body,
    },
    {
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  )
  send(res, result)
}
