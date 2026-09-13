# Request Notes History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `estimate_requests`'s single overwritable `note` field with an append-only comment log (`estimate_request_notes`), shared between the `/admin` web panel and the Telegram bot, showing who added each entry and when.

**Architecture:** A new Supabase table plus a dedicated `adminRequestNotesHandler.ts` (mirroring this project's existing one-file-per-domain handler convention) provides `GET`/`POST` for listing and adding notes, reused unchanged by both `/admin`'s new UI and the bot's rewritten note flow — exactly the "zero duplicated business logic" pattern already used throughout this project. The old single-field `note` write path is removed outright, not deprecated.

**Tech Stack:** TypeScript, Vercel serverless functions, Supabase (Postgres), React (admin panel), grammY (Telegram bot), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-13-request-notes-history-design.md` — read this in full before starting; it has the approved architecture, and this plan's tasks implement it section by section.

## Global Constraints

- Comment body cap: **500 characters** (not the old field's 5000) — enforced both by the DB check constraint and the API handler.
- `author` is a free-text string supplied by the caller, never computed inside the shared handler: `"Admin (web)"` for every web-authored note, `"Owner"` for a bot admin whose Telegram ID is in `TELEGRAM_ADMIN_IDS`, `` `${label} (sales_manager)` `` (or `"Sales manager"` if no label is set) for a bot admin resolved from `telegram_admins`.
- Comments are append-only: no edit or delete endpoint for an individual comment (spec §3).
- `on delete cascade` on `estimate_request_notes.request_id` — deleting a request removes its notes automatically; no new cleanup code in either delete path.
- The old `estimate_requests.note` column stays in the schema, unused, after a one-time data migration copies non-empty values into the new table. Nothing may read or write `estimate_requests.note` after this plan ships.
- Real Supabase round-trips are verified live by the human operator on a deployed preview, not mocked in CI — only a new dep's "not configured" branch gets a unit test, matching every prior plan in this project.
- Migration SQL is exercised manually in the Supabase SQL Editor during live verification, not via an automated test.
- Bot message text must never exceed Telegram's 4096-char `sendMessage` limit — every new bot-rendered text needs the same clip/safety-clip discipline established in the merged Telegram bot Plans 3-4.

---

### Task 1: Supabase migration — `estimate_request_notes` table

**Files:**
- Create: `supabase/migration-2026-09-13-request-notes.sql`

**Interfaces:**
- Produces: table `public.estimate_request_notes (id uuid, request_id uuid, created_at timestamptz, author text, body text)`, readable/writable only by the service role (no RLS policies, matching `estimate_requests`).

This task has no automated test — per this project's established convention (see `supabase/migration-2026-09-12-telegram-admins.sql`, `supabase/migration-2026-09-10-plan4.sql`), migration SQL is verified by the human operator running it manually against the Supabase SQL Editor during live verification, not exercised in CI.

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================================
--  ONVORX — Request Notes History migration. Run once in the Supabase SQL
--  Editor, after schema.sql + seed.sql. The table/index creation below IS
--  safely re-runnable (guarded by `if not exists`). The one-time data
--  migration insert in section 3 is NOT — it has no dedup marker, so
--  running it a second time after real notes have been added would
--  duplicate every migrated row. Run this file, in full, exactly once,
--  BEFORE deploying any app code that lets anyone add a note through
--  /admin or the bot.
-- ============================================================================

-- ---- 1. append-only comment log per request -------------------------------
create table if not exists public.estimate_request_notes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.estimate_requests(id) on delete cascade,
  created_at  timestamptz not null default now(),
  author      text not null,
  body        text not null check (char_length(body) <= 500)
);

create index if not exists idx_estimate_request_notes_request_id
  on public.estimate_request_notes (request_id, created_at desc);

-- ---- 2. row-level security -------------------------------------------
-- no policies at all → only the service role can touch it, same treatment
-- as estimate_requests and every other admin-only table in this project.
alter table public.estimate_request_notes enable row level security;

-- ---- 3. one-time data migration: old single `note` field → first comment --
-- LOSSY STEP: any existing note longer than 500 chars is truncated with a
-- trailing ellipsis (the new per-comment cap is 500, the old field allowed
-- up to 5000). `created_at` uses the request's own received-at timestamp,
-- since the old field never tracked when it was last edited. Run this
-- exactly once, before any app code that writes to estimate_request_notes
-- is deployed — re-running it after that would duplicate every migrated
-- note (there is no "already migrated" marker on estimate_requests.note).
insert into public.estimate_request_notes (request_id, created_at, author, body)
select id, created_at, 'Admin (web)',
       case when char_length(note) > 500 then left(note, 499) || '…' else note end
from public.estimate_requests
where note is not null and note <> '';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migration-2026-09-13-request-notes.sql
git commit -m "feat(supabase): add request notes history migration"
```

---

### Task 2: Backend handler, DTO, and route registration

**Files:**
- Create: `api/_lib/adminRequestNotesHandler.ts`
- Create: `api/admin/request-notes.ts`
- Modify: `api/_lib/adminRequestsHandler.ts` (remove the `note` PATCH branch)
- Modify: `api/_lib/adminRows.ts` (drop `note` from `EstimateRequestDTO`/`estimateFromRow`)
- Modify: `vite-plugins/admin-api-dev.ts` (register the new route for local dev)
- Test: `api/_lib/adminRequestNotesHandler.test.ts`
- Modify tests: `api/_lib/adminRequestsHandler.test.ts`, `api/_lib/adminRows.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin(env)` from `./supabaseAdmin`, `requireSession(cookieHeader, env)` from `./handlers`, `HandlerResult`/`AuthEnv`/`SupabaseAdminEnv` from `./types`.
- Produces (consumed by Tasks 4-5):
  - `export interface RequestNoteDTO { id: string; createdAt: string; author: string; body: string }`
  - `export interface AdminRequestNotesDeps { list: (requestId: string, env: Env) => Promise<{ rows: Record<string, unknown>[]; error: string | null }>; add: (requestId: string, author: string, body: string, env: Env) => Promise<{ error: string | null }> }`
  - `export const defaultAdminRequestNotesDeps: AdminRequestNotesDeps`
  - `export async function handleAdminRequestNotes(input: { method: string; cookieHeader: string | undefined; query?: { requestId?: string }; body: unknown }, env: Env, deps?: AdminRequestNotesDeps): Promise<HandlerResult>` — `GET` (needs `query.requestId`) returns `{ notes: RequestNoteDTO[] }` newest-first; `POST` (body `{ requestId, author, body }`) returns `200 {ok:true}` / `400` (missing/empty/too-long fields) / `500` (`write_failed`).
  - `EstimateRequestDTO` (in `adminRows.ts`) no longer has a `note` field.

- [ ] **Step 1: Write the failing tests for the new handler**

Create `api/_lib/adminRequestNotesHandler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { handleAdminRequestNotes } from './adminRequestNotesHandler'
import { signToken, SESSION_COOKIE } from './session'

const SECRET = 'secret-secret-secret-secret-secret-secret'
const ENV = { ADMIN_SESSION_SECRET: SECRET, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const cookie = `${SESSION_COOKIE}=${signToken(SECRET)}`
const ROW = { id: 'n1', created_at: '2026-01-01T00:00:00Z', author: 'Admin (web)', body: 'hi' }
const deps = () => ({
  list: vi.fn().mockResolvedValue({ rows: [ROW], error: null }),
  add: vi.fn().mockResolvedValue({ error: null }),
})

describe('handleAdminRequestNotes', () => {
  it('401 without a session', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'GET', cookieHeader: undefined, query: { requestId: 'r1' }, body: undefined }, ENV, deps(),
    )
    expect(r.status).toBe(401)
  })
  it('500 when Supabase is not configured', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'GET', cookieHeader: cookie, query: { requestId: 'r1' }, body: undefined },
      { ADMIN_SESSION_SECRET: SECRET }, deps(),
    )
    expect(r.status).toBe(500)
  })
  it('GET requires a requestId query param → 400 without it', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'GET', cookieHeader: cookie, query: {}, body: undefined }, ENV, deps(),
    )
    expect(r.status).toBe(400)
  })
  it('GET → 200 with camelCase DTOs, newest first as returned by deps.list', async () => {
    const d = deps()
    const r = await handleAdminRequestNotes(
      { method: 'GET', cookieHeader: cookie, query: { requestId: 'r1' }, body: undefined }, ENV, d,
    )
    expect(d.list).toHaveBeenCalledWith('r1', ENV)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ notes: [{ id: 'n1', createdAt: '2026-01-01T00:00:00Z', author: 'Admin (web)', body: 'hi' }] })
  })
  it('GET → 500 on a list error', async () => {
    const d = deps(); d.list.mockResolvedValue({ rows: [], error: 'boom' })
    const r = await handleAdminRequestNotes(
      { method: 'GET', cookieHeader: cookie, query: { requestId: 'r1' }, body: undefined }, ENV, d,
    )
    expect(r.status).toBe(500)
  })
  it('POST → deps.add(requestId, author, body)', async () => {
    const d = deps()
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { requestId: 'r1', author: 'Admin (web)', body: 'called' } }, ENV, d,
    )
    expect(d.add).toHaveBeenCalledWith('r1', 'Admin (web)', 'called', ENV)
    expect(r.status).toBe(200)
  })
  it('POST missing requestId → 400, does not call deps.add', async () => {
    const d = deps()
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { author: 'Admin (web)', body: 'called' } }, ENV, d,
    )
    expect(r.status).toBe(400)
    expect(d.add).not.toHaveBeenCalled()
  })
  it('POST empty body text → 400', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { requestId: 'r1', author: 'Admin (web)', body: '   ' } }, ENV, deps(),
    )
    expect(r.status).toBe(400)
  })
  it('POST body over 500 chars → 400', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { requestId: 'r1', author: 'Admin (web)', body: 'x'.repeat(501) } }, ENV, deps(),
    )
    expect(r.status).toBe(400)
  })
  it('POST missing author → 400', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { requestId: 'r1', body: 'called' } }, ENV, deps(),
    )
    expect(r.status).toBe(400)
  })
  it('POST → 500 on a write error', async () => {
    const d = deps(); d.add.mockResolvedValue({ error: 'boom' })
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { requestId: 'r1', author: 'Admin (web)', body: 'called' } }, ENV, d,
    )
    expect(r.status).toBe(500)
  })
  it('405 on an unsupported method', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'DELETE', cookieHeader: cookie, body: {} }, ENV, deps(),
    )
    expect(r.status).toBe(405)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/adminRequestNotesHandler.test.ts`
Expected: FAIL — `./adminRequestNotesHandler` does not exist yet.

- [ ] **Step 3: Write the handler**

Create `api/_lib/adminRequestNotesHandler.ts`:

```ts
import type { HandlerResult, AuthEnv, SupabaseAdminEnv } from './types'
import { requireSession } from './handlers'
import { getSupabaseAdmin } from './supabaseAdmin'

type Env = AuthEnv & SupabaseAdminEnv

export interface RequestNoteDTO {
  id: string
  createdAt: string
  author: string
  body: string
}

interface DepResult { error: string | null }
export interface AdminRequestNotesDeps {
  list: (requestId: string, env: Env) => Promise<{ rows: Record<string, unknown>[]; error: string | null }>
  add: (requestId: string, author: string, body: string, env: Env) => Promise<DepResult>
}

export const defaultAdminRequestNotesDeps: AdminRequestNotesDeps = {
  list: async (requestId, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { rows: [], error: 'not_configured' }
    const { data, error } = await c
      .from('estimate_request_notes')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
    return { rows: (data ?? []) as Record<string, unknown>[], error: error ? error.message : null }
  },
  add: async (requestId, author, body, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c
      .from('estimate_request_notes')
      .insert({ request_id: requestId, author, body })
    return { error: error ? error.message : null }
  },
}

const bad = (): HandlerResult => ({ status: 400, body: { error: 'invalid_request' } })
const fail = (): HandlerResult => ({ status: 500, body: { error: 'write_failed' } })
const ok = (): HandlerResult => ({ status: 200, body: { ok: true } })

const noteFromRow = (row: Record<string, unknown>): RequestNoteDTO => ({
  id: String(row.id),
  createdAt: String(row.created_at),
  author: String(row.author ?? ''),
  body: String(row.body ?? ''),
})

export async function handleAdminRequestNotes(
  input: { method: string; cookieHeader: string | undefined; query?: { requestId?: string }; body: unknown },
  env: Env,
  deps: AdminRequestNotesDeps = defaultAdminRequestNotesDeps,
): Promise<HandlerResult> {
  if (!requireSession(input.cookieHeader, env)) return { status: 401, body: { error: 'unauthorized' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 500, body: { error: 'not_configured' } }

  if (input.method === 'GET') {
    const requestId = input.query?.requestId
    if (typeof requestId !== 'string' || !requestId) return bad()
    const { rows, error } = await deps.list(requestId, env)
    if (error) return fail()
    return { status: 200, body: { notes: rows.map(noteFromRow) } }
  }
  if (input.method === 'POST') {
    const body = (input.body ?? {}) as Record<string, unknown>
    if (typeof body.requestId !== 'string' || !body.requestId) return bad()
    if (typeof body.author !== 'string' || !body.author) return bad()
    if (typeof body.body !== 'string' || !body.body.trim() || body.body.length > 500) return bad()
    const { error } = await deps.add(body.requestId, body.author, body.body, env)
    return error ? fail() : ok()
  }
  return { status: 405, body: { error: 'method_not_allowed' } }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/adminRequestNotesHandler.test.ts`
Expected: PASS (all 12 tests).

- [ ] **Step 5: Register the new route (Vercel function + local dev)**

Create `api/admin/request-notes.ts`:

```ts
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
```

In `vite-plugins/admin-api-dev.ts`:

1. Add the import alongside the other handler imports (near the top of the file):

```ts
import { handleAdminRequestNotes } from '../api/_lib/adminRequestNotesHandler'
```

2. Add `'/api/admin/request-notes'` to the `KNOWN_API_PATHS` set:

```ts
export const KNOWN_API_PATHS = new Set([
  '/api/admin/login',
  '/api/admin/session',
  '/api/admin/logout',
  '/api/estimate',
  '/api/admin/content',
  '/api/admin/requests',
  '/api/admin/upload',
  '/api/admin/cards',
  '/api/admin/request-notes',
])
```

3. Add a matching `case` inside `dispatchApi()`'s `switch`, right after the existing `/api/admin/cards` case:

```ts
    case '/api/admin/request-notes': {
      const params = new URLSearchParams(input.url.split('?')[1] ?? '')
      return handleAdminRequestNotes(
        {
          method: input.method,
          cookieHeader: input.cookieHeader,
          query: { requestId: params.get('requestId') ?? undefined },
          body: input.jsonBody ?? {},
        },
        env,
      )
    }
```

- [ ] **Step 6: Remove the old single-field note write path**

In `api/_lib/adminRequestsHandler.ts`, delete this block from the `PATCH` branch (it currently sits between the `status` block and the `Object.keys(fields).length === 0` check):

```ts
    if (body.note !== undefined) {
      if (typeof body.note !== 'string' || body.note.length > 5000) return bad()
      fields.note = body.note
    }
```

The `PATCH` branch should read exactly:

```ts
  if (input.method === 'PATCH') {
    if (typeof body.id !== 'string' || !body.id) return bad()
    const fields: Record<string, unknown> = {}
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as string)) return bad()
      fields.status = body.status
    }
    if (Object.keys(fields).length === 0) return bad()
    const { error } = await deps.patch(body.id, fields, env)
    return error ? fail() : ok()
  }
```

In `api/_lib/adminRequestsHandler.test.ts`:
- Replace the `it('PATCH note → deps.patch(id, {note})', ...)` test with:

```ts
  it('PATCH note (no longer supported) → 400, does not call deps.patch', async () => {
    const d = deps()
    const r = await handleAdminRequests({ method: 'PATCH', cookieHeader: cookie, body: { id: 'r1', note: 'called' } }, ENV, d)
    expect(r.status).toBe(400)
    expect(d.patch).not.toHaveBeenCalled()
  })
```
- In the `ROW` fixture at the top of the file, remove `, note: null` from the object literal.

- [ ] **Step 7: Drop `note` from the request DTO**

In `api/_lib/adminRows.ts`:
- In `EstimateRequestDTO`, delete the `note?: string` field. The interface becomes:

```ts
export interface EstimateRequestDTO {
  id: string; createdAt: string; status: string; name: string; email: string
  company?: string; budget?: string; interestedIn: string[]; message: string
  locale: string; sourcePage?: string
}
```

- In `estimateFromRow`, delete the `note: s(row.note),` line.

In `api/_lib/adminRows.test.ts`, in the `estimateFromRow` describe block, remove `, note: null` from the input row object passed to `estimateFromRow(...)` (the expected output object already has no `note` key, so no change needed there).

- [ ] **Step 8: Run the full backend test suite and typecheck**

Run: `npx vitest run` and `npx tsc -p tsconfig.api.json`
Expected: All tests pass; 0 TypeScript errors. (Tasks 4-5 will fail to compile until this task's `RequestNoteDTO`/`AdminRequestNotesDeps`/`handleAdminRequestNotes` exist, which is why this task must land first — do not worry about `telegramMenu.ts`/`telegramRequestsDispatch.ts` compile errors yet if this is run before those tasks; this task's own files must be clean.)

- [ ] **Step 9: Commit**

```bash
git add api/_lib/adminRequestNotesHandler.ts api/_lib/adminRequestNotesHandler.test.ts api/admin/request-notes.ts vite-plugins/admin-api-dev.ts api/_lib/adminRequestsHandler.ts api/_lib/adminRequestsHandler.test.ts api/_lib/adminRows.ts api/_lib/adminRows.test.ts
git commit -m "feat(request-notes): add adminRequestNotesHandler, route, and remove the old single-note field"
```

---

### Task 3: `/admin` web UI

**Files:**
- Modify: `src/admin/types.ts` (add `RequestNote`, drop `note` from `EstimateRequest`)
- Modify: `src/admin/api.ts` (drop `setRequestNote`, add `listRequestNotes`/`addRequestNote`)
- Modify: `src/admin/hooks/useRequests.ts` (drop `setNote`)
- Create: `src/admin/hooks/useRequestNotes.ts`
- Modify: `src/admin/pages/RequestsPage.tsx` (replace the single note field with a comment list + add-note form)
- Modify: `src/admin/admin.css` (styles for the new comment list)
- Modify: `src/admin/mock/requests.ts` (drop the 3 `note:` fields)
- Create: `src/admin/mock/requestNotes.ts`
- Test: `src/admin/pages/RequestsPage.test.tsx` (update mocks, add note-related assertions)

**Interfaces:**
- Consumes: `RequestNoteDTO` shape from Task 2 (as JSON over `GET`/`POST /api/admin/request-notes`).
- Produces: `RequestNote` type in `src/admin/types.ts` — `{ id: string; createdAt: string; author: string; body: string }` (matches `RequestNoteDTO` field-for-field); `useRequestNotes(requestId: string) => { notes: RequestNote[] | null; error: boolean; addNote: (body: string) => Promise<void> }`.

- [ ] **Step 1: Update types and the API client**

In `src/admin/types.ts`:
- Remove `note?: string` from the `EstimateRequest` interface.
- Change `NewRequestInput`'s `Omit` list to drop `'note'` (it no longer exists on `EstimateRequest`):

```ts
export type NewRequestInput = Omit<
  EstimateRequest,
  'id' | 'createdAt' | 'status'
>
```

- Add, right after the `EstimateRequest` interface:

```ts
export interface RequestNote {
  id: string
  createdAt: string
  author: string
  body: string
}
```

In `src/admin/api.ts`:
- Add `RequestNote` to the type-only import from `./types`.
- Remove the `setRequestNote` entry from `adminApi`.
- Add, right after `deleteRequest`:

```ts
  listRequestNotes: (requestId: string) =>
    call<{ notes: RequestNote[] }>(`/api/admin/request-notes?requestId=${requestId}`, 'GET').then((r) => r.notes),
  addRequestNote: (requestId: string, body: string) =>
    call<void>('/api/admin/request-notes', 'POST', { requestId, author: 'Admin (web)', body }),
```

In `src/admin/hooks/useRequests.ts`, remove the `setNote` callback (the block starting `const setNote = useCallback(...)`) and remove `setNote` from the returned object.

- [ ] **Step 2: Write the failing test for the new hook and updated page**

Create `src/admin/hooks/useRequestNotes.ts` test inline via the page test (this project does not unit-test hooks in isolation elsewhere in `src/admin/hooks/` — `useRequests.ts` itself has no dedicated test file either, it's exercised through `RequestsPage.test.tsx`). So this step's failing test is the page-level test below.

Create `src/admin/mock/requestNotes.ts`:

```ts
import type { RequestNote } from '../types'

export const mockRequestNotes: Record<string, RequestNote[]> = {
  req_0001: [],
  req_0002: [],
  req_0003: [
    {
      id: 'note_0001',
      createdAt: '2026-09-01T08:00:00.000Z',
      author: 'Admin (web)',
      body: 'Sent intro call link, waiting for a slot.',
    },
  ],
  req_0004: [],
  req_0005: [
    {
      id: 'note_0002',
      createdAt: '2026-09-06T10:00:00.000Z',
      author: 'Admin (web)',
      body: 'Delivered 2026-09-06. Invoice sent.',
    },
  ],
  req_0006: [],
  req_0007: [
    {
      id: 'note_0003',
      createdAt: '2026-07-19T16:00:00.000Z',
      author: 'Owner',
      body: 'Not a fit — archived.',
    },
  ],
}
```

In `src/admin/mock/requests.ts`, delete the three `note: '...'` lines (on `req_0003`, `req_0005`, `req_0007`).

Replace `src/admin/pages/RequestsPage.test.tsx` in full:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { ToastProvider } from '../components/Toast'
import { mockRequests } from '../mock/requests'
import { mockRequestNotes } from '../mock/requestNotes'
import { RequestsPage } from './RequestsPage'

vi.mock('../api', () => ({
  adminApi: {
    listRequests: vi.fn(),
    setRequestStatus: vi.fn().mockResolvedValue(undefined),
    listRequestNotes: vi.fn(),
    addRequestNote: vi.fn().mockResolvedValue(undefined),
    deleteRequest: vi.fn().mockResolvedValue(undefined),
  },
}))
import { adminApi } from '../api'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(adminApi.listRequests).mockResolvedValue(
    mockRequests.map((r) => ({ ...r })),
  )
  vi.mocked(adminApi.setRequestStatus).mockResolvedValue(undefined)
  vi.mocked(adminApi.listRequestNotes).mockImplementation(async (requestId: string) =>
    (mockRequestNotes[requestId] ?? []).map((n) => ({ ...n })),
  )
  vi.mocked(adminApi.addRequestNote).mockResolvedValue(undefined)
  vi.mocked(adminApi.deleteRequest).mockResolvedValue(undefined)
})

const wrap = () =>
  render(
    <I18nProvider>
      <ToastProvider>
        <RequestsPage />
      </ToastProvider>
    </I18nProvider>,
  )

describe('RequestsPage', () => {
  it('lists requests from the server and filters by status', async () => {
    const user = userEvent.setup()
    wrap()
    expect(await screen.findByText('Olena Kravets')).toBeInTheDocument()
    expect(screen.getByText('Tomasz Nowak')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/status/i), 'archived')
    expect(screen.queryByText('Olena Kravets')).not.toBeInTheDocument()
    expect(screen.getByText('Anna Schmidt')).toBeInTheDocument()
  })

  it('filters by free text (name/email/message)', async () => {
    const user = userEvent.setup()
    wrap()
    await screen.findByText('Olena Kravets')
    await user.type(screen.getByLabelText(/search/i), 'encryptia')
    expect(screen.getByText('Markus Feld')).toBeInTheDocument()
    expect(screen.queryByText('Olena Kravets')).not.toBeInTheDocument()
  })

  it('opens a row, changes status, and calls the api', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(await screen.findByRole('button', { name: /Olena Kravets/i }))
    const detail = screen.getByRole('region', { name: /request detail/i })
    await user.selectOptions(within(detail).getByLabelText(/status/i), 'done')
    expect(adminApi.setRequestStatus).toHaveBeenCalledWith('req_0001', 'done')
    expect(
      within(screen.getByRole('table')).getAllByText(/done/i).length,
    ).toBeGreaterThan(0)
  })

  it('opens a row via the keyboard-focusable row button', async () => {
    const user = userEvent.setup()
    wrap()
    ;(await screen.findByRole('button', { name: /Olena Kravets/i })).focus()
    await user.keyboard('{Enter}')
    expect(
      screen.getByRole('region', { name: /request detail/i }),
    ).toBeInTheDocument()
  })

  it('deletes a request after confirmation', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(await screen.findByRole('button', { name: /Olena Kravets/i }))
    const detail = screen.getByRole('region', { name: /request detail/i })
    await user.click(within(detail).getByRole('button', { name: /^delete$/i }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /delete request/i }),
    )
    expect(adminApi.deleteRequest).toHaveBeenCalledWith('req_0001')
    expect(screen.queryByText('Olena Kravets')).not.toBeInTheDocument()
  })

  it('shows no notes for a request with none yet', async () => {
    wrap()
    await userEvent.setup().click(await screen.findByRole('button', { name: /Olena Kravets/i }))
    const detail = screen.getByRole('region', { name: /request detail/i })
    expect(await within(detail).findByText(/no notes yet/i)).toBeInTheDocument()
  })

  it('shows existing notes and adds a new one without touching the old ones', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(await screen.findByRole('button', { name: /Iryna Bondar/i }))
    const detail = screen.getByRole('region', { name: /request detail/i })
    expect(await within(detail).findByText(/Sent intro call link/i)).toBeInTheDocument()
    await user.type(within(detail).getByPlaceholderText(/add a note/i), 'Called back today.')
    await user.click(within(detail).getByRole('button', { name: /add note/i }))
    expect(adminApi.addRequestNote).toHaveBeenCalledWith('req_0003', 'Called back today.')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/admin/pages/RequestsPage.test.tsx`
Expected: FAIL — `useRequestNotes` does not exist, `RequestsPage.tsx` still has the old single-note UI.

- [ ] **Step 4: Write the hook**

Create `src/admin/hooks/useRequestNotes.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import type { RequestNote } from '../types'
import { adminApi } from '../api'

export function useRequestNotes(requestId: string) {
  const [notes, setNotes] = useState<RequestNote[] | null>(null)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    try {
      setNotes(await adminApi.listRequestNotes(requestId))
      setError(false)
    } catch {
      setError(true)
    }
  }, [requestId])

  useEffect(() => {
    void reload()
  }, [reload])

  const addNote = useCallback(
    async (body: string) => {
      await adminApi.addRequestNote(requestId, body)
      await reload()
    },
    [requestId, reload],
  )

  return { notes, error, addNote }
}
```

- [ ] **Step 5: Rewrite `RequestsPage.tsx`'s `Detail` component**

In `src/admin/pages/RequestsPage.tsx`:
- Add the import: `import { useRequestNotes } from '../hooks/useRequestNotes'`
- Replace the `DetailProps` interface and the whole `Detail` function with:

```tsx
interface DetailProps {
  req: EstimateRequest
  setStatus: (id: string, status: RequestStatus) => Promise<void>
  remove: (id: string) => Promise<void>
}

function Detail({ req, setStatus, remove }: DetailProps) {
  const { confirm, dialog } = useConfirm()
  const toast = useToast()
  const { notes, addNote } = useRequestNotes(req.id)
  const [draft, setDraft] = useState('')

  const del = async () => {
    const ok = await confirm({
      title: 'Delete this request?',
      message: 'It will be permanently removed.',
      confirmLabel: 'Delete request',
      danger: true,
    })
    if (ok) {
      remove(req.id)
        .then(() => toast('Request deleted'))
        .catch(() => toast('Save failed', 'error'))
    }
  }

  const submitNote = () => {
    const body = draft.trim()
    if (!body) return
    addNote(body)
      .then(() => {
        setDraft('')
        toast('Note added')
      })
      .catch(() => toast('Save failed', 'error'))
  }

  return (
    <section className="admin-detail" aria-label="Request detail">
      <h2>{req.name}</h2>
      <dl className="admin-detail__grid">
        <dt>Email</dt><dd><a href={`mailto:${req.email}`}>{req.email}</a></dd>
        <dt>Company</dt><dd>{req.company || '—'}</dd>
        <dt>Budget</dt><dd>{req.budget ?? '—'}</dd>
        <dt>Interested in</dt><dd>{req.interestedIn.join(', ') || '—'}</dd>
        <dt>Language</dt><dd>{req.locale.toUpperCase()}</dd>
        <dt>From page</dt><dd>{req.sourcePage ?? '—'}</dd>
        <dt>Received</dt><dd>{fmtDate(req.createdAt)}</dd>
      </dl>
      <p className="admin-detail__message">{req.message}</p>

      <label className="admin-field">
        <span className="admin-field__label">Status</span>
        <select
          className="admin-input"
          value={req.status}
          onChange={(e) =>
            setStatus(req.id, e.target.value as RequestStatus).catch(() =>
              toast('Save failed', 'error'),
            )
          }
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </label>

      <div className="admin-field">
        <span className="admin-field__label">Notes</span>
        {notes === null ? (
          <p className="admin-page__hint">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="admin-page__hint">No notes yet.</p>
        ) : (
          <ul className="admin-notes">
            {notes.map((n) => (
              <li key={n.id} className="admin-notes__item">
                <span className="admin-notes__meta">{fmtDate(n.createdAt)} — {n.author}</span>
                <p className="admin-notes__body">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
        <textarea
          className="admin-textarea"
          value={draft}
          maxLength={500}
          placeholder="Add a note…"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="button" className="admin-btn admin-btn--primary" onClick={submitNote}>
          Add note
        </button>
      </div>

      <div className="admin-detail__actions">
        <button type="button" className="admin-btn admin-btn--danger" onClick={del}>
          Delete
        </button>
      </div>
      {dialog}
    </section>
  )
}
```

- Update the `RequestsPage` function's own body: remove `setNote` from the `useRequests()` destructure (`const { requests, error, setStatus, remove } = useRequests()`), and remove the `setNote={setNote}` prop from the `<Detail ... />` usage at the bottom of the file.

- [ ] **Step 6: Add CSS for the new comment list**

In `src/admin/admin.css`, add these rules right after the existing `.admin-detail__actions` rule:

```css
.admin-notes { list-style: none; margin: 0 0 0.75rem; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; max-height: 16rem; overflow-y: auto; }
.admin-notes__item { background: var(--surface-2, #fbfbfc); border-radius: var(--radius-sm, 8px); padding: 0.6rem 0.75rem; }
.admin-notes__meta { display: block; font-size: 0.78rem; color: var(--text-3, #8a8d95); margin-bottom: 0.2rem; }
.admin-notes__body { margin: 0; font-size: 0.88rem; white-space: pre-wrap; }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/admin/pages/RequestsPage.test.tsx src/admin/pages/DashboardPage.test.tsx`
Expected: PASS (both files — `DashboardPage.test.tsx` uses the same `mockRequests` fixture and doesn't reference `note`, so it must still pass unchanged).

- [ ] **Step 8: Run the full frontend test suite and typecheck**

Run: `npx vitest run` and `npx tsc -b` (this project's frontend typecheck, per `package.json`'s `build` script)
Expected: All tests pass; 0 TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/admin/types.ts src/admin/api.ts src/admin/hooks/useRequests.ts src/admin/hooks/useRequestNotes.ts src/admin/pages/RequestsPage.tsx src/admin/admin.css src/admin/mock/requests.ts src/admin/mock/requestNotes.ts src/admin/pages/RequestsPage.test.tsx
git commit -m "feat(admin): replace the single request note field with a comment history"
```

---

### Task 4: Telegram bot menu builders

**Files:**
- Modify: `api/_lib/telegramMenu.ts`
- Modify: `api/_lib/telegramMenu.test.ts`

**Interfaces:**
- Consumes: `RequestNoteDTO` from `./adminRequestNotesHandler` (Task 2); existing `EstimateRequestDTO` (now without `note`), `clip`, `formatReceivedAt`, `STATUS_LABEL` already in this file.
- Produces (consumed by Task 5):
  - `export function buildRequestDetail(req: EstimateRequestDTO, notes: RequestNoteDTO[], opts?: { saved?: boolean }): BotReply` — **signature changed**, now takes `notes` as its second parameter.
  - `export function buildRequestNotePrompt(lastNote: RequestNoteDTO | undefined): BotReply` — **signature changed**, now takes the single most recent note (or `undefined`) instead of a raw string.
  - `export function buildRequestNotesHistory(notes: RequestNoteDTO[], backCallback: string): BotReply` — new.

- [ ] **Step 1: Write the failing tests**

In `api/_lib/telegramMenu.test.ts`:
- Add the import: `import type { RequestNoteDTO } from './adminRequestNotesHandler'` alongside the existing `import type { EstimateRequestDTO } from './adminRows'`.
- In the `REQUEST_A`/`REQUEST_B` fixtures, delete the `note: undefined,` and `note: 'Called back, waiting on budget confirmation.',` lines (the field no longer exists on `EstimateRequestDTO`).
- Add, right after the `REQUEST_B` fixture:

```ts
const NOTE_A: RequestNoteDTO = {
  id: 'note-1', createdAt: '2026-09-13T10:07:00.000Z', author: 'Owner', body: 'send a letter with estimate',
}
const NOTE_B: RequestNoteDTO = {
  id: 'note-2', createdAt: '2026-09-11T14:20:00.000Z', author: 'Sam (sales_manager)', body: 'called, no answer',
}
const NOTE_C: RequestNoteDTO = {
  id: 'note-3', createdAt: '2026-09-10T09:00:00.000Z', author: 'Admin (web)', body: 'initial review done',
}
```

- Replace the entire `describe('buildRequestDetail', ...)` block with:

```ts
describe('buildRequestDetail', () => {
  it('shows every read-only field, a Status button with the current value, Add note, Delete, Back', () => {
    const r = buildRequestDetail(REQUEST_A, [])
    expect(r.text).toContain('Jane Doe')
    expect(r.text).toContain('jane@example.com')
    expect(r.text).toContain('Acme Inc')
    expect(r.text).toContain('3-10k')
    expect(r.text).toContain('web-development, support')
    expect(r.text).toContain('EN')
    expect(r.text).toContain('/services')
    expect(r.text).toContain('2026-09-10 14:05')
    expect(r.text).toContain('We need a new website for our product launch.')
    expect(r.text).toContain('Notes: (none yet)')
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: 'Status: New', data: 'requests:status' },
      { text: '➕ Add note', data: 'requests:note' },
      { text: '🗑 Delete', data: 'requests:delete' },
      { text: '⬅ Back', data: 'requests:back:list' },
    ])
  })
  it('shows "—" for missing optional fields and "UA" for the uk locale', () => {
    const r = buildRequestDetail(REQUEST_B, [])
    expect(r.text).toContain('—')
    expect(r.text).toContain('UA')
    expect(readButtons(r).find((b) => b.data === 'requests:status')?.text).toBe('Status: In Progress')
  })
  it('prefixes "Saved." when opts.saved is true', () => {
    expect(buildRequestDetail(REQUEST_A, [], { saved: true }).text.startsWith('Saved.\n\n')).toBe(true)
  })
  it('previews up to 3 most recent notes, no "Full history" button when there are 3 or fewer', () => {
    const r = buildRequestDetail(REQUEST_A, [NOTE_A, NOTE_B, NOTE_C])
    expect(r.text).toContain('Notes:')
    expect(r.text).not.toContain('showing 3 of')
    expect(r.text).toContain('Owner: send a letter with estimate')
    expect(r.text).toContain('Sam (sales_manager): called, no answer')
    expect(r.text).toContain('Admin (web): initial review done')
    expect(readButtons(r).some((b) => b.data === 'requests:notes:req-1')).toBe(false)
  })
  it('shows a "Full history" button and "(showing 3 of N)" when there are more than 3 notes', () => {
    const extra: RequestNoteDTO = { id: 'note-4', createdAt: '2026-09-09T00:00:00.000Z', author: 'Owner', body: 'oldest' }
    const r = buildRequestDetail(REQUEST_A, [NOTE_A, NOTE_B, NOTE_C, extra])
    expect(r.text).toContain('Notes (showing 3 of 4):')
    expect(r.text).not.toContain('oldest')
    const buttons = readButtons(r)
    expect(buttons.find((b) => b.data === 'requests:notes:req-1')?.text).toBe('📝 Full history')
  })
  it('clips a very long message so the reply stays under Telegram\'s 4096-char limit', () => {
    const req: EstimateRequestDTO = { ...REQUEST_A, message: 'x'.repeat(5000) }
    const r = buildRequestDetail(req, [NOTE_A])
    expect(r.text.length).toBeLessThan(4096)
    expect(r.text).toContain('…')
  })
  it('stays under the 4096-char limit even when every field is independently maxed out', () => {
    const req: EstimateRequestDTO = {
      ...REQUEST_A,
      name: 'n'.repeat(200),
      email: `${'e'.repeat(190)}@x.com`,
      company: 'c'.repeat(200),
      sourcePage: 's'.repeat(200),
      interestedIn: Array.from({ length: 20 }, (_, i) => 'i'.repeat(100) + i),
      message: 'x'.repeat(5000),
    }
    const manyNotes = Array.from({ length: 10 }, (_, i) => ({
      id: `note-${i}`, createdAt: '2026-09-13T00:00:00.000Z', author: 'Owner', body: 'b'.repeat(500),
    }))
    const r = buildRequestDetail(req, manyNotes, { saved: true })
    expect(r.text.length).toBeLessThan(4096)
  })
})
```

- Replace `describe('buildRequestNotePrompt', ...)` with:

```ts
describe('buildRequestNotePrompt', () => {
  it('shows the most recent note as context and asks for new text, no keyboard', () => {
    const r = buildRequestNotePrompt(NOTE_A)
    expect(r.text).toContain('2026-09-13 10:07 UTC')
    expect(r.text).toContain('Owner')
    expect(r.text).toContain('send a letter with estimate')
    expect(r.text).toContain('Send the note text to add')
    expect(r.keyboard).toBeUndefined()
  })
  it('shows "(no notes yet)" when there is no prior note', () => {
    expect(buildRequestNotePrompt(undefined).text).toContain('(no notes yet)')
  })
  it('clips a very long last note', () => {
    const long: RequestNoteDTO = { id: 'n', createdAt: '2026-09-13T00:00:00.000Z', author: 'Owner', body: 'y'.repeat(500) }
    const r = buildRequestNotePrompt(long)
    expect(r.text.length).toBeLessThan(1000)
    expect(r.text).toContain('…')
  })
})

describe('buildRequestNotesHistory', () => {
  it('lists every note newest-first with a Back button, no "(showing X of Y)" when nothing is trimmed', () => {
    const r = buildRequestNotesHistory([NOTE_A, NOTE_B, NOTE_C], 'requests:card:req-1')
    expect(r.text).toContain('Full history (3 total):')
    expect(r.text.indexOf('send a letter with estimate')).toBeLessThan(r.text.indexOf('called, no answer'))
    expect(r.text.indexOf('called, no answer')).toBeLessThan(r.text.indexOf('initial review done'))
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'requests:card:req-1' }])
  })
  it('shows a friendly empty state', () => {
    const r = buildRequestNotesHistory([], 'requests:card:req-1')
    expect(r.text).toBe('No notes yet.')
  })
  it('trims from the oldest end and labels the result when the full list would exceed 4096 chars', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `note-${i}`,
      createdAt: '2026-09-13T00:00:00.000Z',
      author: 'Owner',
      body: `entry-${i} ` + 'x'.repeat(290),
    }))
    const r = buildRequestNotesHistory(many, 'requests:card:req-1')
    expect(r.text.length).toBeLessThan(4096)
    expect(r.text).toContain('showing')
    expect(r.text).toContain('most recent of 30 total')
    // newest entries (index 0) must survive the trim; the oldest (last pushed) may not.
    expect(r.text).toContain('entry-0')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramMenu.test.ts`
Expected: FAIL — `buildRequestDetail`/`buildRequestNotePrompt` have the old signatures, `buildRequestNotesHistory` does not exist.

- [ ] **Step 3: Implement the menu builder changes**

In `api/_lib/telegramMenu.ts`:
- Add the import: `import type { RequestNoteDTO } from './adminRequestNotesHandler'` (alongside the existing `import type { EstimateRequestDTO } from './adminRows'`).
- Replace the entire `buildRequestDetail` function (and everything from it up to, but not including, `buildRequestStatusPrompt`) with:

```ts
function formatNoteLine(n: RequestNoteDTO): string {
  return `• ${formatReceivedAt(n.createdAt)} — ${n.author}: ${clip(n.body, 150)}`
}

function buildNotesPreview(notes: RequestNoteDTO[]): string[] {
  if (notes.length === 0) return ['Notes: (none yet)']
  const shown = notes.slice(0, 3)
  const header = notes.length > 3 ? `Notes (showing 3 of ${notes.length}):` : 'Notes:'
  return [header, ...shown.map(formatNoteLine)]
}

export function buildRequestDetail(
  req: EstimateRequestDTO,
  notes: RequestNoteDTO[],
  opts: { saved?: boolean } = {},
): BotReply {
  const langLabel = req.locale === 'en' ? 'EN' : 'UA'
  const lines = [
    `Email: ${clip(req.email, 200)}`,
    `Company: ${req.company ? clip(req.company, 200) : '—'}`,
    `Budget: ${req.budget ? clip(req.budget, 200) : '—'}`,
    `Interested in: ${req.interestedIn.length ? clip(req.interestedIn.join(', '), 300) : '—'}`,
    `Language: ${langLabel}`,
    `From page: ${req.sourcePage ? clip(req.sourcePage, 200) : '—'}`,
    `Received: ${formatReceivedAt(req.createdAt)}`,
    '',
    clip(req.message, 1500),
    '',
    ...buildNotesPreview(notes),
  ]
  const kb = new InlineKeyboard()
    .text(`Status: ${STATUS_LABEL[req.status] ?? req.status}`, 'requests:status')
    .row()
    .text('➕ Add note', 'requests:note')
    .row()
  if (notes.length > 3) {
    kb.text('📝 Full history', `requests:notes:${req.id}`).row()
  }
  kb.text('🗑 Delete', 'requests:delete')
    .row()
    .text('⬅ Back', 'requests:back:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  const text = clip(`${prefix}${clip(req.name, 200)}\n${lines.join('\n')}`, TELEGRAM_TEXT_MAX)
  return { text, keyboard: kb }
}
```

- Replace `buildRequestNotePrompt` with:

```ts
export function buildRequestNotePrompt(lastNote: RequestNoteDTO | undefined): BotReply {
  const preview = lastNote
    ? `Last note (${formatReceivedAt(lastNote.createdAt)} — ${lastNote.author}):\n${clip(lastNote.body, 300)}`
    : '(no notes yet)'
  return { text: `${preview}\n\nSend the note text to add (up to 500 characters).` }
}
```

- Add, right after `buildRequestNotePrompt`:

```ts
const NOTES_HISTORY_MAX = 4000

export function buildRequestNotesHistory(notes: RequestNoteDTO[], backCallback: string): BotReply {
  const kb = new InlineKeyboard().text('⬅ Back', backCallback)
  if (notes.length === 0) {
    return { text: 'No notes yet.', keyboard: kb }
  }
  const lines = notes.map((n) => `• ${formatReceivedAt(n.createdAt)} — ${n.author}: ${clip(n.body, 300)}`)
  let shown = notes.length
  const render = () =>
    shown === notes.length
      ? `Full history (${notes.length} total):\n\n${lines.slice(0, shown).join('\n')}`
      : `Full history (showing ${shown} most recent of ${notes.length} total):\n\n${lines.slice(0, shown).join('\n')}`
  let text = render()
  while (text.length > NOTES_HISTORY_MAX && shown > 0) {
    shown -= 1
    text = render()
  }
  return { text, keyboard: kb }
}
```

(`lines` is already newest-first, since `notes` is newest-first per `handleAdminRequestNotes`'s GET contract — `lines.slice(0, shown)` keeps the newest `shown` entries and drops from the tail, i.e. the oldest, matching the design spec's "trim from the oldest end".)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramMenu.test.ts`
Expected: PASS (all tests, including the pre-existing ones in this file untouched by this task).

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run` and `npx tsc -p tsconfig.api.json`
Expected: `telegramMenu.ts`/`telegramMenu.test.ts` clean. `telegramRequestsDispatch.ts`/`.test.ts` will still fail to compile until Task 5 updates their call sites to match the new `buildRequestDetail`/`buildRequestNotePrompt` signatures — that is expected and resolved by Task 5, not this one.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/telegramMenu.ts api/_lib/telegramMenu.test.ts
git commit -m "feat(telegram-bot): render note history in buildRequestDetail, add buildRequestNotesHistory"
```

---

### Task 5: Telegram bot dispatch wiring

**Files:**
- Modify: `api/_lib/telegramRequestsDispatch.ts`
- Modify: `api/_lib/telegramRequestsDispatch.test.ts`

**Interfaces:**
- Consumes: `handleAdminRequestNotes`, `defaultAdminRequestNotesDeps`, `AdminRequestNotesDeps`, `RequestNoteDTO` (Task 2); `buildRequestDetail(req, notes, opts)`, `buildRequestNotePrompt(lastNote)`, `buildRequestNotesHistory(notes, backCallback)` (Task 4); `isOwner`, `defaultTelegramAdminsDeps`, `TelegramAdminsDeps`, `ManagerRecord` from `./telegramAdmins` (already merged, unchanged).
- Produces: `RequestsDispatchDeps` gains two fields (`adminRequestNotes`, `admins`); `dispatchRequestsCallback` gains handling for the `requests:notes:<id>` prefix; no change to either function's exported signature.

- [ ] **Step 1: Write the failing tests**

In `api/_lib/telegramRequestsDispatch.test.ts`:
- Add imports: `import { handleAdminRequestNotes, type AdminRequestNotesDeps, type RequestNoteDTO } from './adminRequestNotesHandler'` and `import type { TelegramAdminsDeps, ManagerRecord } from './telegramAdmins'`.
- In the `REQUEST_A`/`REQUEST_B` fixtures, remove the `note: undefined,` field from `REQUEST_A` (it currently has none) — check the file: if `note` does not appear on either fixture already (it was dropped from `EstimateRequestDTO` in Task 2), no change is needed here; otherwise remove it.
- Replace `makeDeps` in full:

```ts
function makeDeps(initialState: TelegramState = { screen: 'main_menu' }) {
  let state = initialState
  let requests: EstimateRequestDTO[] = [{ ...REQUEST_A }, { ...REQUEST_B }]
  let notesByRequest: Record<string, RequestNoteDTO[]> = {
    'req-2': [{ id: 'note-1', createdAt: '2026-09-09T08:00:00.000Z', author: 'Admin (web)', body: 'Old lead.' }],
  }
  let noteSeq = 2

  const adminRequests: AdminRequestsDeps = {
    list: vi.fn(async () => ({
      rows: requests.map((r) => ({
        id: r.id, created_at: r.createdAt, status: r.status, name: r.name, email: r.email,
        company: r.company, budget: r.budget, interested_in: r.interestedIn, message: r.message,
        locale: r.locale, source_page: r.sourcePage,
      })),
      error: null,
    })),
    patch: vi.fn(async (id: string, fields: Record<string, unknown>) => {
      requests = requests.map((r) => (r.id === id ? { ...r, ...fields } as EstimateRequestDTO : r))
      return { error: null }
    }),
    remove: vi.fn(async (id: string) => {
      requests = requests.filter((r) => r.id !== id)
      return { error: null }
    }),
  }
  const adminRequestNotes: AdminRequestNotesDeps = {
    list: vi.fn(async (requestId: string) => ({
      rows: (notesByRequest[requestId] ?? []).map((n) => ({
        id: n.id, created_at: n.createdAt, author: n.author, body: n.body,
      })),
      error: null,
    })),
    add: vi.fn(async (requestId: string, author: string, body: string) => {
      const note: RequestNoteDTO = { id: `note-${noteSeq++}`, createdAt: '2026-09-13T12:00:00.000Z', author, body }
      notesByRequest[requestId] = [note, ...(notesByRequest[requestId] ?? [])]
      return { error: null }
    }),
  }
  const admins: TelegramAdminsDeps = {
    findManager: vi.fn(async () => null as ManagerRecord | null),
    listManagers: vi.fn(async () => []),
    addManager: vi.fn(async () => ({ error: null })),
    removeManager: vi.fn(async () => ({ error: null })),
  }
  const sessions: TelegramSessionsDeps = {
    load: vi.fn(async () => state),
    save: vi.fn(async (_chatId, next) => {
      state = next
    }),
  }
  const deps: RequestsDispatchDeps = { adminRequests, adminRequestNotes, admins, sessions }
  return {
    deps, adminRequests, adminRequestNotes, admins, sessions,
    getState: () => state,
    getRequests: () => requests,
    getNotes: (requestId: string) => notesByRequest[requestId] ?? [],
  }
}
```

- Replace the entire `describe('dispatchRequestsCallback — note edit', ...)` block with:

```ts
describe('dispatchRequestsCallback — note edit', () => {
  it('requests:note prompts with the most recent note as context, no keyboard', async () => {
    const { deps } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-2' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:note', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Old lead.')
    expect(reply.text).toContain('Send the note text to add')
    expect(reply.keyboard).toBeUndefined()
  })

  it('requests:note shows "(no notes yet)" for a request with no notes', async () => {
    const { deps } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:note', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('(no notes yet)')
  })

  it('sending text while requests_note_value adds a new note without touching existing ones', async () => {
    const { deps, getNotes } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-2' } })
    const ctx = makeCtx({})
    await dispatchRequestsText(ctx, 'Called back today.', ENV, deps)
    const notes = getNotes('req-2')
    expect(notes).toHaveLength(2)
    expect(notes[0].body).toBe('Called back today.')
    expect(notes[1].body).toBe('Old lead.')
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })

  it('attributes a note added by the owner as "Owner"', async () => {
    const { deps, getNotes } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-1' } })
    const ownerEnv = { ...ENV, TELEGRAM_ADMIN_IDS: '111' }
    await dispatchRequestsText(makeCtx({}), 'From the owner.', ownerEnv, deps)
    expect(getNotes('req-1')[0].author).toBe('Owner')
  })

  it('attributes a note added by a labeled sales_manager', async () => {
    const { deps, admins, getNotes } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-1' } })
    ;(admins.findManager as ReturnType<typeof vi.fn>).mockResolvedValue({
      telegramId: 111, role: 'sales_manager', label: 'Sam', addedBy: 1, createdAt: '2026-01-01T00:00:00Z',
    })
    await dispatchRequestsText(makeCtx({}), 'From Sam.', ENV, deps)
    expect(getNotes('req-1')[0].author).toBe('Sam (sales_manager)')
  })

  it('falls back to a generic label for an unlabeled sales_manager', async () => {
    const { deps, admins, getNotes } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-1' } })
    ;(admins.findManager as ReturnType<typeof vi.fn>).mockResolvedValue({
      telegramId: 111, role: 'sales_manager', label: null, addedBy: 1, createdAt: '2026-01-01T00:00:00Z',
    })
    await dispatchRequestsText(makeCtx({}), 'From an unlabeled manager.', ENV, deps)
    expect(getNotes('req-1')[0].author).toBe('Sales manager')
  })

  it('a note over 500 characters is rejected with a specific message and never written', async () => {
    const { deps, adminRequestNotes } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-1' } })
    const ctx = makeCtx({})
    await dispatchRequestsText(ctx, 'x'.repeat(501), ENV, deps)
    expect(adminRequestNotes.add).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'That note is empty or too long — please send 1-500 characters.' })
  })
})

describe('dispatchRequestsCallback — notes history', () => {
  it('requests:notes:<id> shows the full history with a Back to the card', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:notes:req-2', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Old lead.')
    const buttons = (reply.keyboard.inline_keyboard as { text: string; data: string }[][]).flat()
    expect(buttons).toEqual([{ text: '⬅ Back', data: 'requests:card:req-2' }])
  })

  it('requests:notes:<id> replies with a config error when ADMIN_SESSION_SECRET is missing', async () => {
    const { deps, adminRequestNotes } = makeDeps()
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:notes:req-2', {}, deps)
    expect(adminRequestNotes.list).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Bot is not fully configured — contact the site owner.' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramRequestsDispatch.test.ts`
Expected: FAIL — `RequestsDispatchDeps` doesn't have `adminRequestNotes`/`admins` yet, `requests:notes:` isn't routed, `buildRequestDetail`/`buildRequestNotePrompt` are called with the old arity inside the source file (a `tsc` failure, since Task 4 already changed their signatures).

- [ ] **Step 3: Implement the dispatch changes**

In `api/_lib/telegramRequestsDispatch.ts`:
- Add imports:

```ts
import {
  handleAdminRequestNotes, defaultAdminRequestNotesDeps, type AdminRequestNotesDeps, type RequestNoteDTO,
} from './adminRequestNotesHandler'
import { isOwner, defaultTelegramAdminsDeps, type TelegramAdminsDeps } from './telegramAdmins'
```

- Replace `RequestsDispatchDeps` and `defaultRequestsDispatchDeps`:

```ts
export interface RequestsDispatchDeps {
  adminRequests: AdminRequestsDeps
  adminRequestNotes: AdminRequestNotesDeps
  admins: TelegramAdminsDeps
  sessions: TelegramSessionsDeps
}

export const defaultRequestsDispatchDeps: RequestsDispatchDeps = {
  adminRequests: defaultAdminRequestsDeps,
  adminRequestNotes: defaultAdminRequestNotesDeps,
  admins: defaultTelegramAdminsDeps,
  sessions: defaultTelegramSessionsDeps,
}
```

- Add, right after `fetchRequests`:

```ts
async function fetchNotes(requestId: string, env: Env, deps: RequestsDispatchDeps): Promise<RequestNoteDTO[]> {
  const cookieHeader = adminCookieHeader(env)
  const result = await handleAdminRequestNotes(
    { method: 'GET', cookieHeader: cookieHeader ?? undefined, query: { requestId }, body: undefined },
    env,
    deps.adminRequestNotes,
  )
  if (result.status !== 200) return []
  const body = result.body as { notes: RequestNoteDTO[] }
  return body.notes
}

async function resolveAuthorLabel(fromId: number, env: Env, deps: RequestsDispatchDeps): Promise<string> {
  if (isOwner(fromId, env)) return 'Owner'
  const manager = await deps.admins.findManager(fromId, env)
  return manager?.label ? `${manager.label} (sales_manager)` : 'Sales manager'
}
```

- In `showDetail`, fetch notes and pass them to `buildRequestDetail`. Replace:

```ts
  await deps.sessions.save(ctx.chatId, { screen: 'requests_detail', data: { filter, id } }, env)
  await ctx.reply(menu.buildRequestDetail(req, { saved }))
```

with:

```ts
  const notes = await fetchNotes(id, env, deps)
  await deps.sessions.save(ctx.chatId, { screen: 'requests_detail', data: { filter, id } }, env)
  await ctx.reply(menu.buildRequestDetail(req, notes, { saved }))
```

- In `startNoteEdit`, fetch notes and pass the most recent one. Replace:

```ts
  await deps.sessions.save(ctx.chatId, { screen: 'requests_note_value', data: { filter, id } }, env)
  await ctx.reply(menu.buildRequestNotePrompt(req.note))
```

with:

```ts
  const notes = await fetchNotes(id, env, deps)
  await deps.sessions.save(ctx.chatId, { screen: 'requests_note_value', data: { filter, id } }, env)
  await ctx.reply(menu.buildRequestNotePrompt(notes[0]))
```

- Replace `saveNote` in full:

```ts
async function saveNote(
  ctx: BotCtx, filter: RequestFilter, id: string, text: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const author = await resolveAuthorLabel(ctx.fromId, env, deps)
  const result = await handleAdminRequestNotes(
    { method: 'POST', cookieHeader, body: { requestId: id, author, body: text } },
    env,
    deps.adminRequestNotes,
  )
  if (result.status === 400) {
    await ctx.reply({ text: 'That note is empty or too long — please send 1-500 characters.' })
    return
  }
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`requests:card:${id}`))
    return
  }
  await showDetail(ctx, filter, id, env, deps, true)
}
```

- Add, right after `saveNote`:

```ts
async function showHistory(ctx: BotCtx, id: string, env: Env, deps: RequestsDispatchDeps): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const notes = await fetchNotes(id, env, deps)
  await ctx.reply(menu.buildRequestNotesHistory(notes, `requests:card:${id}`))
}
```

- In `dispatchRequestsCallback`, add a new branch right after the `requests:filter:` block (before `const state = await deps.sessions.load(...)`):

```ts
  if (data.startsWith('requests:notes:')) {
    await showHistory(ctx, data.slice('requests:notes:'.length), env, deps)
    return
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramRequestsDispatch.test.ts`
Expected: PASS (all tests, including the pre-existing status-change/delete/config-error tests untouched by this task).

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run` and `npx tsc -p tsconfig.api.json`
Expected: All tests pass across the whole repo; 0 TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/telegramRequestsDispatch.ts api/_lib/telegramRequestsDispatch.test.ts
git commit -m "feat(telegram-bot): wire the note history flow (add note, full history screen)"
```

---

## Spec coverage check (self-review)

- §4 Data model → Task 1 (migration, cascade delete, 500-char cap, data migration with lossy-truncation comment).
- §5 Backend/API → Task 2 (handler, DTO, route registration, old PATCH removal, author-supplied-by-caller contract).
- §6 `/admin` web UI → Task 3 (hook, API client, comment list + add-note UI, CSS).
- §7 Telegram bot UX → Tasks 4-5 (inline preview, renamed button, full-history screen with safety clip, add-note flow with author resolution and length-error copy).
- §8 Testing approach → followed throughout (unit tests with fakes; migration verified live, not automated; only new deps' "not configured"-adjacent paths get a dedicated test where relevant).
- §3 Non-goals → respected: no edit/delete-comment endpoint added anywhere in Tasks 2-5; no per-user web login introduced; `estimate_requests.note` column left in the schema untouched by Task 1 beyond being read once for the data migration; no real-time updates; no cursor pagination in `buildRequestNotesHistory` (length-based clip only, per §3's explicit YAGNI call).

No placeholder text, TBD, or "add appropriate X" phrasing appears in any task above — every step has complete, runnable code. Type/signature names are consistent across tasks: `RequestNoteDTO` (Task 2) is the exact type Tasks 4-5 import and use; `AdminRequestNotesDeps`/`defaultAdminRequestNotesDeps`/`handleAdminRequestNotes` (Task 2) are the exact names Task 5 imports; `buildRequestDetail`/`buildRequestNotePrompt`/`buildRequestNotesHistory` (Task 4) are the exact names and signatures Task 5 calls.
