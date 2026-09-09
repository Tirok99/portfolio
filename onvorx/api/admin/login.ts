import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleLogin } from '../_lib/handlers'
import { isSecure, send } from '../_lib/vercel-adapter'

export default function handler(req: VercelRequest, res: VercelResponse): void {
  const body = (req.body ?? {}) as { password?: unknown }
  send(
    res,
    handleLogin(
      { method: req.method ?? 'GET', password: body.password, secure: isSecure(req) },
      { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET },
    ),
  )
}
