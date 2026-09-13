# Telegram Bot Admin — Plan 4: Requests View/Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Requests` stub from Plan 1 with a working triage flow — filter by status → list → open a request's card (read-only submitted fields) → change status → edit the internal note → delete with confirmation — with every read and write going through the exact same `handleAdminRequests` function the web `/admin` panel already uses. **This is the last plan in the Telegram bot series** — once it is live-verified and merged, every row of the spec's Goal §1 capability table is implemented and the bot needs no further plans unless new scope is requested.

**Architecture:** Unlike Plans 2 and 3, this plan needs **no new read-only lookup module**. `api/_lib/adminRequestsHandler.ts`'s `handleAdminRequests` already has a GET method that returns the exact list this plan needs (`{ requests: EstimateRequestDTO[] }`) with no server-side filtering — the web admin's own `RequestsPage.tsx` filters client-side after fetching everything, and this plan's bot code does the identical thing: call `handleAdminRequests({ method: 'GET', ... })` for its one read, filter/sort the returned array locally, and find a request by id from that same array for the detail view. All Requests state-machine logic lives in a new dedicated file, `api/_lib/telegramRequestsDispatch.ts`, kept separate from `telegramDispatch.ts` for the same file-size reason Plan 3 already acted on for Projects/Services.

**Tech Stack:** Same as Plans 1-3 — grammY (already wired), Supabase (`estimate_requests`, already exists), Vercel Functions, Vitest. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-12-telegram-bot-admin.md` — this plan implements Goal §1's Requests row. Read Plan 3 (`docs/superpowers/plans/2026-09-13-telegram-bot-plan-3-projects-services.md`, merged to `main` at `5133e1c`) first — this plan extends its files and reuses its exact patterns (a dedicated dispatch file, `adminCookieHeader` reuse, immediate-apply toggles, a no-keyboard free-text prompt for a single non-language-split field, delete-with-confirm).

## Decided during this plan's authoring (narrower than the spec's literal text)

**Only a status filter, not the web admin's three filters.** `RequestsPage.tsx` filters by status, language, and free-text search. This plan exposes only the status filter (All / New / In Progress / Done / Archived) as inline buttons — a single tap maps naturally onto Telegram's button-driven UI, the way a language toggle or a text-search box does not. Status is also the filter the web UI's own triage workflow centers on. Language and free-text search are out of scope for the bot's v1.

## Global Constraints

Carried forward from Plans 1-3, unchanged and still binding:
- Server-only env vars, never `VITE_`-prefixed.
- Every new `api/_lib/*.ts` module follows the injectable-`Deps`-interface pattern.
- `api/package.json` pins `{"type":"commonjs"}` — never touch it, and never use a dynamic `await import()` inside `api/_lib/*`. Static imports only.
- **Zero duplicated business logic**: every read and write for Requests goes through `handleAdminRequests` — this plan never calls Supabase `.select()`/`.update()`/`.delete()` directly. (This is stricter than Plans 2-3, which only required writes to go through a handler — here even the read does, since no bespoke reader exists or is needed.)
- Display label for the `uk` locale is **"UA"**, not "UK".
- `canAccessSection(role, 'requests')` is the single access gate for this whole plan — unlike Plan 3's `'projects'`/`'services'` shortcut (which relied on the two types sharing identical roles), Requests has its own distinct role set (`sales_manager`, not `content_manager`) and needs no shortcut — just this one check, re-checked on every `requests:*` callback and the `requests_note_value` text step.
- No live Telegram/Supabase calls from unit tests — every test injects fakes.
- Test files are `*.test.ts` next to the file they test, run via `npx vitest run <path>`.
- Model-selection discipline (unchanged): cheapest capable model for the mechanical, fully-specified task (Task 1), a standard model for the judgment/integration task and both task reviewers (Task 2), the most capable available model for the single final whole-branch review. Executed via `superpowers:subagent-driven-development`.

---

## File structure (this plan)

```
onvorx/
  api/
    _lib/
      adminRequestsHandler.ts       # MODIFY: export the existing private `defaultDeps` as `defaultAdminRequestsDeps`
      telegramMenu.ts               # MODIFY: add Requests menu/prompt builders
      telegramMenu.test.ts          # MODIFY
      telegramRequestsDispatch.ts   # CREATE: the Requests state machine (new file — mirrors telegramCardsDispatch.ts)
      telegramRequestsDispatch.test.ts # CREATE
      telegramDispatch.ts           # MODIFY: thin `requests:` prefix delegation + text-step delegation
      telegramDispatch.test.ts      # MODIFY
```

No new Supabase migration — `estimate_requests` already exists. No new read-only lookup module — see Architecture above.

### Interfaces produced by this plan

```ts
// api/_lib/telegramMenu.ts — added
export function buildRequestFilterMenu(): BotReply
export function buildRequestList(filter: RequestFilter, requests: EstimateRequestDTO[]): BotReply
export function buildRequestDetail(req: EstimateRequestDTO, opts?: { saved?: boolean }): BotReply
export function buildRequestStatusPrompt(current: string, backCallback: string): BotReply
export function buildRequestNotePrompt(currentNote: string | undefined): BotReply
export function buildRequestDeleteConfirm(name: string): BotReply
// buildCardSaveFailed(backCallback: string): BotReply — REUSED as-is from Plan 3, not redefined.

// api/_lib/telegramRequestsDispatch.ts
export type RequestFilter = 'all' | 'new' | 'in_progress' | 'done' | 'archived'
export interface RequestsDispatchDeps {
  adminRequests: AdminRequestsDeps
  sessions: TelegramSessionsDeps
}
export function dispatchRequestsCallback(ctx: BotCtx, data: string, env: Env, deps: RequestsDispatchDeps = defaultRequestsDispatchDeps): Promise<void>
export function dispatchRequestsText(ctx: BotCtx, text: string, env: Env, deps: RequestsDispatchDeps = defaultRequestsDispatchDeps): Promise<void>

// api/_lib/telegramDispatch.ts — DispatchDeps grows one field
export interface DispatchDeps {
  // ...unchanged fields from Plans 1-3...
  requestsDispatch: RequestsDispatchDeps  // new
}

// api/_lib/adminRequestsHandler.ts — newly exported
export const defaultAdminRequestsDeps: AdminRequestsDeps
```

---

## Task 1: Requests menu builders — `api/_lib/telegramMenu.ts`

**Files:**
- Modify: `api/_lib/telegramMenu.ts`
- Modify: `api/_lib/telegramMenu.test.ts`

**Interfaces:**
- Consumes: `EstimateRequestDTO` from `api/_lib/adminRows.ts` (already exists: `{ id, createdAt, status, name, email, company?, budget?, interestedIn: string[], message, locale, sourcePage?, note? }`).
- Produces: `RequestFilter` type and every function listed under `telegramMenu.ts` in "Interfaces produced by this plan" above. Task 2 calls all of them by these exact names. `RequestFilter` is defined here (not in a separate "cards"-style module, since there is no read module in this plan) and re-exported by Task 2's dispatch file for its own internal use.

This task also repoints `MENU_ITEMS`'s `requests` entry away from the generic `stub:` prefix, exactly like Plan 2 repointed `content`/`seo` and Plan 3 repointed `projects`/`services`.

- [ ] **Step 1: Write the failing tests**

Add to `api/_lib/telegramMenu.test.ts`. First, change the one stale assertion inside the existing `describe('buildMainMenu', ...)` "owner sees all six sections" test:

```ts
// CHANGE this line (currently `stub:requests`):
    expect(buttons.find((b) => b.text === 'Requests')?.data).toBe('requests:list')
```

Add the import at the top of the file:

```ts
import type { EstimateRequestDTO } from './adminRows'
```

Then append these new `describe` blocks at the end of the file:

```ts
const REQUEST_A: EstimateRequestDTO = {
  id: 'req-1',
  createdAt: '2026-09-10T14:05:00.000Z',
  status: 'new',
  name: 'Jane Doe',
  email: 'jane@example.com',
  company: 'Acme Inc',
  budget: '3-10k',
  interestedIn: ['web-development', 'support'],
  message: 'We need a new website for our product launch.',
  locale: 'en',
  sourcePage: '/services',
  note: undefined,
}
const REQUEST_B: EstimateRequestDTO = {
  id: 'req-2',
  createdAt: '2026-09-11T09:30:00.000Z',
  status: 'in_progress',
  name: 'Ivan Petrenko',
  email: 'ivan@example.com',
  company: undefined,
  budget: undefined,
  interestedIn: [],
  message: 'Потрібен новий сайт.',
  locale: 'uk',
  sourcePage: undefined,
  note: 'Called back, waiting on budget confirmation.',
}

describe('buildRequestFilterMenu', () => {
  it('offers All + every status, then Back to menu:main', () => {
    const buttons = readButtons(buildRequestFilterMenu())
    expect(buttons).toEqual([
      { text: 'All', data: 'requests:filter:all' },
      { text: 'New', data: 'requests:filter:new' },
      { text: 'In Progress', data: 'requests:filter:in_progress' },
      { text: 'Done', data: 'requests:filter:done' },
      { text: 'Archived', data: 'requests:filter:archived' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
})

describe('buildRequestList', () => {
  it('shows one button per request with name and status, then Back', () => {
    const r = buildRequestList('all', [REQUEST_A, REQUEST_B])
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: 'New — Jane Doe', data: 'requests:card:req-1' },
      { text: 'In Progress — Ivan Petrenko', data: 'requests:card:req-2' },
      { text: '⬅ Back', data: 'requests:list' },
    ])
  })
  it('empty list still offers Back', () => {
    const r = buildRequestList('archived', [])
    expect(r.text).toContain('No requests')
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'requests:list' }])
  })
})

describe('buildRequestDetail', () => {
  it('shows every read-only field, a Status button with the current value, Edit note, Delete, Back', () => {
    const r = buildRequestDetail(REQUEST_A)
    expect(r.text).toContain('Jane Doe')
    expect(r.text).toContain('jane@example.com')
    expect(r.text).toContain('Acme Inc')
    expect(r.text).toContain('3-10k')
    expect(r.text).toContain('web-development, support')
    expect(r.text).toContain('EN')
    expect(r.text).toContain('/services')
    expect(r.text).toContain('2026-09-10 14:05')
    expect(r.text).toContain('We need a new website for our product launch.')
    expect(r.text).toContain('(none)')
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: 'Status: New', data: 'requests:status' },
      { text: '✏️ Edit note', data: 'requests:note' },
      { text: '🗑 Delete', data: 'requests:delete' },
      { text: '⬅ Back', data: 'requests:back:list' },
    ])
  })
  it('shows "—" for missing optional fields and "UA" for the uk locale', () => {
    const r = buildRequestDetail(REQUEST_B)
    expect(r.text).toContain('—')
    expect(r.text).toContain('UA')
    expect(r.text).toContain('Called back, waiting on budget confirmation.')
    expect(readButtons(r).find((b) => b.data === 'requests:status')?.text).toBe('Status: In Progress')
  })
  it('prefixes "Saved." when opts.saved is true', () => {
    expect(buildRequestDetail(REQUEST_A, { saved: true }).text.startsWith('Saved.\n\n')).toBe(true)
  })
})

describe('buildRequestStatusPrompt', () => {
  it('offers all four statuses and a Back to the given callback', () => {
    const r = buildRequestStatusPrompt('New', 'requests:card:req-1')
    expect(r.text).toContain('New')
    expect(readButtons(r)).toEqual([
      { text: 'New', data: 'requests:status:new' },
      { text: 'In Progress', data: 'requests:status:in_progress' },
      { text: 'Done', data: 'requests:status:done' },
      { text: 'Archived', data: 'requests:status:archived' },
      { text: '⬅ Back', data: 'requests:card:req-1' },
    ])
  })
})

describe('buildRequestNotePrompt', () => {
  it('shows the current note and asks for the new one, no keyboard', () => {
    const r = buildRequestNotePrompt('Called back, waiting on budget confirmation.')
    expect(r.text).toContain('Called back, waiting on budget confirmation.')
    expect(r.keyboard).toBeUndefined()
  })
  it('shows "(none)" when there is no current note', () => {
    expect(buildRequestNotePrompt(undefined).text).toContain('(none)')
  })
})

describe('buildRequestDeleteConfirm', () => {
  it('names the request and offers Yes/Cancel', () => {
    const r = buildRequestDeleteConfirm('Jane Doe')
    expect(r.text).toContain('Jane Doe')
    expect(readButtons(r)).toEqual([
      { text: 'Yes, delete', data: 'requests:delete:confirm' },
      { text: 'Cancel', data: 'requests:delete:cancel' },
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramMenu.test.ts`
Expected: FAIL — new function names are not exported yet; the changed `buildMainMenu` assertion also fails.

- [ ] **Step 3: Implement the changes in `api/_lib/telegramMenu.ts`**

Change the `requests` entry in the existing `MENU_ITEMS` array:

```ts
  { key: 'requests', label: 'Requests', roles: ['owner', 'sales_manager'], callback: 'requests:list' },
```

Add the import and all the new builders at the end of the file:

```ts
import type { EstimateRequestDTO } from './adminRows'
// (add next to the existing `telegramCards`/`telegramContent` imports at the top of the file)

// ---- Requests ----

export type RequestFilter = 'all' | 'new' | 'in_progress' | 'done' | 'archived'

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  in_progress: 'In Progress',
  done: 'Done',
  archived: 'Archived',
}

const FILTERS: { key: RequestFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'archived', label: 'Archived' },
]

export function buildRequestFilterMenu(): BotReply {
  const kb = new InlineKeyboard()
  FILTERS.forEach((f) => kb.text(f.label, `requests:filter:${f.key}`).row())
  kb.text('⬅ Back', 'menu:main')
  return { text: 'Requests — filter by status:', keyboard: kb }
}

export function buildRequestList(filter: RequestFilter, requests: EstimateRequestDTO[]): BotReply {
  const kb = new InlineKeyboard()
  requests.forEach((r) => {
    kb.text(`${STATUS_LABEL[r.status] ?? r.status} — ${r.name}`, `requests:card:${r.id}`).row()
  })
  kb.text('⬅ Back', 'requests:list')
  if (requests.length === 0) return { text: 'No requests match this filter.', keyboard: kb }
  return { text: `Requests — ${FILTERS.find((f) => f.key === filter)?.label ?? filter}:`, keyboard: kb }
}

const formatReceivedAt = (iso: string): string => iso.slice(0, 16).replace('T', ' ')

export function buildRequestDetail(req: EstimateRequestDTO, opts: { saved?: boolean } = {}): BotReply {
  const langLabel = req.locale === 'en' ? 'EN' : 'UA'
  const lines = [
    `Email: ${req.email}`,
    `Company: ${req.company || '—'}`,
    `Budget: ${req.budget || '—'}`,
    `Interested in: ${req.interestedIn.length ? req.interestedIn.join(', ') : '—'}`,
    `Language: ${langLabel}`,
    `From page: ${req.sourcePage || '—'}`,
    `Received: ${formatReceivedAt(req.createdAt)}`,
    '',
    req.message,
    '',
    `Note: ${req.note || '(none)'}`,
  ]
  const kb = new InlineKeyboard()
    .text(`Status: ${STATUS_LABEL[req.status] ?? req.status}`, 'requests:status')
    .row()
    .text('✏️ Edit note', 'requests:note')
    .row()
    .text('🗑 Delete', 'requests:delete')
    .row()
    .text('⬅ Back', 'requests:back:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return { text: `${prefix}${req.name}\n${lines.join('\n')}`, keyboard: kb }
}

const STATUS_ORDER: { key: string; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'archived', label: 'Archived' },
]

export function buildRequestStatusPrompt(current: string, backCallback: string): BotReply {
  const kb = new InlineKeyboard()
  STATUS_ORDER.forEach((s) => kb.text(s.label, `requests:status:${s.key}`).row())
  kb.text('⬅ Back', backCallback)
  return { text: `Current status: ${current}\n\nChoose a new status:`, keyboard: kb }
}

export function buildRequestNotePrompt(currentNote: string | undefined): BotReply {
  return {
    text: `Current note:\n${currentNote || '(none)'}\n\nSend the new note text.`,
  }
}

export function buildRequestDeleteConfirm(name: string): BotReply {
  const kb = new InlineKeyboard()
    .text('Yes, delete', 'requests:delete:confirm')
    .row()
    .text('Cancel', 'requests:delete:cancel')
  return { text: `Delete the request from "${name}"? It will be permanently removed.`, keyboard: kb }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramMenu.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/telegramMenu.ts api/_lib/telegramMenu.test.ts
git commit -m "feat(telegram-bot): Requests menu builders (filter/list/detail/status/note/delete)"
```

---

## Task 2: Requests dispatch — filter, list, detail, status change, note edit, delete

**Files:**
- Modify: `api/_lib/adminRequestsHandler.ts` (export the existing private `defaultDeps` as `defaultAdminRequestsDeps`)
- Create: `api/_lib/telegramRequestsDispatch.ts`
- Create: `api/_lib/telegramRequestsDispatch.test.ts`
- Modify: `api/_lib/telegramDispatch.ts` (thin `requests:` delegation + `requests_note_value` text delegation)
- Modify: `api/_lib/telegramDispatch.test.ts` (delegation tests)

**Interfaces:**
- Consumes: `buildRequestFilterMenu`, `buildRequestList`, `buildRequestDetail`, `buildRequestStatusPrompt`, `buildRequestNotePrompt`, `buildRequestDeleteConfirm`, `buildCardSaveFailed` (all from Task 1's `telegramMenu.ts`; `buildCardSaveFailed` is REUSED as-is, not redefined — its behavior is domain-agnostic despite the name), `RequestFilter` type (Task 1); `handleAdminRequests`, `defaultAdminRequestsDeps`, `AdminRequestsDeps` from `api/_lib/adminRequestsHandler.ts`; `EstimateRequestDTO` from `api/_lib/adminRows.ts`; `adminCookieHeader` (already exported from `telegramDispatch.ts` since Plan 3); `defaultTelegramSessionsDeps`, `TelegramSessionsDeps`, `TelegramState` from `api/_lib/telegramSessions.ts`.
- Produces: `RequestsDispatchDeps`, `dispatchRequestsCallback`, `dispatchRequestsText` — exact shapes in "Interfaces produced by this plan" above.

- [ ] **Step 1: Export `adminRequestsHandler.ts`'s default deps**

In `api/_lib/adminRequestsHandler.ts`, change:
```ts
const defaultDeps: AdminRequestsDeps = {
```
to:
```ts
export const defaultAdminRequestsDeps: AdminRequestsDeps = {
```
And update `handleAdminRequests`'s default parameter from `defaultDeps` to `defaultAdminRequestsDeps`:
```ts
export async function handleAdminRequests(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: Env,
  deps: AdminRequestsDeps = defaultAdminRequestsDeps,
): Promise<HandlerResult> {
```

Run: `npx vitest run api/_lib/adminRequestsHandler.test.ts` — expect PASS, unchanged (that test file never referenced the old private name).

- [ ] **Step 2: Write the failing tests for `telegramRequestsDispatch.ts`**

```ts
// api/_lib/telegramRequestsDispatch.test.ts
import { describe, it, expect, vi } from 'vitest'
import { dispatchRequestsCallback, dispatchRequestsText } from './telegramRequestsDispatch'
import type { RequestsDispatchDeps } from './telegramRequestsDispatch'
import type { BotCtx } from './telegramDispatch'
import type { AdminRequestsDeps } from './adminRequestsHandler'
import type { TelegramSessionsDeps, TelegramState } from './telegramSessions'
import type { EstimateRequestDTO } from './adminRows'

const ENV = { ADMIN_SESSION_SECRET: 'a-long-enough-test-secret-value' }

const REQUEST_A: EstimateRequestDTO = {
  id: 'req-1', createdAt: '2026-09-10T14:05:00.000Z', status: 'new',
  name: 'Jane Doe', email: 'jane@example.com', company: 'Acme Inc', budget: '3-10k',
  interestedIn: ['web-development'], message: 'We need a new website.',
  locale: 'en', sourcePage: '/services', note: undefined,
}
const REQUEST_B: EstimateRequestDTO = {
  id: 'req-2', createdAt: '2026-09-11T09:30:00.000Z', status: 'archived',
  name: 'Ivan Petrenko', email: 'ivan@example.com', company: undefined, budget: undefined,
  interestedIn: [], message: 'Потрібен сайт.', locale: 'uk', sourcePage: undefined,
  note: 'Old lead.',
}

function makeDeps(initialState: TelegramState = { screen: 'main_menu' }) {
  let state = initialState
  let requests: EstimateRequestDTO[] = [{ ...REQUEST_A }, { ...REQUEST_B }]

  const adminRequests: AdminRequestsDeps = {
    list: vi.fn(async () => ({
      rows: requests.map((r) => ({
        id: r.id, created_at: r.createdAt, status: r.status, name: r.name, email: r.email,
        company: r.company, budget: r.budget, interested_in: r.interestedIn, message: r.message,
        locale: r.locale, source_page: r.sourcePage, note: r.note,
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
  const sessions: TelegramSessionsDeps = {
    load: vi.fn(async () => state),
    save: vi.fn(async (_chatId, next) => {
      state = next
    }),
  }
  const deps: RequestsDispatchDeps = { adminRequests, sessions }
  return { deps, adminRequests, sessions, getState: () => state, getRequests: () => requests }
}

function makeCtx(overrides: Partial<BotCtx>): BotCtx {
  return {
    chatId: 1,
    fromId: 111,
    reply: vi.fn(async () => {}),
    answerCallback: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('dispatchRequestsCallback — filter and list', () => {
  it('requests:list shows the filter menu', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:list', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Requests — filter by status:')
  })

  it('requests:filter:all lists every request, newest first', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:filter:all', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const buttons = (reply.keyboard.inline_keyboard as { text: string }[][]).flat().map((b) => b.text)
    expect(buttons[0]).toBe('Archived — Ivan Petrenko')
    expect(buttons[1]).toBe('New — Jane Doe')
  })

  it('requests:filter:new only shows matching requests', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:filter:new', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const buttons = (reply.keyboard.inline_keyboard as { text: string }[][]).flat().map((b) => b.text)
    expect(buttons).toEqual(['New — Jane Doe', '⬅ Back'])
  })
})

describe('dispatchRequestsCallback — detail', () => {
  it('requests:card:<id> shows the detail view', async () => {
    const { deps } = makeDeps({ screen: 'requests_list', data: { filter: 'all' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:card:req-1', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Jane Doe')
  })

  it('an unknown request id shows an error and falls back to the filter menu', async () => {
    const { deps } = makeDeps({ screen: 'requests_list', data: { filter: 'all' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:card:bogus', ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Could not load that request — please try again.' })
  })

  it('requests:back:list returns to the same filtered list', async () => {
    const { deps } = makeDeps({ screen: 'requests_detail', data: { filter: 'new', id: 'req-1' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:back:list', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const buttons = (reply.keyboard.inline_keyboard as { text: string }[][]).flat().map((b) => b.text)
    expect(buttons).toEqual(['New — Jane Doe', '⬅ Back'])
  })
})

describe('dispatchRequestsCallback — status change', () => {
  it('full flow: status -> new value -> saved, immediate apply', async () => {
    const { deps, getRequests } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:status', ENV, deps)
    const finalCtx = makeCtx({})
    await dispatchRequestsCallback(finalCtx, 'requests:status:done', ENV, deps)

    expect(getRequests().find((r) => r.id === 'req-1')?.status).toBe('done')
    const reply = (finalCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
    expect(reply.text).toContain('Status: Done')
  })

  it('a stale status tap with no request chosen yet shows "session out of sync"', async () => {
    const { deps } = makeDeps({ screen: 'main_menu' })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:status:done', ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Session out of sync — please /start and try again.' })
  })
})

describe('dispatchRequestsCallback — note edit', () => {
  it('requests:note prompts for a new note, no keyboard', async () => {
    const { deps } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-2' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:note', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Old lead.')
    expect(reply.keyboard).toBeUndefined()
  })

  it('sending text while requests_note_value saves the note', async () => {
    const { deps, getRequests } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-1' } })
    const ctx = makeCtx({})
    await dispatchRequestsText(ctx, 'Called, will follow up next week.', ENV, deps)
    expect(getRequests().find((r) => r.id === 'req-1')?.note).toBe('Called, will follow up next week.')
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })
})

describe('dispatchRequestsCallback — delete', () => {
  it('delete -> confirm removes the request and returns to the list', async () => {
    const { deps, getRequests } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    await dispatchRequestsCallback(makeCtx({}), 'requests:delete', ENV, deps)
    const confirmCtx = makeCtx({})
    await dispatchRequestsCallback(confirmCtx, 'requests:delete:confirm', ENV, deps)
    expect(getRequests().find((r) => r.id === 'req-1')).toBeUndefined()
    const reply = (confirmCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Requests')
  })

  it('delete -> cancel keeps the request and returns to the detail', async () => {
    const { deps, getRequests } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    await dispatchRequestsCallback(makeCtx({}), 'requests:delete', ENV, deps)
    const cancelCtx = makeCtx({})
    await dispatchRequestsCallback(cancelCtx, 'requests:delete:cancel', ENV, deps)
    expect(getRequests().find((r) => r.id === 'req-1')).toBeDefined()
    const reply = (cancelCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Jane Doe')
  })

  it('a delete failure shows an error and stays recoverable via its Back button', async () => {
    const { deps, adminRequests, getRequests } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    ;(adminRequests.remove as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })
    await dispatchRequestsCallback(makeCtx({}), 'requests:delete', ENV, deps)
    const confirmCtx = makeCtx({})
    await dispatchRequestsCallback(confirmCtx, 'requests:delete:confirm', ENV, deps)

    expect(getRequests().find((r) => r.id === 'req-1')).toBeDefined()
    expect(confirmCtx.reply).toHaveBeenCalledWith({
      text: 'Could not save — please try again.',
      keyboard: expect.anything(),
    })
  })
})

describe('dispatchRequestsCallback — config error', () => {
  it('replies with a config error and does not call adminRequests.patch when ADMIN_SESSION_SECRET is missing', async () => {
    const { deps, adminRequests } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    const badEnv = {}
    await dispatchRequestsCallback(makeCtx({}), 'requests:status', badEnv, deps)
    const finalCtx = makeCtx({})
    await dispatchRequestsCallback(finalCtx, 'requests:status:done', badEnv, deps)

    expect(adminRequests.patch).not.toHaveBeenCalled()
    expect(finalCtx.reply).toHaveBeenCalledWith({ text: 'Bot is not fully configured — contact the site owner.' })
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramRequestsDispatch.test.ts`
Expected: FAIL — `Cannot find module './telegramRequestsDispatch'`.

- [ ] **Step 4: Implement `api/_lib/telegramRequestsDispatch.ts`**

```ts
import type { AuthEnv, SupabaseAdminEnv, TelegramEnv } from './types'
import { adminCookieHeader, type BotCtx } from './telegramDispatch'
import { handleAdminRequests, defaultAdminRequestsDeps, type AdminRequestsDeps } from './adminRequestsHandler'
import { estimateFromRow, type EstimateRequestDTO } from './adminRows'
import { defaultTelegramSessionsDeps, type TelegramSessionsDeps } from './telegramSessions'
import * as menu from './telegramMenu'
import type { RequestFilter } from './telegramMenu'

type Env = TelegramEnv & SupabaseAdminEnv & AuthEnv

export interface RequestsDispatchDeps {
  adminRequests: AdminRequestsDeps
  sessions: TelegramSessionsDeps
}

export const defaultRequestsDispatchDeps: RequestsDispatchDeps = {
  adminRequests: defaultAdminRequestsDeps,
  sessions: defaultTelegramSessionsDeps,
}

async function fetchRequests(env: Env, deps: RequestsDispatchDeps): Promise<EstimateRequestDTO[]> {
  const cookieHeader = adminCookieHeader(env)
  const result = await handleAdminRequests(
    { method: 'GET', cookieHeader: cookieHeader ?? undefined, body: undefined },
    env,
    deps.adminRequests,
  )
  if (result.status !== 200) return []
  const body = result.body as { requests: EstimateRequestDTO[] }
  return body.requests
}

function sortNewestFirst(requests: EstimateRequestDTO[]): EstimateRequestDTO[] {
  return [...requests].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

function filterByStatus(requests: EstimateRequestDTO[], filter: RequestFilter): EstimateRequestDTO[] {
  if (filter === 'all') return requests
  return requests.filter((r) => r.status === filter)
}

async function showFilterMenu(ctx: BotCtx, env: Env, deps: RequestsDispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'requests_filter' }, env)
  await ctx.reply(menu.buildRequestFilterMenu())
}

async function showList(ctx: BotCtx, filter: RequestFilter, env: Env, deps: RequestsDispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'requests_list', data: { filter } }, env)
  const all = sortNewestFirst(await fetchRequests(env, deps))
  await ctx.reply(menu.buildRequestList(filter, filterByStatus(all, filter)))
}

async function showDetail(
  ctx: BotCtx, filter: RequestFilter, id: string, env: Env, deps: RequestsDispatchDeps, saved = false,
): Promise<void> {
  const all = await fetchRequests(env, deps)
  const req = all.find((r) => r.id === id)
  if (!req) {
    await ctx.reply({ text: 'Could not load that request — please try again.' })
    await showFilterMenu(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'requests_detail', data: { filter, id } }, env)
  await ctx.reply(menu.buildRequestDetail(req, { saved }))
}

async function startStatusChange(
  ctx: BotCtx, filter: RequestFilter, id: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  const all = await fetchRequests(env, deps)
  const req = all.find((r) => r.id === id)
  if (!req) {
    await ctx.reply({ text: 'Could not load that request — please try again.' })
    await showFilterMenu(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'requests_status_choice', data: { filter, id } }, env)
  const current = req.status.replace('_', ' ')
  await ctx.reply(menu.buildRequestStatusPrompt(current, `requests:card:${id}`))
}

async function saveStatus(
  ctx: BotCtx, filter: RequestFilter, id: string, newStatus: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const result = await handleAdminRequests(
    { method: 'PATCH', cookieHeader, body: { id, status: newStatus } },
    env,
    deps.adminRequests,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`requests:card:${id}`))
    return
  }
  await showDetail(ctx, filter, id, env, deps, true)
}

async function startNoteEdit(
  ctx: BotCtx, filter: RequestFilter, id: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  const all = await fetchRequests(env, deps)
  const req = all.find((r) => r.id === id)
  if (!req) {
    await ctx.reply({ text: 'Could not load that request — please try again.' })
    await showFilterMenu(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'requests_note_value', data: { filter, id } }, env)
  await ctx.reply(menu.buildRequestNotePrompt(req.note))
}

async function saveNote(
  ctx: BotCtx, filter: RequestFilter, id: string, text: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const result = await handleAdminRequests(
    { method: 'PATCH', cookieHeader, body: { id, note: text } },
    env,
    deps.adminRequests,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`requests:card:${id}`))
    return
  }
  await showDetail(ctx, filter, id, env, deps, true)
}

async function startDelete(
  ctx: BotCtx, filter: RequestFilter, id: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  const all = await fetchRequests(env, deps)
  const req = all.find((r) => r.id === id)
  if (!req) {
    await ctx.reply({ text: 'Could not load that request — please try again.' })
    await showFilterMenu(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'requests_delete_confirm', data: { filter, id } }, env)
  await ctx.reply(menu.buildRequestDeleteConfirm(req.name))
}

async function confirmDelete(
  ctx: BotCtx, filter: RequestFilter, id: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const result = await handleAdminRequests(
    { method: 'DELETE', cookieHeader, body: { id } },
    env,
    deps.adminRequests,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`requests:card:${id}`))
    return
  }
  await showList(ctx, filter, env, deps)
}

export async function dispatchRequestsCallback(
  ctx: BotCtx, data: string, env: Env, deps: RequestsDispatchDeps = defaultRequestsDispatchDeps,
): Promise<void> {
  if (data === 'requests:list') {
    await showFilterMenu(ctx, env, deps)
    return
  }
  if (data.startsWith('requests:filter:')) {
    await showList(ctx, data.slice('requests:filter:'.length) as RequestFilter, env, deps)
    return
  }

  const state = await deps.sessions.load(ctx.chatId, env)
  const filter = state.data?.filter as RequestFilter | undefined
  const id = state.data?.id as string | undefined

  if (data.startsWith('requests:card:')) {
    if (!filter) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showDetail(ctx, filter, data.slice('requests:card:'.length), env, deps)
    return
  }
  if (data === 'requests:back:list') {
    if (!filter) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showList(ctx, filter, env, deps)
    return
  }
  if (data === 'requests:status') {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startStatusChange(ctx, filter, id, env, deps)
    return
  }
  if (data.startsWith('requests:status:')) {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await saveStatus(ctx, filter, id, data.slice('requests:status:'.length), env, deps)
    return
  }
  if (data === 'requests:note') {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startNoteEdit(ctx, filter, id, env, deps)
    return
  }
  if (data === 'requests:delete') {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startDelete(ctx, filter, id, env, deps)
    return
  }
  if (data === 'requests:delete:confirm') {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await confirmDelete(ctx, filter, id, env, deps)
    return
  }
  if (data === 'requests:delete:cancel') {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showDetail(ctx, filter, id, env, deps)
  }
}

export async function dispatchRequestsText(
  ctx: BotCtx, text: string, env: Env, deps: RequestsDispatchDeps = defaultRequestsDispatchDeps,
): Promise<void> {
  const state = await deps.sessions.load(ctx.chatId, env)
  if (state.screen !== 'requests_note_value') return
  const filter = state.data?.filter as RequestFilter | undefined
  const id = state.data?.id as string | undefined
  if (!filter || !id) {
    await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
    return
  }
  await saveNote(ctx, filter, id, text, env, deps)
}
```

Note: `handleAdminRequests`'s GET path ignores `input.body` entirely (it only reads `body` for PATCH/DELETE/POST-shaped requests) — `fetchRequests`'s `body: undefined` is correct and matches the function's own signature (`body: unknown`).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramRequestsDispatch.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Wire the thin delegation into `telegramDispatch.ts`**

Add the import at the top of `api/_lib/telegramDispatch.ts`:

```ts
import { dispatchRequestsCallback, dispatchRequestsText, defaultRequestsDispatchDeps, type RequestsDispatchDeps } from './telegramRequestsDispatch'
```

Extend `DispatchDeps` and `defaultDispatchDeps`:

```ts
export interface DispatchDeps {
  admins: TelegramAdminsDeps
  sessions: TelegramSessionsDeps
  content: TelegramContentDeps
  adminContent: AdminContentDeps
  cardsDispatch: CardsDispatchDeps
  requestsDispatch: RequestsDispatchDeps
}

export const defaultDispatchDeps: DispatchDeps = {
  admins: defaultTelegramAdminsDeps,
  sessions: defaultTelegramSessionsDeps,
  content: defaultTelegramContentDeps,
  adminContent: defaultAdminContentDeps,
  cardsDispatch: defaultCardsDispatchDeps,
  requestsDispatch: defaultRequestsDispatchDeps,
}
```

In `handleCallback`, insert the `requests:` prefix branch right after the existing `cards:` branch and before the `stub:` branch:

```ts
  if (data.startsWith('requests:')) {
    if (!menu.canAccessSection(role, 'requests')) {
      await ctx.reply(menu.buildNoAccessReply())
      return
    }
    await dispatchRequestsCallback(ctx, data, env, deps.requestsDispatch)
    return
  }
```

In `handleText`, add a `requests_note_value` branch alongside the existing `cards_value`/`cards_tags_value`/`cards_photo_wait` checks, above the `role !== 'owner'` gate:

```ts
  if (state.screen === 'requests_note_value') {
    if (!menu.canAccessSection(role, 'requests')) {
      await ctx.reply(TEXT_FALLBACK_REPLY)
      return
    }
    await dispatchRequestsText(ctx, text, env, deps.requestsDispatch)
    return
  }
```

- [ ] **Step 7: Write and run the delegation tests in `telegramDispatch.test.ts`**

The file's existing `makeDeps()` helper needs a `requestsDispatch` fake added to the `DispatchDeps` literal it returns:

```ts
// Alongside the existing cardsDispatch construction inside makeDeps():
  const requestsDispatch: RequestsDispatchDeps = {
    adminRequests: { list: vi.fn(async () => ({ rows: [], error: null })), patch: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })) },
    sessions,
  }
// And add `requestsDispatch` to the returned DispatchDeps object literal:
  const deps: DispatchDeps = { admins, sessions, content, adminContent, cardsDispatch, requestsDispatch }
```

(Add `import type { RequestsDispatchDeps } from './telegramRequestsDispatch'` alongside the existing `CardsDispatchDeps` import.)

Then append these tests:

```ts
describe('dispatch — requests delegation', () => {
  it('requests:list is reachable by a sales_manager and shows the filter menu', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, callbackData: 'requests:list' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Requests — filter by status:')
  })

  it('requests:list is blocked for a content_manager', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([MANAGER])
    const ctx = makeCtx({ fromId: 42, callbackData: 'requests:list' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('stub:requests no longer fires — the main menu now routes Requests to requests:list', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, text: '/start' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const requestsButton = (reply.keyboard.inline_keyboard as { text: string; callback_data?: string }[][])
      .flat()
      .find((b) => b.text === 'Requests')
    expect(requestsButton?.callback_data).toBe('requests:list')
  })
})
```

(This file already has a `SALES` manager fixture from Plan 2/3's own delegation tests — reuse it; do not redefine it.)

- [ ] **Step 8: Run the full test suite, typecheck**

Run: `npx vitest run api/_lib/telegramDispatch.test.ts api/_lib/telegramRequestsDispatch.test.ts api/_lib/adminRequestsHandler.test.ts`
Expected: PASS.

Run: `npm test`
Expected: full suite passes.

Run: `npx tsc -p tsconfig.api.json`
Expected: 0 errors.

Run: `npm run build`
Expected: succeeds.

Run: `npm run lint`
Expected: 0 errors (pre-existing warnings elsewhere unrelated).

- [ ] **Step 9: Commit**

```bash
git add api/_lib/adminRequestsHandler.ts api/_lib/telegramRequestsDispatch.ts api/_lib/telegramRequestsDispatch.test.ts \
        api/_lib/telegramDispatch.ts api/_lib/telegramDispatch.test.ts
git commit -m "feat(telegram-bot): Requests triage (filter, list, detail, status, note, delete)"
```

---

## Integration verification (live Telegram + live Supabase)

Not a subagent task — the controller runs this after both tasks are merged and pushed, against a real deployed preview, exactly like Plans 1-3's own live-verification steps.

1. Push the branch; confirm Vercel deployed it; re-register the webhook against that deployment's domain (append the `x-vercel-protection-bypass` query param if Deployment Protection is on for Preview). Confirm `TELEGRAM_*`/`ADMIN_SESSION_SECRET`/`SUPABASE_*` are all scoped to Preview.
2. As owner: `/start` → `Requests` → confirm the filter menu (All/New/In Progress/Done/Archived), then tap a filter and confirm the list matches what `/admin`'s Requests page shows for the same filter.
3. Open a request → confirm every read-only field (email, company, budget, interested-in, language, source page, received date, message, note) matches `/admin`'s own detail view for the same request.
4. Tap "Status: ..." → pick a different status → confirm "Saved.", the button now shows the new status, and `/admin`'s Requests page reflects the change immediately on reload.
5. Tap "Edit note" → send new note text → confirm "Saved." and the note is visible in `/admin`.
6. Tap "Delete" on a throwaway test request (submit one via the site's own Estimate form first if none exists) → "Yes, delete" → confirm it's gone from the bot's list, from `/admin`, AND directly query Supabase's `estimate_requests` table to confirm the row is actually gone, not just hidden.
7. From a `sales_manager` account (re-add via Administrators if needed): confirm it can do everything in steps 2-6. From a `content_manager` account: confirm `Requests` does not appear on `/start`'s menu at all, and a stale `requests:list` tap (if reachable) replies "You don't have access to this bot."
8. Spot-check Supabase directly to confirm the rows match exactly what was edited above.

**Once this checklist passes and the branch is merged:** every row of the spec's Goal §1 capability table (Content, Projects, Services, SEO, Requests, Administrators) is implemented. No further plans are needed for this feature unless the user requests new scope beyond the spec (e.g. card creation, Settings/Reset content via the bot — both explicitly out of scope per the spec).

---

## Self-review — spec coverage

- Spec §1 Requests row (list w/ filters; view card; status change; note edit; delete w/ confirmation; submitted fields read-only) → Tasks 1-2, fully implemented. Filter scope narrowed to status-only, explicitly documented above.
- Spec §1 role table (Requests: owner + sales_manager only) → enforced at the menu level (unchanged from Plan 1) and re-checked on every `requests:*` callback and the `requests_note_value` text step (Task 2), matching every earlier plan's "stale tap after a role change fails closed" discipline.
- Spec §2 "auth reuse, not reimplementation" → every read AND write goes through `handleAdminRequests`, signed via the same `adminCookieHeader` Plan 2 established and Plan 3 exported for reuse.
- Spec §5 menu structure, Requests branch → Task 1 (builders) + Task 2 (state machine) match the spec's bullet list (filter → list → detail → status/note/delete) exactly.
- Settings / Reset content → never in the bot, per spec §1 — untouched here, as in every prior plan.
- Card/request creation → out of scope (Requests are created only by the public Estimate form, never by an admin) — no task needed.

No placeholders remain — every test block in Task 1's Step 1 is a complete, runnable assertion.

### Deferred (not in this plan, and not planned for this feature at all)

- Language and free-text search filters for Requests via the bot — status-only filter is the deliberate v1 scope; add later only if requested.
- Card creation and Settings/Reset content remain deferred, as they were never in scope for the bot per the spec. WebP conversion is a different case: it WAS in the original spec's scope (spec §8), but Plan 3 deliberately superseded that requirement — sharp's native-binary risk on the serverless runtime outweighed the benefit, given Telegram's own JPEG compression already delivers an acceptable result. That supersession stands; it is not simply "out of scope."

### Notes for the executor

- This is the shortest plan in the series (2 tasks, no new read-only lookup module) because `handleAdminRequests`'s GET method already returns exactly what the bot needs — resist the urge to add a `telegramRequests.ts` reader module "for consistency" with Plans 2-3; it would be pure duplication of an endpoint that already does the job.
- `telegramRequestsDispatch.ts` follows `telegramCardsDispatch.ts`'s file-per-domain pattern from Plan 3 — if a future plan ever adds a new admin section to this bot, give it its own dispatch file too, for the same reason (keeping `telegramDispatch.ts` itself as a thin router, not a growing monolith).
- `buildCardSaveFailed`'s reuse across three unrelated domains (Content/SEO error saves in Plan 2 predate it; Cards in Plan 3; Requests here) is intentional — its name is a historical artifact of when it was first written, not a signal that it's Cards-specific. Do not rename it as part of this plan; that's an unrelated, unnecessary refactor.
