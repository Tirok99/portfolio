import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleLogout } from '../_lib/handlers'
import { isSecure, send } from '../_lib/vercel-adapter'

export default function handler(req: VercelRequest, res: VercelResponse): void {
  send(res, handleLogout({ method: req.method ?? 'GET', secure: isSecure(req) }))
}
