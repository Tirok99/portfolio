import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import type { AuthEnv, HandlerResult } from '../api/_lib/types'
import { handleLogin, handleLogout, handleSession } from '../api/_lib/handlers'

/**
 * Pure route dispatcher. Returns `null` for any URL that is not one of the
 * three admin-api routes (query string stripped first) so callers can fall
 * through to the next middleware.
 */
export function dispatchAdminApi(
  input: {
    url: string
    method: string
    cookieHeader?: string
    jsonBody?: unknown
    secure: boolean
  },
  env: AuthEnv,
): HandlerResult | null {
  const path = input.url.split('?')[0]
  switch (path) {
    case '/api/admin/login': {
      const body = (input.jsonBody ?? {}) as { password?: unknown }
      return handleLogin(
        { method: input.method, password: body.password, secure: input.secure },
        env,
      )
    }
    case '/api/admin/session':
      return handleSession({ method: input.method, cookieHeader: input.cookieHeader }, env)
    case '/api/admin/logout':
      return handleLogout({ method: input.method, secure: input.secure })
    default:
      return null
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

/**
 * Dev-only Vite plugin: serves `/api/admin/{login,session,logout}` from
 * `npm run dev` (plain `vite`) reusing the exact same handlers that back the
 * Vercel functions in production. `secure: false` because dev is plain http.
 *
 * Env is read from `process.env` first, then from Vite's `loadEnv` (which
 * picks up `.env.local`). A missing password just makes login return
 * 401/500 — it never crashes the dev server.
 */
export function adminApiDev(): Plugin {
  let env: AuthEnv = {}
  return {
    name: 'admin-api-dev',
    apply: 'serve',
    config(_config, { mode }) {
      const fileEnv = loadEnv(mode, process.cwd(), '')
      env = {
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? fileEnv.ADMIN_PASSWORD,
        ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET ?? fileEnv.ADMIN_SESSION_SECRET,
      }
    },
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/admin/')) return next()
        const run = async () => {
          const method = req.method ?? 'GET'
          const jsonBody = method === 'POST' ? await readJsonBody(req) : undefined
          const result = dispatchAdminApi(
            { url, method, cookieHeader: req.headers.cookie, jsonBody, secure: false },
            env,
          )
          if (!result) return next()
          // Parity with the Vercel adapter: auth responses must never be cached.
          res.setHeader('Cache-Control', 'no-store')
          if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie)
          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.body))
        }
        run().catch(() => next())
      })
    },
  }
}
