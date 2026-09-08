import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleSession } from '../_lib/handlers'
import { send } from '../_lib/vercel-adapter'

export default function handler(req: VercelRequest, res: VercelResponse): void {
  send(
    res,
    handleSession(
      { method: req.method ?? 'GET', cookieHeader: req.headers.cookie },
      { ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET },
    ),
  )
}
