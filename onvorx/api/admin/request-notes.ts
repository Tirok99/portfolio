import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAdminRequestNotes } from '../_lib/adminRequestNotesHandler'
import { send } from '../_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const query = req.query as Record<string, string | undefined>
  const result = await handleAdminRequestNotes(
    {
      method: req.method ?? 'GET',
      cookieHeader: req.headers.cookie,
      query: { requestId: query.requestId },
      body: req.body ?? {},
    },
    {
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  )
  send(res, result)
}
