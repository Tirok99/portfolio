# Admin Plan 2 — Authentication — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate `/admin` behind a single shared password, verified server-side with a signed session cookie, working both on Vercel and under `npm run dev`.

**Architecture:** All auth logic lives in framework-agnostic pure functions under `api/_lib/` (HMAC-SHA256 token sign/verify, cookie parse/serialize, and three request handlers that take plain inputs and return `{status, body, setCookie?}`). Thin adapters wire them to Vercel Node functions (`api/admin/*.ts`) and to a Vite dev-server middleware (`vite.config.ts`). The client `useAuth()` hook talks to `/api/admin/{login,session,logout}`; `<RequireAuth>` redirects unauthenticated users to `<LoginPage>`.

**Tech Stack:** Node `crypto` (no crypto library), Vercel Node functions, Vite `configureServer` plugin, React 19 + React Router 7, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-panel-design.md` (§4 Auth)

## Global Constraints

- **Secrets:** `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` come from the environment (`.env.local` locally, Vercel env vars in prod). They are **server-only** — never imported into client code, never prefixed `VITE_`, never logged.
- **No crypto dependency.** Node's built-in `crypto` only. New dev dep allowed for this plan: `@vercel/node` (types for the function handlers; not shipped to the client).
- **Cookie:** name `admin_session`; attributes `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800` (8h). In dev over plain HTTP, `Secure` is omitted (see Task 3/4).
- **Token format:** `<base64url(JSON payload)>.<base64url(HMAC-SHA256(payload-b64, secret))>`; payload `{ iat: number, exp: number }` (unix seconds).
- **Constant-time compare** for the password and the HMAC (`crypto.timingSafeEqual`).
- **TypeScript:** `verbatimModuleSyntax` on — type-only imports use `import type`. `erasableSyntaxOnly` on. `noUnusedLocals`/`noUnusedParameters` on.
- **Gates:** `npm run lint` (oxlint) 0 errors; `npm run build` (`tsc -b && vite build`) passes; `npm test` all pass.
- **Node ≥ 22.12** (already pinned in `package.json` engines + `.nvmrc`).
- **Commit messages** end with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Work on branch `feature/admin-panel-app`.
- **`api/` directory** is new. Vercel auto-detects `api/**/*.ts` as Node serverless functions. The existing `vercel.json` catch-all rewrite (`/(.*) → /index.html`) must be narrowed so it does not swallow `/api/*`.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `api/_lib/session.ts` | `signToken`, `verifyToken`, `parseCookies`, `serializeCookie`, `SESSION_COOKIE`, `SESSION_TTL_SECONDS` |
| `api/_lib/session.test.ts` | unit tests for the above |
| `api/_lib/handlers.ts` | `handleLogin`, `handleSession`, `handleLogout` — pure, env passed in |
| `api/_lib/handlers.test.ts` | unit tests |
| `api/_lib/types.ts` | minimal `AuthEnv`, `HandlerResult` types shared by handlers + adapters |
| `api/admin/login.ts` | Vercel Node adapter → `handleLogin` |
| `api/admin/session.ts` | Vercel Node adapter → `handleSession` |
| `api/admin/logout.ts` | Vercel Node adapter → `handleLogout` |
| `vite-plugins/admin-api-dev.ts` | Vite `configureServer` middleware calling the same handlers in dev |
| `src/admin/auth/useAuth.tsx` | `AuthProvider` + `useAuth()` — session check, `login`, `logout` |
| `src/admin/auth/useAuth.test.tsx` | tests (mocked `fetch`) |
| `src/admin/auth/RequireAuth.tsx` | redirect gate |
| `src/admin/auth/RequireAuth.test.tsx` | tests |
| `src/admin/auth/LoginPage.tsx` | password form |
| `src/admin/auth/LoginPage.css` | styles |
| `src/admin/auth/LoginPage.test.tsx` | tests |

**Modify:**

| File | Change |
|---|---|
| `package.json` | devDep `@vercel/node` |
| `vercel.json` | narrow the rewrite source to exclude `/api` |
| `vite.config.ts` | register the `admin-api-dev` plugin |
| `tsconfig.app.json` | ensure `api/` is NOT in the app `tsc -b` graph (it is Node, not browser) — add a dedicated `tsconfig.api.json` OR exclude `api` and rely on Vercel's own typecheck; see Task 1 |
| `.env.example` | document `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` (names + one-line purpose, no values) |
| `Readme.md` | one line under "Admin panel (in progress)" about the auth gate + `vercel dev` note |

**Not touched:** `src/content/*`, `src/sections/*`, `src/i18n/*`, everything Plan 1 shipped.

---

## Task 1: Session crypto helpers

**Files:**
- Create: `api/_lib/session.ts`, `api/_lib/session.test.ts`
- Create: `tsconfig.api.json`
- Modify: `package.json` (devDep `@vercel/node`), `tsconfig.app.json` (exclude `api`), `vite.config.ts` (add `api` tests to include if needed — see step)

**Interfaces:**
- Consumes: Node `crypto`.
- Produces:
  - `SESSION_COOKIE = 'admin_session'`
  - `SESSION_TTL_SECONDS = 28800`
  - `signToken(secret: string, now?: number): string` — builds `{iat, exp}` (exp = iat + TTL), returns `<b64url-payload>.<b64url-hmac>`
  - `verifyToken(token: string, secret: string, now?: number): boolean` — signature valid AND `now < exp`
  - `parseCookies(header: string | undefined): Record<string, string>`
  - `serializeCookie(name: string, value: string, opts: { maxAge: number; secure: boolean }): string` — `HttpOnly; SameSite=Lax; Path=/`, adds `Secure` when `opts.secure`, `Max-Age` from `opts.maxAge` (0 → also `Expires` epoch for immediate clear)

- [ ] **Step 1: Add the dev dependency and API tsconfig**

Run: `npm install -D @vercel/node@^5`

Create `tsconfig.api.json`:
```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["api"]
}
```

In `tsconfig.app.json` add `api` to `exclude` (it already excludes tests):
```json
"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test", "api"]
```

Leave `package.json` `build` script as `tsc -b && vite build` — `tsc -b` uses the root `tsconfig.json` project references, which do not include `api`. Add a separate script so CI/local can typecheck the functions:
```json
"typecheck:api": "tsc -p tsconfig.api.json"
```

- [ ] **Step 2: Write the failing test**

`api/_lib/session.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signToken,
  verifyToken,
  parseCookies,
  serializeCookie,
} from './session'

const SECRET = 'test-secret-value-at-least-32-characters-long'

describe('signToken / verifyToken', () => {
  it('round-trips a fresh token', () => {
    const t = signToken(SECRET, 1_000_000)
    expect(t).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(verifyToken(t, SECRET, 1_000_001)).toBe(true)
  })

  it('rejects a token past its exp', () => {
    const t = signToken(SECRET, 1_000_000)
    expect(verifyToken(t, SECRET, 1_000_000 + SESSION_TTL_SECONDS + 1)).toBe(false)
  })

  it('rejects a tampered payload', () => {
    const t = signToken(SECRET, 1_000_000)
    const [, sig] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ iat: 0, exp: 9_999_999_999 }))
      .toString('base64url')
    expect(verifyToken(`${forged}.${sig}`, SECRET, 1_000_001)).toBe(false)
  })

  it('rejects a token signed with a different secret', () => {
    const t = signToken(SECRET, 1_000_000)
    expect(verifyToken(t, 'other-secret-other-secret-other-secret', 1_000_001)).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(verifyToken('', SECRET)).toBe(false)
    expect(verifyToken('onlyonepart', SECRET)).toBe(false)
    expect(verifyToken('a.b.c', SECRET)).toBe(false)
  })
})

describe('parseCookies', () => {
  it('parses a cookie header', () => {
    expect(parseCookies('a=1; admin_session=xyz.abc; b=2')).toEqual({
      a: '1',
      admin_session: 'xyz.abc',
      b: '2',
    })
  })
  it('returns {} for undefined / empty', () => {
    expect(parseCookies(undefined)).toEqual({})
    expect(parseCookies('')).toEqual({})
  })
})

describe('serializeCookie', () => {
  it('sets the security attributes and Max-Age', () => {
    const c = serializeCookie(SESSION_COOKIE, 'tok', { maxAge: 28800, secure: true })
    expect(c).toContain('admin_session=tok')
    expect(c).toContain('HttpOnly')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Path=/')
    expect(c).toContain('Secure')
    expect(c).toContain('Max-Age=28800')
  })
  it('omits Secure when secure=false and clears with Max-Age=0', () => {
    const c = serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: false })
    expect(c).not.toContain('Secure')
    expect(c).toContain('Max-Age=0')
    expect(c).toMatch(/Expires=/)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- api/_lib/session.test.ts`
Expected: FAIL — `./session` not found.

> Note: Vitest's `include` defaults to `**/*.{test,spec}.?(c|m)[jt]s?(x)`, which already covers `api/`. No config change needed. The test runs in the `jsdom` env (harmless — it uses only `Buffer`/`crypto`).

- [ ] **Step 4: Write `api/_lib/session.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'admin_session'
export const SESSION_TTL_SECONDS = 28_800 // 8 hours

const b64url = (buf: Buffer | string): string =>
  Buffer.from(buf).toString('base64url')

function hmac(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function signToken(secret: string, now = Math.floor(Date.now() / 1000)): string {
  const payload = { iat: now, exp: now + SESSION_TTL_SECONDS }
  const payloadB64 = b64url(JSON.stringify(payload))
  return `${payloadB64}.${hmac(payloadB64, secret)}`
}

export function verifyToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payloadB64, sig] = parts
  if (!payloadB64 || !sig) return false
  if (!safeEqual(sig, hmac(payloadB64, secret))) return false
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      exp?: unknown
    }
    return typeof payload.exp === 'number' && now < payload.exp
  } catch {
    return false
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { maxAge: number; secure: boolean },
): string {
  const bits = [
    `${name}=${value}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${opts.maxAge}`,
  ]
  if (opts.secure) bits.push('Secure')
  if (opts.maxAge === 0) bits.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  return bits.join('; ')
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- api/_lib/session.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck the api project**

Run: `npx tsc -p tsconfig.api.json`
Expected: no errors.

- [ ] **Step 7: Full gates**

Run: `npm test && npm run lint && npm run build`
Expected: green. (`npm run build` should be unaffected — `api` is out of its graph.)

- [ ] **Step 8: Commit**

```bash
git add api/_lib/session.ts api/_lib/session.test.ts tsconfig.api.json tsconfig.app.json package.json package-lock.json
git commit -m "feat: session token + cookie helpers for admin auth

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Auth request handlers

**Files:**
- Create: `api/_lib/types.ts`, `api/_lib/handlers.ts`, `api/_lib/handlers.test.ts`

**Interfaces:**
- Consumes: `signToken`, `verifyToken`, `parseCookies`, `serializeCookie`, `SESSION_COOKIE`, `SESSION_TTL_SECONDS` from `./session`.
- Produces (`api/_lib/types.ts`):
  - `interface AuthEnv { ADMIN_PASSWORD?: string; ADMIN_SESSION_SECRET?: string }`
  - `interface HandlerResult { status: number; body: unknown; setCookie?: string }`
- Produces (`api/_lib/handlers.ts`):
  - `handleLogin(input: { method: string; password: unknown; secure: boolean }, env: AuthEnv): HandlerResult` — 405 for non-POST; 500 when env missing; 401 on wrong/absent password (constant-time compare); 200 `{ authenticated: true }` + `setCookie` (fresh token) on success
  - `handleSession(input: { method: string; cookieHeader: string | undefined }, env: AuthEnv): HandlerResult` — 405 for non-GET; `{ authenticated: boolean }` (200 always for GET) based on `verifyToken`
  - `handleLogout(input: { method: string; secure: boolean }): HandlerResult` — 405 for non-POST; 200 `{ authenticated: false }` + `setCookie` that clears (`maxAge: 0`)

- [ ] **Step 1: Write the failing test**

`api/_lib/handlers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { handleLogin, handleSession, handleLogout } from './handlers'
import { SESSION_COOKIE, signToken } from './session'

const ENV = {
  ADMIN_PASSWORD: 'correct horse battery staple',
  ADMIN_SESSION_SECRET: 'secret-secret-secret-secret-secret-secret',
}

describe('handleLogin', () => {
  it('405 on non-POST', () => {
    expect(handleLogin({ method: 'GET', password: 'x', secure: true }, ENV).status).toBe(405)
  })
  it('500 when env is not configured', () => {
    expect(handleLogin({ method: 'POST', password: 'x', secure: true }, {}).status).toBe(500)
  })
  it('401 on wrong password, no cookie', () => {
    const r = handleLogin({ method: 'POST', password: 'nope', secure: true }, ENV)
    expect(r.status).toBe(401)
    expect(r.setCookie).toBeUndefined()
  })
  it('401 on missing/non-string password', () => {
    expect(handleLogin({ method: 'POST', password: undefined, secure: true }, ENV).status).toBe(401)
    expect(handleLogin({ method: 'POST', password: 123, secure: true }, ENV).status).toBe(401)
  })
  it('200 + Secure session cookie on correct password', () => {
    const r = handleLogin(
      { method: 'POST', password: 'correct horse battery staple', secure: true },
      ENV,
    )
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ authenticated: true })
    expect(r.setCookie).toContain(`${SESSION_COOKIE}=`)
    expect(r.setCookie).toContain('HttpOnly')
    expect(r.setCookie).toContain('Secure')
  })
  it('omits Secure when secure=false (dev http)', () => {
    const r = handleLogin(
      { method: 'POST', password: 'correct horse battery staple', secure: false },
      ENV,
    )
    expect(r.setCookie).not.toContain('Secure')
  })
})

describe('handleSession', () => {
  it('405 on non-GET', () => {
    expect(handleSession({ method: 'POST', cookieHeader: '' }, ENV).status).toBe(405)
  })
  it('authenticated:false with no cookie', () => {
    const r = handleSession({ method: 'GET', cookieHeader: undefined }, ENV)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ authenticated: false })
  })
  it('authenticated:true with a valid cookie', () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    const r = handleSession({ method: 'GET', cookieHeader: `${SESSION_COOKIE}=${tok}` }, ENV)
    expect(r.body).toEqual({ authenticated: true })
  })
  it('authenticated:false with a garbage cookie', () => {
    const r = handleSession(
      { method: 'GET', cookieHeader: `${SESSION_COOKIE}=not.a.real.token` },
      ENV,
    )
    expect(r.body).toEqual({ authenticated: false })
  })
})

describe('handleLogout', () => {
  it('405 on non-POST', () => {
    expect(handleLogout({ method: 'GET', secure: true }).status).toBe(405)
  })
  it('clears the cookie', () => {
    const r = handleLogout({ method: 'POST', secure: true })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ authenticated: false })
    expect(r.setCookie).toContain(`${SESSION_COOKIE}=;`)
    expect(r.setCookie).toContain('Max-Age=0')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- api/_lib/handlers.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `api/_lib/types.ts`**

```ts
export interface AuthEnv {
  ADMIN_PASSWORD?: string
  ADMIN_SESSION_SECRET?: string
}

export interface HandlerResult {
  status: number
  body: unknown
  setCookie?: string
}
```

- [ ] **Step 4: Write `api/_lib/handlers.ts`**

```ts
import { timingSafeEqual } from 'node:crypto'
import type { AuthEnv, HandlerResult } from './types'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  parseCookies,
  serializeCookie,
  signToken,
  verifyToken,
} from './session'

function passwordMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function handleLogin(
  input: { method: string; password: unknown; secure: boolean },
  env: AuthEnv,
): HandlerResult {
  if (input.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } }
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
    return { status: 500, body: { error: 'auth_not_configured' } }
  }
  const pw = typeof input.password === 'string' ? input.password : ''
  if (!pw || !passwordMatches(pw, env.ADMIN_PASSWORD)) {
    return { status: 401, body: { authenticated: false } }
  }
  const token = signToken(env.ADMIN_SESSION_SECRET)
  return {
    status: 200,
    body: { authenticated: true },
    setCookie: serializeCookie(SESSION_COOKIE, token, {
      maxAge: SESSION_TTL_SECONDS,
      secure: input.secure,
    }),
  }
}

export function handleSession(
  input: { method: string; cookieHeader: string | undefined },
  env: AuthEnv,
): HandlerResult {
  if (input.method !== 'GET') return { status: 405, body: { error: 'method_not_allowed' } }
  const secret = env.ADMIN_SESSION_SECRET
  const token = parseCookies(input.cookieHeader)[SESSION_COOKIE] ?? ''
  const ok = Boolean(secret) && verifyToken(token, secret as string)
  return { status: 200, body: { authenticated: ok } }
}

export function handleLogout(input: { method: string; secure: boolean }): HandlerResult {
  if (input.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } }
  return {
    status: 200,
    body: { authenticated: false },
    setCookie: serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: input.secure }),
  }
}
```

- [ ] **Step 4b: Run tests to verify they pass**

Run: `npm test -- api/_lib/handlers.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + full gates**

Run: `npx tsc -p tsconfig.api.json && npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/types.ts api/_lib/handlers.ts api/_lib/handlers.test.ts
git commit -m "feat: admin auth request handlers (login/session/logout)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Vercel function adapters + rewrite fix

**Files:**
- Create: `api/admin/login.ts`, `api/admin/session.ts`, `api/admin/logout.ts`
- Modify: `vercel.json`
- Test: `api/admin/adapters.test.ts`

**Interfaces:**
- Consumes: `handleLogin`/`handleSession`/`handleLogout` from `../_lib/handlers`; `@vercel/node` `VercelRequest`/`VercelResponse` types.
- Produces: three default-exported Vercel handlers. Each: derives `secure` from `req.headers['x-forwarded-proto'] === 'https'` (Vercel always terminates TLS, so this is `true` in prod); reads `req.body` (Vercel parses JSON automatically) for login; passes `req.headers.cookie` for session; writes `res.status(r.status)`, sets `Set-Cookie` if present, `res.json(r.body)`.
- Produces: a shared thin adapter `api/_lib/vercel-adapter.ts` — `runHandler(req, res, compute)` to avoid repeating the res-writing in three files.

- [ ] **Step 1: Write `api/_lib/vercel-adapter.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { HandlerResult } from './types'

export function isSecure(req: VercelRequest): boolean {
  const proto = req.headers['x-forwarded-proto']
  return (Array.isArray(proto) ? proto[0] : proto) === 'https'
}

export function send(res: VercelResponse, result: HandlerResult): void {
  if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie)
  res.status(result.status).json(result.body)
}
```

- [ ] **Step 2: Write the three adapters**

`api/admin/login.ts`:
```ts
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
```

`api/admin/session.ts`:
```ts
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
```

`api/admin/logout.ts`:
```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleLogout } from '../_lib/handlers'
import { isSecure, send } from '../_lib/vercel-adapter'

export default function handler(req: VercelRequest, res: VercelResponse): void {
  send(res, handleLogout({ method: req.method ?? 'GET', secure: isSecure(req) }))
}
```

- [ ] **Step 3: Write the adapter test**

`api/admin/adapters.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import loginHandler from './login'
import sessionHandler from './session'
import logoutHandler from './logout'

function mockRes() {
  const res: Record<string, unknown> = {}
  res.statusCode = 0
  res.headers = {} as Record<string, string>
  res.setHeader = vi.fn((k: string, v: string) => {
    ;(res.headers as Record<string, string>)[k] = v
  })
  res.status = vi.fn((c: number) => {
    res.statusCode = c
    return res
  })
  res.json = vi.fn((b: unknown) => {
    res.body = b
    return res
  })
  return res as never
}

const OLD = { ...process.env }
afterEach(() => {
  process.env = { ...OLD }
})

describe('login adapter', () => {
  it('passes the parsed body password through and sets a cookie on success', () => {
    process.env.ADMIN_PASSWORD = 'pw12345678'
    process.env.ADMIN_SESSION_SECRET = 'secretsecretsecretsecretsecret12'
    const res = mockRes()
    loginHandler(
      { method: 'POST', body: { password: 'pw12345678' }, headers: { 'x-forwarded-proto': 'https' } } as never,
      res,
    )
    expect((res as unknown as { statusCode: number }).statusCode).toBe(200)
    expect((res as unknown as { headers: Record<string, string> }).headers['Set-Cookie']).toContain('admin_session=')
  })
})

describe('session adapter', () => {
  it('returns authenticated:false with no cookie', () => {
    process.env.ADMIN_SESSION_SECRET = 'secretsecretsecretsecretsecret12'
    const res = mockRes()
    sessionHandler({ method: 'GET', headers: {} } as never, res)
    expect((res as unknown as { body: unknown }).body).toEqual({ authenticated: false })
  })
})

describe('logout adapter', () => {
  it('clears the cookie', () => {
    const res = mockRes()
    logoutHandler({ method: 'POST', headers: {} } as never, res)
    expect((res as unknown as { headers: Record<string, string> }).headers['Set-Cookie']).toContain('Max-Age=0')
  })
})
```

> If importing the handlers pulls `@vercel/node` runtime code that Vitest's jsdom env can't load, switch this test file to `// @vitest-environment node` at the top. The `_lib` tests already cover the logic; these only assert the res-shape wiring.

- [ ] **Step 4: Run the adapter test**

Run: `npm test -- api/admin/adapters.test.ts`
Expected: PASS.

- [ ] **Step 5: Narrow the `vercel.json` rewrite**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

- [ ] **Step 6: Typecheck api + full gates**

Run: `npx tsc -p tsconfig.api.json && npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add api/admin api/_lib/vercel-adapter.ts vercel.json
git commit -m "feat: Vercel function adapters for admin auth + api rewrite guard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Vite dev-server middleware

**Files:**
- Create: `vite-plugins/admin-api-dev.ts`
- Modify: `vite.config.ts`
- Test: `vite-plugins/admin-api-dev.test.ts`

**Interfaces:**
- Consumes: `handleLogin`/`handleSession`/`handleLogout` from `../api/_lib/handlers`; Node `http` types; Vite `Plugin` type.
- Produces: `adminApiDev(): Plugin` — `configureServer` hook mounts a Connect middleware on `/api/admin/login`, `/api/admin/session`, `/api/admin/logout`. Reads env from `process.env` (Vite loads `.env.local` into `process.env` for the config file; confirm and, if needed, use `loadEnv`). `secure: false` in dev (plain http). Parses a JSON body for login. Writes status + `Set-Cookie` + JSON.
- Produces: an exported pure helper `dispatchAdminApi(input: { url: string; method: string; cookieHeader?: string; jsonBody?: unknown; secure: boolean }, env): HandlerResult | null` — returns `null` when the url is not an admin-api route. This is what the test exercises (no real HTTP server).

- [ ] **Step 1: Write the failing test**

`vite-plugins/admin-api-dev.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { dispatchAdminApi } from './admin-api-dev'
import { SESSION_COOKIE, signToken } from '../api/_lib/session'

const ENV = { ADMIN_PASSWORD: 'devpassword123', ADMIN_SESSION_SECRET: 'x'.repeat(40) }

describe('dispatchAdminApi', () => {
  it('returns null for non-admin routes', () => {
    expect(dispatchAdminApi({ url: '/api/other', method: 'GET', secure: false }, ENV)).toBeNull()
    expect(dispatchAdminApi({ url: '/', method: 'GET', secure: false }, ENV)).toBeNull()
  })

  it('handles login with a JSON body', () => {
    const r = dispatchAdminApi(
      { url: '/api/admin/login', method: 'POST', jsonBody: { password: 'devpassword123' }, secure: false },
      ENV,
    )
    expect(r?.status).toBe(200)
    expect(r?.setCookie).toContain(`${SESSION_COOKIE}=`)
    expect(r?.setCookie).not.toContain('Secure')
  })

  it('handles session with a cookie header', () => {
    const tok = signToken(ENV.ADMIN_SESSION_SECRET)
    const r = dispatchAdminApi(
      { url: '/api/admin/session', method: 'GET', cookieHeader: `${SESSION_COOKIE}=${tok}`, secure: false },
      ENV,
    )
    expect(r?.body).toEqual({ authenticated: true })
  })

  it('handles logout', () => {
    const r = dispatchAdminApi({ url: '/api/admin/logout', method: 'POST', secure: false }, ENV)
    expect(r?.setCookie).toContain('Max-Age=0')
  })

  it('ignores query strings on the path match', () => {
    const r = dispatchAdminApi({ url: '/api/admin/session?ts=1', method: 'GET', secure: false }, ENV)
    expect(r?.body).toEqual({ authenticated: false })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- vite-plugins/admin-api-dev.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `vite-plugins/admin-api-dev.ts`**

```ts
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import type { AuthEnv, HandlerResult } from '../api/_lib/types'
import { handleLogin, handleLogout, handleSession } from '../api/_lib/handlers'

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
      return handleLogin({ method: input.method, password: body.password, secure: input.secure }, env)
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

export function adminApiDev(): Plugin {
  return {
    name: 'admin-api-dev',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/admin/')) return next()
        const env: AuthEnv = {
          ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
          ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
        }
        const run = async () => {
          const method = req.method ?? 'GET'
          const jsonBody = method === 'POST' ? await readJsonBody(req) : undefined
          const result = dispatchAdminApi(
            { url, method, cookieHeader: req.headers.cookie, jsonBody, secure: false },
            env,
          )
          if (!result) return next()
          if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie)
          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.body))
        }
        void run()
      })
    },
  }
}
```

- [ ] **Step 4: Register the plugin in `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { adminApiDev } from './vite-plugins/admin-api-dev'

export default defineConfig({
  plugins: [react(), adminApiDev()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

- [ ] **Step 5: Run the test + full gates**

Run: `npm test -- vite-plugins/admin-api-dev.test.ts && npm test && npm run lint && npm run build`
Expected: green. (`vite-plugins/` is picked up by vitest's default include; it's `.ts` importing Node modules — fine.)

- [ ] **Step 6: Manual dev check**

Run: `npm run dev` in one shell, then in another:
```bash
curl -s -X POST localhost:5173/api/admin/session   # -> {"authenticated":false}
curl -s -X POST localhost:5173/api/admin/login -H 'content-type: application/json' -d '{"password":"<value from .env.local>"}' -i | grep -i set-cookie
```
Expected: session returns `{"authenticated":false}`; login with the correct password returns a `Set-Cookie: admin_session=...` header (no `Secure` in dev). Kill the dev server.

- [ ] **Step 7: Commit**

```bash
git add vite-plugins vite.config.ts
git commit -m "feat: dev-server middleware serving /api/admin/* for npm run dev

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `useAuth` hook

**Files:**
- Create: `src/admin/auth/useAuth.tsx`, `src/admin/auth/useAuth.test.tsx`

**Interfaces:**
- Consumes: `fetch` (global).
- Produces:
  - `AuthProvider` (children prop) — on mount, `GET /api/admin/session`; holds `status: 'checking' | 'authed' | 'anon'`.
  - `useAuth(): { status: 'checking' | 'authed' | 'anon'; login(password: string): Promise<{ ok: boolean }>; logout(): Promise<void>; recheck(): Promise<void> }`
  - `login` POSTs `/api/admin/login` with `{ password }`, `credentials: 'same-origin'`; on 200 sets `status='authed'` and returns `{ ok: true }`; on 401 returns `{ ok: false }` and leaves status.
  - `logout` POSTs `/api/admin/logout`, sets `status='anon'`.

- [ ] **Step 1: Write the failing test**

`src/admin/auth/useAuth.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'

function Probe() {
  const { status, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <button onClick={() => login('pw')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  )
}

const wrap = () => render(<AuthProvider><Probe /></AuthProvider>)

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useAuth', () => {
  it('checks the session on mount → anon', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ authenticated: false }), { status: 200 })))
    wrap()
    expect(screen.getByTestId('status')).toHaveTextContent('checking')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anon'))
  })

  it('checks the session on mount → authed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ authenticated: true }), { status: 200 })))
    wrap()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authed'))
  })

  it('login success flips status to authed', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/session')
        ? new Response(JSON.stringify({ authenticated: false }), { status: 200 })
        : new Response(JSON.stringify({ authenticated: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    wrap()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anon'))
    await act(async () => {
      screen.getByText('login').click()
    })
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authed'))
  })

  it('login failure (401) keeps status anon', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/session')
        ? new Response(JSON.stringify({ authenticated: false }), { status: 200 })
        : new Response(JSON.stringify({ authenticated: false }), { status: 401 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    wrap()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anon'))
    await act(async () => {
      screen.getByText('login').click()
    })
    expect(screen.getByTestId('status')).toHaveTextContent('anon')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/admin/auth/useAuth.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/admin/auth/useAuth.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type Status = 'checking' | 'authed' | 'anon'

interface AuthValue {
  status: Status
  login: (password: string) => Promise<{ ok: boolean }>
  logout: () => Promise<void>
  recheck: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

async function readAuthenticated(res: Response): Promise<boolean> {
  try {
    const data = (await res.json()) as { authenticated?: unknown }
    return data.authenticated === true
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')

  const recheck = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/session', { credentials: 'same-origin' })
      setStatus((await readAuthenticated(res)) ? 'authed' : 'anon')
    } catch {
      setStatus('anon')
    }
  }, [])

  useEffect(() => {
    void recheck()
  }, [recheck])

  const login = useCallback(async (password: string) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.status === 200 && (await readAuthenticated(res))) {
      setStatus('authed')
      return { ok: true }
    }
    return { ok: false }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
    } finally {
      setStatus('anon')
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ status, login, logout, recheck }),
    [status, login, logout, recheck],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
```

> Import list: `createContext, useCallback, useContext, useEffect, useMemo, useState` from `react`, plus `type ReactNode`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/admin/auth/useAuth.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full gates**

Run: `npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/admin/auth/useAuth.tsx src/admin/auth/useAuth.test.tsx
git commit -m "feat: useAuth hook — session check, login, logout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `RequireAuth` + `LoginPage`

**Files:**
- Create: `src/admin/auth/RequireAuth.tsx`, `src/admin/auth/RequireAuth.test.tsx`
- Create: `src/admin/auth/LoginPage.tsx`, `src/admin/auth/LoginPage.css`, `src/admin/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `./useAuth`; `Navigate`, `useLocation` from react-router-dom.
- Produces:
  - `<RequireAuth>{children}</RequireAuth>` — `status==='checking'` → a minimal "Checking…" placeholder; `'anon'` → `<Navigate to="/admin/login" replace state={{ from: location.pathname }} />`; `'authed'` → `children`.
  - `<LoginPage />` — centered card, single password `<input type="password">`, submit button, inline error on failed login, `aria-describedby` wiring. On success: `<Navigate to={from ?? '/admin'} replace />` (reads `location.state.from`). If already `authed`, immediately redirects to `/admin`.

- [ ] **Step 1: Write the failing tests**

`src/admin/auth/RequireAuth.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'
import * as authModule from './useAuth'

function renderAt(status: 'checking' | 'authed' | 'anon') {
  vi.spyOn(authModule, 'useAuth').mockReturnValue({
    status,
    login: vi.fn(),
    logout: vi.fn(),
    recheck: vi.fn(),
  } as never)
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<RequireAuth><div>secret</div></RequireAuth>} />
        <Route path="/admin/login" element={<div>login screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  it('shows a placeholder while checking', () => {
    renderAt('checking')
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.queryByText('login screen')).not.toBeInTheDocument()
  })
  it('redirects to login when anon', () => {
    renderAt('anon')
    expect(screen.getByText('login screen')).toBeInTheDocument()
  })
  it('renders children when authed', () => {
    renderAt('authed')
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
```

`src/admin/auth/LoginPage.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import * as authModule from './useAuth'

function setup(login: ReturnType<typeof vi.fn>, status: 'anon' | 'authed' = 'anon') {
  vi.spyOn(authModule, 'useAuth').mockReturnValue({
    status, login, logout: vi.fn(), recheck: vi.fn(),
  } as never)
  return render(
    <MemoryRouter initialEntries={['/admin/login']}>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('submits the password and navigates to /admin on success', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => ({ ok: true }))
    setup(login)
    await user.type(screen.getByLabelText(/password/i), 's3cret')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(login).toHaveBeenCalledWith('s3cret')
    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('shows an error on failed login and does not navigate', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => ({ ok: false }))
    setup(login)
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument()
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument()
  })

  it('redirects to /admin if already authed', () => {
    setup(vi.fn(), 'authed')
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- src/admin/auth/RequireAuth.test.tsx src/admin/auth/LoginPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/admin/auth/RequireAuth.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return (
      <div className="admin-auth-checking" role="status" aria-live="polite">
        Checking your session…
      </div>
    )
  }
  if (status === 'anon') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
```

- [ ] **Step 4: Write `src/admin/auth/LoginPage.tsx`**

```tsx
import { useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import './LoginPage.css'

interface FromState { from?: string }

export function LoginPage() {
  const { status, login } = useAuth()
  const location = useLocation()
  const from = (location.state as FromState | null)?.from ?? '/admin'
  const fieldId = useId()
  const errId = `${fieldId}-err`

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (status === 'authed' || done) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const { ok } = await login(password)
    setBusy(false)
    if (ok) setDone(true)
    else setError('Incorrect password. Try again.')
  }

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={submit} noValidate>
        <h1 className="admin-login__title">ONVORX Admin</h1>
        <label className="admin-login__label" htmlFor={fieldId}>
          Password
          <input
            id={fieldId}
            className="admin-login__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errId : undefined}
            autoFocus
          />
        </label>
        {error && (
          <p id={errId} className="admin-login__error" role="alert">
            {error}
          </p>
        )}
        <button className="admin-login__submit" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/admin/auth/LoginPage.css`**

```css
.admin-login {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: var(--bg, #f5f5f7);
  color: var(--text, #0d0d0f);
}
.admin-login__card {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e8e8ec);
  border-radius: var(--radius-lg, 16px);
}
.admin-login__title {
  margin: 0;
  font-size: 1.25rem;
}
.admin-login__label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.875rem;
}
.admin-login__input {
  font: inherit;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border-strong, #dcdce2);
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-elevated, #fff);
  color: inherit;
}
.admin-login__input[aria-invalid='true'] {
  border-color: var(--accent, #e4202b);
}
.admin-login__error {
  margin: 0;
  color: var(--accent, #e4202b);
  font-size: 0.8rem;
}
.admin-login__submit {
  font: inherit;
  padding: 0.65rem 1rem;
  border: 0;
  border-radius: var(--radius-sm, 8px);
  background: var(--accent, #e4202b);
  color: var(--on-accent, #fff);
  cursor: pointer;
}
.admin-login__submit:disabled {
  opacity: 0.6;
  cursor: default;
}
.admin-auth-checking {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  font-size: 0.9rem;
  color: var(--text-2, #5b5d66);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/admin/auth/`
Expected: PASS.

- [ ] **Step 7: Full gates**

Run: `npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src/admin/auth/RequireAuth.tsx src/admin/auth/RequireAuth.test.tsx src/admin/auth/LoginPage.tsx src/admin/auth/LoginPage.css src/admin/auth/LoginPage.test.tsx
git commit -m "feat: RequireAuth gate + admin LoginPage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Env docs + wiring notes + verification

**Files:**
- Modify: `.env.example`, `Readme.md`
- Create: `src/admin/auth/README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documentation; a verified green build. NOTE: this task does NOT mount `/admin/*` routes or the `AuthProvider` in `App.tsx` — that happens in Plan 3 Task 1 (the admin shell), which composes `AuthProvider` + `RequireAuth` + `LoginPage` into the `/admin/*` route tree. Plan 2 ships the auth building blocks, tested in isolation.

- [ ] **Step 1: Update `.env.example`**

Append:
```
# Admin panel — server-only, used by the Vercel functions in api/admin/*.
# Set locally in .env.local (gitignored); set in Vercel → Settings → Environment Variables.
# ADMIN_PASSWORD       — the single shared password for /admin
# ADMIN_SESSION_SECRET — long random string used to sign the session cookie (HMAC-SHA256)
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

- [ ] **Step 2: Write `src/admin/auth/README.md`**

```markdown
# Admin auth

Single shared password, verified server-side, signed session cookie.

- **Logic** (framework-agnostic, unit-tested): `api/_lib/session.ts` (token + cookie),
  `api/_lib/handlers.ts` (login / session / logout).
- **Prod**: Vercel Node functions `api/admin/{login,session,logout}.ts`.
- **Dev** (`npm run dev`): `vite-plugins/admin-api-dev.ts` serves the same routes;
  cookie is issued without `Secure` (plain http). `vercel dev` also works and is
  closer to prod.
- **Client**: `<AuthProvider>` + `useAuth()` (`src/admin/auth/useAuth.tsx`),
  `<RequireAuth>` gate, `<LoginPage>`. Wired into the `/admin/*` route tree by the
  admin shell (Plan 3).

Env: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (both server-only, never `VITE_`).
Cookie: `admin_session`, HttpOnly, SameSite=Lax, 8h.

To rotate: change `ADMIN_SESSION_SECRET` (invalidates all sessions) or
`ADMIN_PASSWORD`, then redeploy / restart dev.
```

- [ ] **Step 3: Add one line to `Readme.md`**

In the "Admin panel (in progress)" section, add:
```markdown
`/admin` is gated by a single shared password (`ADMIN_PASSWORD`), verified by a
Vercel function with a signed session cookie; `npm run dev` serves the same
`/api/admin/*` routes via a Vite plugin. See `src/admin/auth/README.md`.
```

- [ ] **Step 4: Full verification**

Run:
```bash
npm test
npm run lint
npm run build
npx tsc -p tsconfig.api.json
```
Expected: all green.

- [ ] **Step 5: Manual `vercel dev` sanity (optional, if the Vercel CLI is available)**

`npx vercel dev` → `curl` the three endpoints as in Task 4 Step 6. If the CLI is not installed, note it and rely on the Vite-plugin manual check from Task 4.

- [ ] **Step 6: Commit**

```bash
git add .env.example Readme.md src/admin/auth/README.md
git commit -m "docs: admin auth setup notes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (spec §4 Auth):**

| Spec item | Task |
|---|---|
| `POST /api/admin/login` — constant-time password compare, signed HttpOnly/Secure/SameSite=Lax/8h cookie, payload `{iat,exp}` | 1, 2, 3 |
| `GET /api/admin/session` — validates signature + exp, returns `{authenticated}` | 1, 2, 3 |
| `POST /api/admin/logout` — clears cookie | 2, 3 |
| Zero deps — Node `crypto` only (`@vercel/node` is types) | 1 |
| Dev middleware so `npm run dev` works without `vercel dev` | 4 |
| Client `useAuth()` calls `/api/admin/session` on load; `RequireAuth` redirects to `/admin/login`; `LoginPage` posts password | 5, 6 |
| Best-effort per-IP rate limit in login | **Deferred** — see below |
| Not in scope: multi-user, reset, 2FA, audit log | respected |

**Deferred with reason:** the spec's "best-effort per-IP rate-limit in the login function (resets on cold start)" is dropped from Plan 2. On Vercel it resets every cold start (near-useless) and adds shared mutable state to an otherwise-pure handler; a single strong password + 8h lockout-free model is the phase's accepted posture. Revisit if the panel goes multi-user or public. (Recorded here so the SDD controller rules on it rather than a reviewer flagging a "missing" spec item.)

**2. Placeholder scan:** No TBD/TODO. Two "check the casing when you type it" notes (Task 5 Step 3, and the `useCallback` import) are explicit typing instructions, not placeholders.

**3. Type consistency:** `HandlerResult` / `AuthEnv` defined in Task 2 (`api/_lib/types.ts`), consumed by Tasks 3 & 4. `SESSION_COOKIE`, `signToken`, `verifyToken`, `serializeCookie`, `parseCookies` defined in Task 1, used everywhere after. `dispatchAdminApi` (Task 4) and the three `handle*` names (Task 2) are consistent across the adapter (Task 3) and plugin (Task 4). `useAuth` return shape (`status`/`login`/`logout`/`recheck`) is identical in Tasks 5 and 6. `status` union `'checking' | 'authed' | 'anon'` identical in Tasks 5 & 6.
