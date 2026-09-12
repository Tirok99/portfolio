# Telegram Bot Admin — Plan 1: Foundation & Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Telegram webhook end-to-end — role resolution (owner via env, manager via Supabase), dialog-state persistence, a role-filtered `/start` menu, and a fully working **Administrators** section (list/add/remove managers) — so the bot responds correctly in real Telegram before any content-editing feature is built.

**Architecture:** grammY's `Bot` is used as a typed Telegram Bot API client and `InlineKeyboard` builder, not as a full middleware framework — the actual conversation logic is a hand-rolled, framework-free state machine (`dispatch()`) that operates on a minimal `BotCtx` interface, so every branch is unit-testable with plain object literals and injected fakes, exactly like every other `api/_lib/*Handler.ts` in this repo. grammY's `Bot.handleUpdate()` (the documented manual-webhook entry point) feeds real Telegram `Update`s into a two-line adapter that converts a real grammY `Context` into a `BotCtx` and calls `dispatch()`. The `Bot` instance is built once per cold start and cached as a `Promise<Bot>` keyed by token (`bot.init()` is async — it calls `getMe` once — so the cache stores the in-flight promise itself, not just its resolved value, so two concurrent cold-start invocations can't race into building two bots). Tests drive a real `Bot` end-to-end without a real network call by passing grammY's own supported `client: { fetch }` override — never by mocking `node-fetch` (grammY's Node build resolves it from a copy nested inside `node_modules/grammy/node_modules/`, not the project's top-level one, so `vi.mock('node-fetch', ...)` silently fails to intercept it).

**Tech Stack:** grammY 1.46 (`grammy` npm package, plus its `grammy/types` subpath for the `Update` type), Supabase (`telegram_admins` + `telegram_sessions` tables, already migrated), Vercel Functions (existing `@vercel/node` + `api/_lib/*` conventions), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-telegram-bot-admin.md` — read it before starting; this plan implements Goal §1 (Administrators row + the role/permission table), Confirmed Decisions §2 (grammY, auth reuse, two-layer access control, Supabase-backed dialog state), Architecture §3, Data Model §4 (both tables — already migrated by the operator), and Menu Structure §5 (the `/start` menu and the Administrators branch; every other menu branch is an explicit stub in this plan).

## Global Constraints

- Server-only env vars, never `VITE_`-prefixed: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_IDS`, `TELEGRAM_WEBHOOK_SECRET` (already set in `.env.local` and Vercel Production by the operator).
- Every new `api/_lib/*.ts` module follows the existing injectable-`Deps`-interface pattern (see `api/_lib/adminRequestsHandler.ts` for the reference shape): a `Deps` interface, a `defaultXDeps` implementation built on `getSupabaseAdmin(env)`, and an exported orchestration function that takes `deps` as its last parameter with a default value — so every test injects `vi.fn()` fakes and never touches a real or fake `SupabaseClient`.
- `api/package.json` already pins `{"type":"commonjs"}` for the whole `api/` tree — never touch it, and never use a dynamic `await import()` inside `api/_lib/*` (a prior incident: it resolves fine under `tsx`/vitest locally but throws at runtime in Vercel's Node function environment, which enforces strict ESM specifier resolution for dynamic imports). Static imports only.
- Two tables already exist and are already migrated (`supabase/migration-2026-09-12-telegram-sessions.sql`, `supabase/migration-2026-09-12-telegram-admins.sql`) — this plan does not touch schema.
- `telegram_admins.role` is a Postgres `check` constraint accepting only `'content_manager'` or `'sales_manager'` — owners are never rows in this table (they live only in `TELEGRAM_ADMIN_IDS`), so this plan's TypeScript types must mirror that split (`Role = 'owner' | ManagerRole`, `ManagerRole = 'content_manager' | 'sales_manager'`).
- Test files are `*.test.ts` next to the file they test, run via `npx vitest run <path>`; they're excluded from the Vercel deploy by `.vercelignore` (already configured, don't touch).
- No live Telegram/Supabase calls from unit tests — every test in this plan injects fakes.

---

## File structure (this plan)

```
onvorx/
  api/
    _lib/
      types.ts                  # MODIFY: add TelegramEnv
      telegramAdmins.ts          # CREATE: role resolution + manager CRUD (Supabase-backed)
      telegramAdmins.test.ts     # CREATE
      telegramSessions.ts        # CREATE: dialog-state read/write (Supabase-backed)
      telegramSessions.test.ts   # CREATE
      telegramMenu.ts            # CREATE: pure text+keyboard builders, no I/O
      telegramMenu.test.ts       # CREATE
      telegramDispatch.ts        # CREATE: the state machine — the core of this plan
      telegramDispatch.test.ts   # CREATE
      telegramBot.ts             # CREATE: grammY wiring (Bot construction, Context adapter)
      telegramBot.test.ts        # CREATE (caching behavior only — no live network)
      telegramHandler.ts         # CREATE: HTTP-facing handler (secret check + dispatch)
      telegramHandler.test.ts    # CREATE
    telegram/
      webhook.ts                 # CREATE: thin Vercel route (mirrors api/admin/*.ts)
  scripts/
    telegram-set-webhook.mjs     # CREATE: one-off operator utility, calls setWebhook once
  package.json                   # MODIFY: add "grammy" dependency
```

### Interfaces produced by this plan

```ts
// api/_lib/types.ts — added
export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_ADMIN_IDS?: string
  TELEGRAM_WEBHOOK_SECRET?: string
}

// api/_lib/telegramAdmins.ts
export type ManagerRole = 'content_manager' | 'sales_manager'
export type Role = 'owner' | ManagerRole
export const MANAGER_ROLES: ManagerRole[]
export interface ManagerRecord {
  telegramId: number
  role: ManagerRole
  label: string | null
  addedBy: number
  createdAt: string
}
export interface TelegramAdminsDeps {
  findManager: (telegramId: number, env: TelegramEnv & SupabaseAdminEnv) => Promise<ManagerRecord | null>
  listManagers: (env: TelegramEnv & SupabaseAdminEnv) => Promise<ManagerRecord[]>
  addManager: (
    record: { telegramId: number; role: ManagerRole; label: string | null; addedBy: number },
    env: TelegramEnv & SupabaseAdminEnv,
  ) => Promise<{ error: string | null }>
  removeManager: (telegramId: number, env: TelegramEnv & SupabaseAdminEnv) => Promise<{ error: string | null }>
}
export const defaultTelegramAdminsDeps: TelegramAdminsDeps
export function parseOwnerIds(env: TelegramEnv): number[]
export function isOwner(telegramId: number, env: TelegramEnv): boolean
export function resolveRole(
  telegramId: number,
  env: TelegramEnv & SupabaseAdminEnv,
  deps?: TelegramAdminsDeps,
): Promise<Role | null>

// api/_lib/telegramSessions.ts
export interface TelegramState {
  screen: string
  data?: Record<string, unknown>
}
export const MAIN_MENU_STATE: TelegramState
export interface TelegramSessionsDeps {
  load: (chatId: number, env: SupabaseAdminEnv) => Promise<TelegramState>
  save: (chatId: number, state: TelegramState, env: SupabaseAdminEnv) => Promise<void>
}
export const defaultTelegramSessionsDeps: TelegramSessionsDeps

// api/_lib/telegramMenu.ts
export interface BotReply {
  text: string
  keyboard?: InlineKeyboard
}
export function buildMainMenu(role: Role): BotReply
export function buildStubReply(section: string): BotReply
export function buildNoAccessReply(): BotReply
export function buildAdminsList(managers: ManagerRecord[]): BotReply
export function buildAddIdPrompt(): BotReply
export function buildRolePrompt(): BotReply
export function buildLabelPrompt(): BotReply
export function buildRemoveConfirm(target: ManagerRecord): BotReply

// api/_lib/telegramDispatch.ts
export interface BotCtx {
  chatId: number
  fromId: number
  text?: string
  callbackData?: string
  reply: (r: BotReply) => Promise<void>
  answerCallback: () => Promise<void>
}
export interface DispatchDeps {
  admins: TelegramAdminsDeps
  sessions: TelegramSessionsDeps
}
export const defaultDispatchDeps: DispatchDeps
export function dispatch(
  ctx: BotCtx,
  env: TelegramEnv & SupabaseAdminEnv,
  deps?: DispatchDeps,
): Promise<void>

// api/_lib/telegramBot.ts
export function getBot(env: TelegramEnv & SupabaseAdminEnv, deps?: DispatchDeps, client?: ApiClientOptions): Promise<Bot>

// api/_lib/telegramHandler.ts
export function handleTelegramWebhook(
  input: { secretHeader: string | undefined; body: unknown },
  env: TelegramEnv & SupabaseAdminEnv,
  deps?: DispatchDeps,
): Promise<HandlerResult>
```

---

## Task 1: Role resolution — `api/_lib/telegramAdmins.ts`

**Files:**
- Modify: `api/_lib/types.ts`
- Create: `api/_lib/telegramAdmins.ts`
- Test: `api/_lib/telegramAdmins.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin(env: SupabaseAdminEnv)` from `api/_lib/supabaseAdmin.ts` (existing).
- Produces: `Role`, `ManagerRole`, `MANAGER_ROLES`, `ManagerRecord`, `TelegramAdminsDeps`, `defaultTelegramAdminsDeps`, `parseOwnerIds`, `isOwner`, `resolveRole` — all listed in full above. Every later task in this plan imports from here.

- [ ] **Step 1: Add the dependency**

```bash
npm install grammy@^1.46.0
```

- [ ] **Step 2: Add `TelegramEnv` to `api/_lib/types.ts`**

Append to the existing file (do not remove `AuthEnv`, `HandlerResult`, or `SupabaseAdminEnv`):

```ts
export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_ADMIN_IDS?: string
  TELEGRAM_WEBHOOK_SECRET?: string
}
```

- [ ] **Step 3: Write the failing test**

Create `api/_lib/telegramAdmins.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { parseOwnerIds, isOwner, resolveRole, MANAGER_ROLES } from './telegramAdmins'
import type { TelegramAdminsDeps, ManagerRecord } from './telegramAdmins'

const ENV = { TELEGRAM_ADMIN_IDS: '111,222 , 333' }

const MANAGER: ManagerRecord = {
  telegramId: 999,
  role: 'content_manager',
  label: 'Anna',
  addedBy: 111,
  createdAt: '2026-01-01T00:00:00Z',
}

const deps = (): TelegramAdminsDeps => ({
  findManager: vi.fn().mockResolvedValue(null),
  listManagers: vi.fn().mockResolvedValue([]),
  addManager: vi.fn().mockResolvedValue({ error: null }),
  removeManager: vi.fn().mockResolvedValue({ error: null }),
})

describe('parseOwnerIds', () => {
  it('splits, trims, and converts to numbers', () => {
    expect(parseOwnerIds(ENV)).toEqual([111, 222, 333])
  })
  it('returns [] when unset', () => {
    expect(parseOwnerIds({})).toEqual([])
  })
  it('drops non-numeric or non-positive junk', () => {
    expect(parseOwnerIds({ TELEGRAM_ADMIN_IDS: '111,abc,-5,0,222' })).toEqual([111, 222])
  })
})

describe('isOwner', () => {
  it('true for a listed id', () => {
    expect(isOwner(222, ENV)).toBe(true)
  })
  it('false for an unlisted id', () => {
    expect(isOwner(999, ENV)).toBe(false)
  })
})

describe('resolveRole', () => {
  it('owner ids resolve to "owner" without touching the DB', async () => {
    const d = deps()
    expect(await resolveRole(111, ENV, d)).toBe('owner')
    expect(d.findManager).not.toHaveBeenCalled()
  })
  it('a manager row resolves to its role', async () => {
    const d = deps()
    d.findManager = vi.fn().mockResolvedValue(MANAGER)
    expect(await resolveRole(999, ENV, d)).toBe('content_manager')
  })
  it('an unknown id resolves to null', async () => {
    expect(await resolveRole(555, ENV, deps())).toBeNull()
  })
})

describe('MANAGER_ROLES', () => {
  it('is exactly the two DB-allowed roles', () => {
    expect(MANAGER_ROLES).toEqual(['content_manager', 'sales_manager'])
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run api/_lib/telegramAdmins.test.ts`
Expected: FAIL — `Cannot find module './telegramAdmins'`.

- [ ] **Step 5: Implement `api/_lib/telegramAdmins.ts`**

```ts
import type { SupabaseAdminEnv, TelegramEnv } from './types'
import { getSupabaseAdmin } from './supabaseAdmin'

export type ManagerRole = 'content_manager' | 'sales_manager'
export type Role = 'owner' | ManagerRole
export const MANAGER_ROLES: ManagerRole[] = ['content_manager', 'sales_manager']

export interface ManagerRecord {
  telegramId: number
  role: ManagerRole
  label: string | null
  addedBy: number
  createdAt: string
}

type Env = TelegramEnv & SupabaseAdminEnv

export interface TelegramAdminsDeps {
  findManager: (telegramId: number, env: Env) => Promise<ManagerRecord | null>
  listManagers: (env: Env) => Promise<ManagerRecord[]>
  addManager: (
    record: { telegramId: number; role: ManagerRole; label: string | null; addedBy: number },
    env: Env,
  ) => Promise<{ error: string | null }>
  removeManager: (telegramId: number, env: Env) => Promise<{ error: string | null }>
}

const fromRow = (row: Record<string, unknown>): ManagerRecord => ({
  telegramId: Number(row.telegram_id),
  role: row.role as ManagerRole,
  label: (row.label as string | null) ?? null,
  addedBy: Number(row.added_by),
  createdAt: String(row.created_at),
})

export const defaultTelegramAdminsDeps: TelegramAdminsDeps = {
  findManager: async (telegramId, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return null
    const { data, error } = await c
      .from('telegram_admins')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle()
    if (error || !data) return null
    return fromRow(data)
  },
  listManagers: async (env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return []
    const { data, error } = await c
      .from('telegram_admins')
      .select('*')
      .order('created_at', { ascending: true })
    if (error || !data) return []
    return data.map(fromRow)
  },
  addManager: async (record, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from('telegram_admins').insert({
      telegram_id: record.telegramId,
      role: record.role,
      label: record.label,
      added_by: record.addedBy,
    })
    return { error: error ? error.message : null }
  },
  removeManager: async (telegramId, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from('telegram_admins').delete().eq('telegram_id', telegramId)
    return { error: error ? error.message : null }
  },
}

/** Owners are a hardcoded env-var whitelist, never rows in a table — see
 * spec §1 "Роли и доступ": this guarantees a bug in manager-management code
 * can never demote or delete the site owner. */
export function parseOwnerIds(env: TelegramEnv): number[] {
  return (env.TELEGRAM_ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
}

export function isOwner(telegramId: number, env: TelegramEnv): boolean {
  return parseOwnerIds(env).includes(telegramId)
}

export async function resolveRole(
  telegramId: number,
  env: Env,
  deps: TelegramAdminsDeps = defaultTelegramAdminsDeps,
): Promise<Role | null> {
  if (isOwner(telegramId, env)) return 'owner'
  const manager = await deps.findManager(telegramId, env)
  return manager ? manager.role : null
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run api/_lib/telegramAdmins.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json api/_lib/types.ts api/_lib/telegramAdmins.ts api/_lib/telegramAdmins.test.ts
git commit -m "feat(telegram-bot): role resolution — owner (env) + manager (Supabase)"
```

---

## Task 2: Dialog-state persistence — `api/_lib/telegramSessions.ts`

**Files:**
- Create: `api/_lib/telegramSessions.ts`
- Test: `api/_lib/telegramSessions.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` (existing), `SupabaseAdminEnv` (existing).
- Produces: `TelegramState`, `MAIN_MENU_STATE`, `TelegramSessionsDeps`, `defaultTelegramSessionsDeps` — consumed by Task 4 (`telegramDispatch.ts`).

- [ ] **Step 1: Write the failing test**

Create `api/_lib/telegramSessions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MAIN_MENU_STATE } from './telegramSessions'

describe('MAIN_MENU_STATE', () => {
  it('is the main_menu screen with no extra data', () => {
    expect(MAIN_MENU_STATE).toEqual({ screen: 'main_menu' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/telegramSessions.test.ts`
Expected: FAIL — `Cannot find module './telegramSessions'`.

- [ ] **Step 3: Implement `api/_lib/telegramSessions.ts`**

```ts
import type { SupabaseAdminEnv } from './types'
import { getSupabaseAdmin } from './supabaseAdmin'

export interface TelegramState {
  screen: string
  data?: Record<string, unknown>
}

export const MAIN_MENU_STATE: TelegramState = { screen: 'main_menu' }

export interface TelegramSessionsDeps {
  load: (chatId: number, env: SupabaseAdminEnv) => Promise<TelegramState>
  save: (chatId: number, state: TelegramState, env: SupabaseAdminEnv) => Promise<void>
}

const isState = (v: unknown): v is TelegramState =>
  typeof v === 'object' && v !== null && typeof (v as { screen?: unknown }).screen === 'string'

export const defaultTelegramSessionsDeps: TelegramSessionsDeps = {
  load: async (chatId, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return MAIN_MENU_STATE
    const { data, error } = await c
      .from('telegram_sessions')
      .select('state')
      .eq('chat_id', chatId)
      .maybeSingle()
    if (error || !data || !isState(data.state)) return MAIN_MENU_STATE
    return data.state
  },
  save: async (chatId, state, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return
    await c.from('telegram_sessions').upsert({ chat_id: chatId, state })
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/telegramSessions.test.ts`
Expected: PASS (1 test — the rest of this module is a thin Supabase pass-through exercised indirectly through `telegramDispatch.test.ts` in Task 4 via injected fakes, matching how `adminRequestsHandler.test.ts` never touches `defaultTelegramAdminsDeps`'s Supabase-backed implementation directly either).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/telegramSessions.ts api/_lib/telegramSessions.test.ts
git commit -m "feat(telegram-bot): Supabase-backed dialog-state read/write"
```

---

## Task 3: Pure menu builders — `api/_lib/telegramMenu.ts`

**Files:**
- Create: `api/_lib/telegramMenu.ts`
- Test: `api/_lib/telegramMenu.test.ts`

**Interfaces:**
- Consumes: `Role`, `ManagerRole`, `ManagerRecord` from `api/_lib/telegramAdmins.ts` (Task 1); `InlineKeyboard` from `grammy`.
- Produces: `BotReply` and every `buildX` function listed in the Interfaces section above — consumed by Task 4 (`telegramDispatch.ts`).

No I/O in this file at all — every function is a pure `(...) => BotReply`. This is deliberately the easiest task to review: given an input, assert the exact text and the exact button labels/callback data.

- [ ] **Step 1: Write the failing test**

Create `api/_lib/telegramMenu.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  buildMainMenu,
  buildStubReply,
  buildNoAccessReply,
  buildAdminsList,
  buildAddIdPrompt,
  buildRolePrompt,
  buildLabelPrompt,
  buildRemoveConfirm,
} from './telegramMenu'
import type { ManagerRecord } from './telegramAdmins'

const readButtons = (reply: ReturnType<typeof buildMainMenu>) =>
  reply.keyboard!.inline_keyboard.flat().map((b) => ({ text: b.text, data: (b as { callback_data?: string }).callback_data }))

const MANAGER: ManagerRecord = {
  telegramId: 42,
  role: 'content_manager',
  label: 'Anna',
  addedBy: 111,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('buildMainMenu', () => {
  it('owner sees all six sections', () => {
    const buttons = readButtons(buildMainMenu('owner'))
    expect(buttons.map((b) => b.text)).toEqual([
      'Content', 'Projects', 'Services', 'SEO', 'Requests', 'Administrators',
    ])
    expect(buttons.find((b) => b.text === 'Administrators')?.data).toBe('menu:admins')
    expect(buttons.find((b) => b.text === 'Content')?.data).toBe('stub:content')
  })
  it('content_manager sees only content sections, no Administrators', () => {
    const buttons = readButtons(buildMainMenu('content_manager'))
    expect(buttons.map((b) => b.text)).toEqual(['Content', 'Projects', 'Services', 'SEO'])
  })
  it('sales_manager sees only Requests', () => {
    const buttons = readButtons(buildMainMenu('sales_manager'))
    expect(buttons.map((b) => b.text)).toEqual(['Requests'])
  })
})

describe('buildStubReply', () => {
  it('names the section', () => {
    expect(buildStubReply('Content').text).toContain('Content')
  })
})

describe('buildNoAccessReply', () => {
  it('has no keyboard', () => {
    expect(buildNoAccessReply().keyboard).toBeUndefined()
  })
})

describe('buildAdminsList', () => {
  it('empty list still offers Add manager', () => {
    const r = buildAdminsList([])
    expect(readButtons(r).map((b) => b.text)).toEqual(['➕ Add manager'])
  })
  it('lists each manager with a remove button, then Add manager', () => {
    const r = buildAdminsList([MANAGER])
    expect(r.text).toContain('Anna')
    expect(r.text).toContain('Content manager')
    const buttons = readButtons(r)
    expect(buttons[0]).toEqual({ text: '🗑 Remove Anna', data: 'admins:remove:42' })
    expect(buttons[1].text).toBe('➕ Add manager')
  })
})

describe('add-manager prompts', () => {
  it('buildAddIdPrompt has no keyboard', () => {
    expect(buildAddIdPrompt().keyboard).toBeUndefined()
  })
  it('buildRolePrompt offers both roles', () => {
    const buttons = readButtons(buildRolePrompt())
    expect(buttons).toEqual([
      { text: 'Content manager', data: 'admins:add:role:content_manager' },
      { text: 'Sales manager', data: 'admins:add:role:sales_manager' },
    ])
  })
  it('buildLabelPrompt offers Skip', () => {
    expect(readButtons(buildLabelPrompt())).toEqual([{ text: 'Skip', data: 'admins:add:skip_label' }])
  })
})

describe('buildRemoveConfirm', () => {
  it('names the target and offers Yes/Cancel', () => {
    const r = buildRemoveConfirm(MANAGER)
    expect(r.text).toContain('Anna')
    expect(readButtons(r)).toEqual([
      { text: 'Yes, remove', data: 'admins:remove:confirm:42' },
      { text: 'Cancel', data: 'admins:remove:cancel' },
    ])
  })
  it('falls back to the numeric id when there is no label', () => {
    const noLabel = { ...MANAGER, label: null }
    expect(buildRemoveConfirm(noLabel).text).toContain('42')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/telegramMenu.test.ts`
Expected: FAIL — `Cannot find module './telegramMenu'`.

- [ ] **Step 3: Implement `api/_lib/telegramMenu.ts`**

```ts
import { InlineKeyboard } from 'grammy'
import type { ManagerRecord, ManagerRole, Role } from './telegramAdmins'

export interface BotReply {
  text: string
  keyboard?: InlineKeyboard
}

const MENU_ITEMS: { key: string; label: string; roles: Role[] }[] = [
  { key: 'content', label: 'Content', roles: ['owner', 'content_manager'] },
  { key: 'projects', label: 'Projects', roles: ['owner', 'content_manager'] },
  { key: 'services', label: 'Services', roles: ['owner', 'content_manager'] },
  { key: 'seo', label: 'SEO', roles: ['owner', 'content_manager'] },
  { key: 'requests', label: 'Requests', roles: ['owner', 'sales_manager'] },
  { key: 'admins', label: 'Administrators', roles: ['owner'] },
]

export function buildMainMenu(role: Role): BotReply {
  const items = MENU_ITEMS.filter((m) => m.roles.includes(role))
  const kb = new InlineKeyboard()
  items.forEach((m, i) => {
    kb.text(m.label, m.key === 'admins' ? 'menu:admins' : `stub:${m.key}`)
    if (i < items.length - 1) kb.row()
  })
  return { text: 'ONVORX admin — choose a section:', keyboard: kb }
}

export function buildStubReply(section: string): BotReply {
  return { text: `${section} management is coming in a later update.` }
}

export function buildNoAccessReply(): BotReply {
  return { text: "You don't have access to this bot." }
}

const ROLE_LABEL: Record<ManagerRole, string> = {
  content_manager: 'Content manager',
  sales_manager: 'Sales manager',
}

export function buildAdminsList(managers: ManagerRecord[]): BotReply {
  const kb = new InlineKeyboard()
  managers.forEach((m) => {
    kb.text(`🗑 Remove ${m.label ?? m.telegramId}`, `admins:remove:${m.telegramId}`).row()
  })
  kb.text('➕ Add manager', 'admins:add')
  if (managers.length === 0) return { text: 'No managers yet.', keyboard: kb }
  const lines = managers.map((m) => `• ${m.label ?? m.telegramId} — ${ROLE_LABEL[m.role]} (id ${m.telegramId})`)
  return { text: `Managers:\n${lines.join('\n')}`, keyboard: kb }
}

export function buildAddIdPrompt(): BotReply {
  return { text: 'Send the Telegram ID of the person to add.' }
}

export function buildRolePrompt(): BotReply {
  const kb = new InlineKeyboard()
    .text('Content manager', 'admins:add:role:content_manager')
    .row()
    .text('Sales manager', 'admins:add:role:sales_manager')
  return { text: 'Choose a role:', keyboard: kb }
}

export function buildLabelPrompt(): BotReply {
  const kb = new InlineKeyboard().text('Skip', 'admins:add:skip_label')
  return { text: 'Optional: send a name/label for this person, or tap Skip.', keyboard: kb }
}

export function buildRemoveConfirm(target: ManagerRecord): BotReply {
  const kb = new InlineKeyboard()
    .text('Yes, remove', `admins:remove:confirm:${target.telegramId}`)
    .row()
    .text('Cancel', 'admins:remove:cancel')
  return {
    text: `Remove ${target.label ?? target.telegramId} (${ROLE_LABEL[target.role]})?`,
    keyboard: kb,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/telegramMenu.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/telegramMenu.ts api/_lib/telegramMenu.test.ts
git commit -m "feat(telegram-bot): pure menu/prompt builders (main menu + Administrators)"
```

---

## Task 4: The state machine — `api/_lib/telegramDispatch.ts`

This is the core deliverable of Plan 1: given an incoming message or button tap, decide the role, advance dialog state, and produce the right reply.

**Files:**
- Create: `api/_lib/telegramDispatch.ts`
- Test: `api/_lib/telegramDispatch.test.ts`

**Interfaces:**
- Consumes: everything from Task 1 (`telegramAdmins.ts`), Task 2 (`telegramSessions.ts`), Task 3 (`telegramMenu.ts`).
- Produces: `BotCtx`, `DispatchDeps`, `defaultDispatchDeps`, `dispatch` — consumed by Task 5 (`telegramBot.ts`).

- [ ] **Step 1: Write the failing test**

Create `api/_lib/telegramDispatch.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { dispatch } from './telegramDispatch'
import type { BotCtx, DispatchDeps } from './telegramDispatch'
import type { TelegramAdminsDeps, ManagerRecord } from './telegramAdmins'
import type { TelegramSessionsDeps, TelegramState } from './telegramSessions'

const ENV = { TELEGRAM_ADMIN_IDS: '111' }
const OWNER_ID = 111
const MANAGER: ManagerRecord = {
  telegramId: 42, role: 'content_manager', label: 'Anna', addedBy: OWNER_ID, createdAt: '2026-01-01T00:00:00Z',
}

function makeDeps(initialState: TelegramState = { screen: 'main_menu' }) {
  let state = initialState
  let managers: ManagerRecord[] = []
  const admins: TelegramAdminsDeps = {
    findManager: vi.fn(async (id: number) => managers.find((m) => m.telegramId === id) ?? null),
    listManagers: vi.fn(async () => managers),
    addManager: vi.fn(async (record) => {
      managers = [...managers, { ...record, createdAt: '2026-01-01T00:00:00Z' }]
      return { error: null }
    }),
    removeManager: vi.fn(async (id: number) => {
      managers = managers.filter((m) => m.telegramId !== id)
      return { error: null }
    }),
  }
  const sessions: TelegramSessionsDeps = {
    load: vi.fn(async () => state),
    save: vi.fn(async (_chatId, next) => {
      state = next
    }),
  }
  const deps: DispatchDeps = { admins, sessions }
  return { deps, admins, sessions, getState: () => state, getManagers: () => managers, setManagers: (m: ManagerRecord[]) => (managers = m) }
}

function makeCtx(overrides: Partial<BotCtx>): BotCtx {
  return {
    chatId: 1,
    fromId: OWNER_ID,
    reply: vi.fn(async () => {}),
    answerCallback: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('dispatch — access control', () => {
  it('an unknown id gets "no access" and nothing else happens', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ fromId: 999, text: '/start' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })
})

describe('dispatch — /start', () => {
  it('owner gets the full menu and state resets to main_menu', async () => {
    const { deps, sessions } = makeDeps()
    const ctx = makeCtx({ text: '/start' })
    await dispatch(ctx, ENV, deps)
    expect(sessions.save).toHaveBeenCalledWith(1, { screen: 'main_menu' }, ENV)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('ONVORX admin — choose a section:')
  })
})

describe('dispatch — stub sections', () => {
  it('stub:content replies with a coming-soon message for anyone with access', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'stub:content' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.answerCallback).toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'content management is coming in a later update.' })
  })
})

describe('dispatch — Administrators, owner-only', () => {
  it('a manager cannot open menu:admins', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([MANAGER])
    const ctx = makeCtx({ fromId: 42, callbackData: 'menu:admins' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('owner opens menu:admins and sees the (empty) list', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'menu:admins' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('No managers yet.')
  })

  it('full add-manager flow: id -> role -> label -> added', async () => {
    const { deps, getManagers } = makeDeps()

    await dispatch(makeCtx({ callbackData: 'admins:add' }), ENV, deps)
    await dispatch(makeCtx({ text: '42' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'admins:add:role:content_manager' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'Anna' })
    await dispatch(finalCtx, ENV, deps)

    expect(getManagers()).toEqual([
      { telegramId: 42, role: 'content_manager', label: 'Anna', addedBy: OWNER_ID, createdAt: '2026-01-01T00:00:00Z' },
    ])
    const lastReply = (finalCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(lastReply.text).toContain('Anna')
  })

  it('add-manager flow: Skip label adds with a null label', async () => {
    const { deps, getManagers } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'admins:add' }), ENV, deps)
    await dispatch(makeCtx({ text: '77' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'admins:add:role:sales_manager' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'admins:add:skip_label' }), ENV, deps)
    expect(getManagers()).toEqual([
      { telegramId: 77, role: 'sales_manager', label: null, addedBy: OWNER_ID, createdAt: '2026-01-01T00:00:00Z' },
    ])
  })

  it('rejects a non-numeric id and stays on the same step', async () => {
    const { deps, getState } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'admins:add' }), ENV, deps)
    const ctx = makeCtx({ text: 'not-a-number' })
    await dispatch(ctx, ENV, deps)
    expect(getState().screen).toBe('admins_add_id')
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('valid Telegram ID') }),
    )
  })

  it('remove flow: tap remove -> confirm -> gone', async () => {
    const { deps, setManagers, getManagers } = makeDeps()
    setManagers([MANAGER])
    await dispatch(makeCtx({ callbackData: 'admins:remove:42' }), ENV, deps)
    const confirmCtx = makeCtx({ callbackData: 'admins:remove:confirm:42' })
    await dispatch(confirmCtx, ENV, deps)
    expect(getManagers()).toEqual([])
    const reply = (confirmCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('No managers yet.')
  })

  it('remove flow: cancel keeps the manager', async () => {
    const { deps, setManagers, getManagers } = makeDeps()
    setManagers([MANAGER])
    await dispatch(makeCtx({ callbackData: 'admins:remove:42' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'admins:remove:cancel' }), ENV, deps)
    expect(getManagers()).toEqual([MANAGER])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/telegramDispatch.test.ts`
Expected: FAIL — `Cannot find module './telegramDispatch'`.

- [ ] **Step 3: Implement `api/_lib/telegramDispatch.ts`**

```ts
import type { SupabaseAdminEnv, TelegramEnv } from './types'
import {
  resolveRole,
  defaultTelegramAdminsDeps,
  MANAGER_ROLES,
  type TelegramAdminsDeps,
  type ManagerRole,
  type Role,
} from './telegramAdmins'
import {
  defaultTelegramSessionsDeps,
  MAIN_MENU_STATE,
  type TelegramSessionsDeps,
} from './telegramSessions'
import * as menu from './telegramMenu'

export interface BotCtx {
  chatId: number
  fromId: number
  text?: string
  callbackData?: string
  reply: (r: menu.BotReply) => Promise<void>
  answerCallback: () => Promise<void>
}

export interface DispatchDeps {
  admins: TelegramAdminsDeps
  sessions: TelegramSessionsDeps
}

export const defaultDispatchDeps: DispatchDeps = {
  admins: defaultTelegramAdminsDeps,
  sessions: defaultTelegramSessionsDeps,
}

type Env = TelegramEnv & SupabaseAdminEnv

export async function dispatch(
  ctx: BotCtx,
  env: Env,
  deps: DispatchDeps = defaultDispatchDeps,
): Promise<void> {
  const role = await resolveRole(ctx.fromId, env, deps.admins)
  if (!role) {
    await ctx.reply(menu.buildNoAccessReply())
    return
  }

  if (ctx.callbackData) {
    await ctx.answerCallback()
    await handleCallback(ctx, ctx.callbackData, role, env, deps)
    return
  }

  if (ctx.text === '/start') {
    await deps.sessions.save(ctx.chatId, MAIN_MENU_STATE, env)
    await ctx.reply(menu.buildMainMenu(role))
    return
  }

  if (typeof ctx.text === 'string') {
    await handleText(ctx, ctx.text, role, env, deps)
  }
}

async function showAdminsList(ctx: BotCtx, env: Env, deps: DispatchDeps): Promise<void> {
  const managers = await deps.admins.listManagers(env)
  await deps.sessions.save(ctx.chatId, { screen: 'admins_list' }, env)
  await ctx.reply(menu.buildAdminsList(managers))
}

async function handleCallback(
  ctx: BotCtx,
  data: string,
  role: Role,
  env: Env,
  deps: DispatchDeps,
): Promise<void> {
  if (data === 'menu:main') {
    await deps.sessions.save(ctx.chatId, MAIN_MENU_STATE, env)
    await ctx.reply(menu.buildMainMenu(role))
    return
  }

  if (data.startsWith('stub:')) {
    const section = data.slice('stub:'.length)
    await ctx.reply(menu.buildStubReply(section))
    return
  }

  // Everything below is owner-only (Administrators).
  if (role !== 'owner') {
    await ctx.reply(menu.buildNoAccessReply())
    return
  }

  if (data === 'menu:admins') {
    await showAdminsList(ctx, env, deps)
    return
  }

  if (data === 'admins:add') {
    await deps.sessions.save(ctx.chatId, { screen: 'admins_add_id' }, env)
    await ctx.reply(menu.buildAddIdPrompt())
    return
  }

  if (data.startsWith('admins:add:role:')) {
    const roleChoice = data.slice('admins:add:role:'.length) as ManagerRole
    const state = await deps.sessions.load(ctx.chatId, env)
    const telegramId = Number(state.data?.telegramId)
    await deps.sessions.save(
      ctx.chatId,
      { screen: 'admins_add_label', data: { telegramId, role: roleChoice } },
      env,
    )
    await ctx.reply(menu.buildLabelPrompt())
    return
  }

  if (data === 'admins:add:skip_label') {
    await finishAddManager(ctx, env, deps, null)
    return
  }

  if (data === 'admins:remove:cancel') {
    await showAdminsList(ctx, env, deps)
    return
  }

  if (data.startsWith('admins:remove:confirm:')) {
    const telegramId = Number(data.slice('admins:remove:confirm:'.length))
    await deps.admins.removeManager(telegramId, env)
    await showAdminsList(ctx, env, deps)
    return
  }

  if (data.startsWith('admins:remove:')) {
    const telegramId = Number(data.slice('admins:remove:'.length))
    const managers = await deps.admins.listManagers(env)
    const target = managers.find((m) => m.telegramId === telegramId)
    if (!target) {
      await showAdminsList(ctx, env, deps)
      return
    }
    await ctx.reply(menu.buildRemoveConfirm(target))
  }
}

async function handleText(
  ctx: BotCtx,
  text: string,
  role: Role,
  env: Env,
  deps: DispatchDeps,
): Promise<void> {
  if (role !== 'owner') return
  const state = await deps.sessions.load(ctx.chatId, env)

  if (state.screen === 'admins_add_id') {
    const telegramId = Number(text)
    if (!Number.isInteger(telegramId) || telegramId <= 0) {
      await ctx.reply({ text: 'That does not look like a valid Telegram ID. Try again, or /start to cancel.' })
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'admins_add_role', data: { telegramId } }, env)
    await ctx.reply(menu.buildRolePrompt())
    return
  }

  if (state.screen === 'admins_add_label') {
    await finishAddManager(ctx, env, deps, text)
  }
}

async function finishAddManager(
  ctx: BotCtx,
  env: Env,
  deps: DispatchDeps,
  label: string | null,
): Promise<void> {
  const state = await deps.sessions.load(ctx.chatId, env)
  const telegramId = Number(state.data?.telegramId)
  const role = state.data?.role as ManagerRole
  if (!MANAGER_ROLES.includes(role)) {
    await ctx.reply({ text: 'Something went wrong — /start to try again.' })
    return
  }
  await deps.admins.addManager({ telegramId, role, label, addedBy: ctx.fromId }, env)
  await showAdminsList(ctx, env, deps)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/telegramDispatch.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/telegramDispatch.ts api/_lib/telegramDispatch.test.ts
git commit -m "feat(telegram-bot): dispatch state machine (menu + Administrators flow)"
```

---

## Task 5: grammY wiring — `api/_lib/telegramBot.ts`

**Files:**
- Create: `api/_lib/telegramBot.ts`
- Test: `api/_lib/telegramBot.test.ts`

**Interfaces:**
- Consumes: `dispatch`, `BotCtx`, `DispatchDeps`, `defaultDispatchDeps` from Task 4; `BotReply` from Task 3; `Bot`, `ApiClientOptions`, `Context` from `grammy`.
- Produces: `getBot(env, deps?, client?): Promise<Bot>` — consumed by Task 6 (`telegramHandler.ts`).

This is the only file in the plan that touches the real grammY `Bot` class. It is deliberately thin: adapt a real `Context` into the `BotCtx` shape Task 4 already tested exhaustively, then call `dispatch`. `getBot` is async because `bot.init()` calls `getMe` once per cold start — the cache stores the **in-flight promise**, not just its resolved value, so two concurrent invocations during a cold start can't race into building two separate bots (the second caller just awaits the first one's promise).

The optional third parameter, `client`, is a pure test seam (grammY's own `ApiClientOptions`, which includes a `fetch` override) — production code never passes it. Do **not** reach for `vi.mock('node-fetch', ...)` to fake the network in tests: grammY's Node build resolves `node-fetch` from a copy nested inside `node_modules/grammy/node_modules/`, not the project's top-level one, so that mock silently never intercepts the call and the test makes a real request to `api.telegram.org`.

- [ ] **Step 1: Write the failing test**

Create `api/_lib/telegramBot.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { getBot } from './telegramBot'
import type { DispatchDeps } from './telegramDispatch'

const FAKE_ME = {
  id: 1,
  is_bot: true,
  first_name: 'ONVORX Admin',
  username: 'onvorx_admin_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
}

function fakeFetch(calls: string[]) {
  return vi.fn(async (url: unknown) => {
    const u = String(url)
    calls.push(u)
    if (u.includes('getMe')) return { json: async () => ({ ok: true, result: FAKE_ME }) } as Response
    return { json: async () => ({ ok: true, result: true }) } as Response
  })
}

describe('getBot', () => {
  it('caches the instance per token — concurrent calls only trigger one getMe', async () => {
    const calls: string[] = []
    const env = { TELEGRAM_BOT_TOKEN: '111:aaa' }
    const client = { fetch: fakeFetch(calls) as unknown as typeof fetch }
    const [a, b] = await Promise.all([getBot(env, undefined, client), getBot(env, undefined, client)])
    expect(a).toBe(b)
    expect(calls.filter((u) => u.includes('getMe'))).toHaveLength(1)
  })

  it('builds a new instance when the token changes', async () => {
    const calls: string[] = []
    const client = { fetch: fakeFetch(calls) as unknown as typeof fetch }
    const a = await getBot({ TELEGRAM_BOT_TOKEN: '111:aaa' }, undefined, client)
    const b = await getBot({ TELEGRAM_BOT_TOKEN: '222:bbb' }, undefined, client)
    expect(a).not.toBe(b)
  })

  it('a real Update flows through bot.handleUpdate to a real ctx.reply, network faked via client.fetch', async () => {
    const calls: string[] = []
    const deps: DispatchDeps = {
      admins: {
        findManager: vi.fn().mockResolvedValue(null),
        listManagers: vi.fn().mockResolvedValue([]),
        addManager: vi.fn().mockResolvedValue({ error: null }),
        removeManager: vi.fn().mockResolvedValue({ error: null }),
      },
      sessions: {
        load: vi.fn().mockResolvedValue({ screen: 'main_menu' }),
        save: vi.fn().mockResolvedValue(undefined),
      },
    }
    const bot = await getBot(
      { TELEGRAM_BOT_TOKEN: '444:ddd', TELEGRAM_ADMIN_IDS: '111' },
      deps,
      { fetch: fakeFetch(calls) as unknown as typeof fetch },
    )
    const update = {
      update_id: 1,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: 1, type: 'private' as const, first_name: 'Owner' },
        from: { id: 111, is_bot: false, first_name: 'Owner' },
        text: '/start',
      },
    }
    await bot.handleUpdate(update)
    expect(deps.sessions.save).toHaveBeenCalledWith(1, { screen: 'main_menu' }, expect.anything())
    expect(calls.some((u) => u.includes('sendMessage'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/telegramBot.test.ts`
Expected: FAIL — `Cannot find module './telegramBot'`.

- [ ] **Step 3: Implement `api/_lib/telegramBot.ts`**

```ts
import { Bot, InlineKeyboard, type ApiClientOptions, type Context } from 'grammy'
import type { SupabaseAdminEnv, TelegramEnv } from './types'
import { dispatch, defaultDispatchDeps, type BotCtx, type DispatchDeps } from './telegramDispatch'
import type { BotReply } from './telegramMenu'

type Env = TelegramEnv & SupabaseAdminEnv

let cached: { token: string; botPromise: Promise<Bot> } | null = null

function toBotCtx(ctx: Context): BotCtx | null {
  const chatId = ctx.chatId
  const fromId = ctx.from?.id
  if (chatId == null || fromId == null) return null
  return {
    chatId,
    fromId,
    text: ctx.message?.text,
    callbackData: ctx.callbackQuery?.data,
    reply: async (r: BotReply) => {
      await ctx.reply(r.text, r.keyboard ? { reply_markup: r.keyboard as InlineKeyboard } : undefined)
    },
    answerCallback: async () => {
      await ctx.answerCallbackQuery()
    },
  }
}

function registerHandlers(bot: Bot, env: Env, deps: DispatchDeps): void {
  bot.on(['message:text', 'callback_query:data'], async (ctx) => {
    const botCtx = toBotCtx(ctx)
    if (botCtx) await dispatch(botCtx, env, deps)
  })
}

/**
 * `client` is a test-only seam: passing a fake `fetch` lets a test drive a
 * real `Bot` (real `getMe`, real Update parsing, real `ctx.reply`) without
 * making a real network call. Production code never passes it.
 */
export function getBot(
  env: Env,
  deps: DispatchDeps = defaultDispatchDeps,
  client?: ApiClientOptions,
): Promise<Bot> {
  const token = env.TELEGRAM_BOT_TOKEN ?? ''
  if (cached && cached.token === token) return cached.botPromise
  const botPromise = (async () => {
    const bot = new Bot(token, { client })
    registerHandlers(bot, env, deps)
    await bot.init()
    return bot
  })()
  cached = { token, botPromise }
  return botPromise
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/telegramBot.test.ts`
Expected: PASS (3 tests — no real network call in any of them; verify with `npx tsc -p tsconfig.api.json --noEmit`, which must also report 0 errors here, since `UserFromGetMe`-shaped literals are easy to get subtly wrong across grammY versions).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/telegramBot.ts api/_lib/telegramBot.test.ts
git commit -m "feat(telegram-bot): grammY wiring — Context adapter, cached async getBot"
```

---

## Task 6: HTTP handler + webhook route

**Files:**
- Create: `api/_lib/telegramHandler.ts`
- Test: `api/_lib/telegramHandler.test.ts`
- Create: `api/telegram/webhook.ts`

**Interfaces:**
- Consumes: `getBot` from Task 5; `HandlerResult` from `api/_lib/types.ts`; `send` from `api/_lib/vercel-adapter.ts` (existing).
- Produces: `handleTelegramWebhook` (HTTP-facing entry point) and the deployed route `POST /api/telegram/webhook`.

grammY's own end-to-end behavior (real Update parsing, real `ctx.reply`) is already exhaustively proven in Task 5. This file's own job is narrower: the secret-header gate, and — a real robustness requirement, not just a testing convenience — never letting a failure inside `bot.handleUpdate` (a bad reply, a Supabase hiccup, anything) escape as an uncaught exception. Telegram retries a webhook aggressively on any non-2xx response; if our own downstream logic throws, we still want to ack 200 and let the failure show up in server logs, not trigger a retry storm for something retrying can't fix. Because of that, this test file mocks the (already-tested) `telegramBot.ts` module instead of exercising a real `Bot` — it needs full control over exactly when `handleUpdate` throws.

- [ ] **Step 1: Write the failing test**

Create `api/_lib/telegramHandler.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// telegramBot.ts's real grammY integration is exercised in telegramBot.test.ts.
// This file tests the auth gate + the try/catch resilience wrapper around it,
// so the bot layer is mocked here rather than making a real getMe/sendMessage
// call for every case below.
const handleUpdateMock = vi.fn().mockResolvedValue(undefined)
const getBotMock = vi.fn().mockResolvedValue({ handleUpdate: handleUpdateMock })
vi.mock('./telegramBot', () => ({ getBot: getBotMock }))

const { handleTelegramWebhook } = await import('./telegramHandler')

const ENV = {
  TELEGRAM_BOT_TOKEN: '111:aaa',
  TELEGRAM_WEBHOOK_SECRET: 'shh',
  TELEGRAM_ADMIN_IDS: '111',
}

beforeEach(() => {
  handleUpdateMock.mockReset().mockResolvedValue(undefined)
})

describe('handleTelegramWebhook', () => {
  it('500 when not configured', async () => {
    const r = await handleTelegramWebhook({ secretHeader: 'shh', body: {} }, {})
    expect(r.status).toBe(500)
    expect(getBotMock).not.toHaveBeenCalled()
  })

  it('401 on a missing/wrong secret header', async () => {
    const r = await handleTelegramWebhook({ secretHeader: 'wrong', body: {} }, ENV)
    expect(r.status).toBe(401)
    expect(getBotMock).not.toHaveBeenCalled()
  })

  it('200 on a correct secret header, passing the parsed body to bot.handleUpdate', async () => {
    const update = { update_id: 1 }
    const r = await handleTelegramWebhook({ secretHeader: 'shh', body: update }, ENV)
    expect(r.status).toBe(200)
    expect(handleUpdateMock).toHaveBeenCalledWith(update)
  })

  it('still acks 200 even if the bot throws (Telegram retries hard on non-2xx)', async () => {
    handleUpdateMock.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await handleTelegramWebhook({ secretHeader: 'shh', body: { update_id: 2 } }, ENV)
    expect(r.status).toBe(200)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/telegramHandler.test.ts`
Expected: FAIL — `Cannot find module './telegramHandler'`.

- [ ] **Step 3: Implement `api/_lib/telegramHandler.ts`**

```ts
import type { Update } from 'grammy/types'
import type { HandlerResult, SupabaseAdminEnv, TelegramEnv } from './types'
import { getBot } from './telegramBot'
import type { DispatchDeps } from './telegramDispatch'

type Env = TelegramEnv & SupabaseAdminEnv

export async function handleTelegramWebhook(
  input: { secretHeader: string | undefined; body: unknown },
  env: Env,
  deps?: DispatchDeps,
): Promise<HandlerResult> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    return { status: 500, body: { error: 'not_configured' } }
  }
  if (input.secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    return { status: 401, body: { error: 'unauthorized' } }
  }
  const bot = await getBot(env, deps)
  try {
    await bot.handleUpdate(input.body as Update)
  } catch (err) {
    console.error('telegram webhook handling failed', err)
  }
  return { status: 200, body: { ok: true } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/telegramHandler.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the Vercel route `api/telegram/webhook.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleTelegramWebhook } from '../_lib/telegramHandler'
import { send } from '../_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const secretHeaderRaw = req.headers['x-telegram-bot-api-secret-token']
  const secretHeader = Array.isArray(secretHeaderRaw) ? secretHeaderRaw[0] : secretHeaderRaw
  const result = await handleTelegramWebhook(
    { secretHeader, body: req.body },
    {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_ADMIN_IDS: process.env.TELEGRAM_ADMIN_IDS,
      TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  )
  send(res, result)
}
```

- [ ] **Step 6: Run the full suite to confirm nothing else broke**

Run: `npx vitest run`
Expected: PASS (all suites, including every pre-existing test file).

- [ ] **Step 7: Commit**

```bash
git add api/_lib/telegramHandler.ts api/_lib/telegramHandler.test.ts api/telegram/webhook.ts
git commit -m "feat(telegram-bot): webhook route — secret-header check + bot.handleUpdate"
```

---

## Task 7: `setWebhook` utility + build/lint verification

**Files:**
- Create: `scripts/telegram-set-webhook.mjs`

**Interfaces:**
- Consumes: `Bot` from `grammy` directly (this is a standalone operator script, not part of the deployed `api/` tree — it never runs in production, only once from a developer machine).

- [ ] **Step 1: Implement `scripts/telegram-set-webhook.mjs`**

```js
import { Bot } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const domain = process.argv[2]

if (!token || !secret || !domain) {
  console.error(
    'Usage: node --env-file=.env.local scripts/telegram-set-webhook.mjs <https-domain>\n' +
      'Example: node --env-file=.env.local scripts/telegram-set-webhook.mjs portfolio-three-rho-45ofj86fdk.vercel.app',
  )
  process.exit(1)
}

const url = `https://${domain}/api/telegram/webhook`
const bot = new Bot(token)
await bot.api.setWebhook(url, { secret_token: secret })
console.log('Webhook set to', url)

const info = await bot.api.getWebhookInfo()
console.log(JSON.stringify(info, null, 2))
```

- [ ] **Step 2: Run the full build to confirm the api tree still type-checks**

Run: `npm run build`
Expected: succeeds (`tsc -b && tsc -p tsconfig.api.json && vite build`), no new warnings about `api/telegram/webhook.ts` or the new `_lib` files.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: 0 errors (pre-existing warnings elsewhere in the repo are unrelated and unchanged).

- [ ] **Step 4: Commit**

```bash
git add scripts/telegram-set-webhook.mjs
git commit -m "chore(telegram-bot): one-off setWebhook operator script"
```

---

## Integration verification (live Telegram + live Supabase)

Not a subagent task — the controller (you) runs this after all 7 tasks are merged and pushed, against a real deployed preview or production URL, exactly like the Supabase plans' final live-verification step.

1. Push the branch; confirm Vercel deployed it and note the deployment's domain.
2. Run `node --env-file=.env.local scripts/telegram-set-webhook.mjs <that domain>` — confirm `getWebhookInfo` reports the correct URL and no `last_error_message`.
3. In Telegram, as the owner: send `/start` → expect the 6-button menu (Content, Projects, Services, SEO, Requests, Administrators).
4. Tap "Content" (or any non-Administrators button) → expect the "coming in a later update" stub reply.
5. Tap "Administrators" → expect "No managers yet." (or the real list, if `telegram_admins` already has rows) plus an "➕ Add manager" button.
6. Tap "➕ Add manager" → send a real second Telegram account's numeric id (from `@userinfobot`) → tap a role → send a label (or tap Skip) → confirm the manager now appears in the list.
7. From that second Telegram account, send `/start` → confirm it sees only the menu items for its assigned role, and cannot open Administrators (tapping it, if visible via a stale button, replies "You don't have access to this bot.").
8. Tap "🗑 Remove" on that manager → tap "Yes, remove" → confirm the list goes back to "No managers yet." and the second account's `/start` now replies "You don't have access to this bot."
9. From a third, entirely unlisted Telegram account, send `/start` → confirm "You don't have access to this bot." and nothing else.
10. Directly query Supabase (service-role) for `telegram_sessions` and `telegram_admins` to confirm rows match what was exercised above, then clean up the test manager row if it wasn't already removed in step 8.

---

## Self-review — spec coverage

- Spec §2 "grammY" → Task 5.
- Spec §2 "Auth reuse" → deferred: this plan does not yet call `handleAdminContent`/etc. (there is nothing to call yet — every content section is a stub). The `signToken`/cookie-minting bridge is Plan 2's first task, noted here so Plan 2 doesn't have to re-derive it: mint via `signToken(env.ADMIN_SESSION_SECRET)`, pass as `cookieHeader: "admin_session=" + token`.
- Spec §2 "two-layer access control" → the secret-header check is Task 6; role resolution is Task 1, enforced in Task 4.
- Spec §2 "dialog state in Supabase" → Task 2.
- Spec §1 role/permission table, Content/Projects/Services/SEO/Requests rows → out of scope for Plan 1 by design (stubs only); Administrators row → fully implemented (Tasks 1, 3, 4).
- Spec §5 menu structure → `buildMainMenu` (Task 3) matches the role-gated bullet list exactly.

No placeholders found on review. Every task's code block is complete and copy-pasteable; no task references a function or type not defined in an earlier task in this same plan.

### Deferred to Plan 2+ (not in this plan)

- Content, SEO editing (Plan 2).
- Projects/Services cards, including photo upload → WebP conversion (Plan 3).
- Requests view/triage (Plan 4).
- Reset content — explicitly never in the bot (spec §1), web-only forever.

### Notes for the executor

- `npm install grammy@^1.46.0` in Task 1 also pulls in `@grammyjs/types` transitively — do not add it as a direct dependency; import its types via the `grammy/types` subpath (used throughout this plan), which is grammY's own public re-export surface for exactly this purpose.
- Every `_lib` file in this plan follows the existing `Deps`-interface convention byte-for-byte — if a reviewer asks "why isn't the Supabase-backed implementation itself unit tested," point to `adminRequestsHandler.test.ts` (Task 4's own reference) as the established precedent: the default implementation is exercised live in the Integration Verification section, not in `vitest`.
