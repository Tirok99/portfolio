import type { HandlerResult, AuthEnv, SupabaseAdminEnv } from './types'
import { requireSession } from './handlers'
import { getSupabaseAdmin } from './supabaseAdmin'
import { projectRow, serviceRow, isCardType, isCardList } from './adminRows'

type Env = AuthEnv & SupabaseAdminEnv
type Kind = 'project' | 'service'
type List = 'home' | 'page'
interface DepResult { error: string | null }
export interface AdminCardsDeps {
  create: (type: Kind, list: List, row: Record<string, unknown>, env: Env) => Promise<DepResult>
  update: (type: Kind, list: List, id: string, row: Record<string, unknown>, env: Env) => Promise<DepResult>
  remove: (type: Kind, list: List, id: string, env: Env) => Promise<DepResult>
  reorder: (type: Kind, list: List, orderedIds: string[], env: Env) => Promise<DepResult>
}

const table = (t: Kind) => (t === 'project' ? 'projects' : 'services')
const rowFor = (t: Kind, patch: Record<string, unknown>) => (t === 'project' ? projectRow(patch) : serviceRow(patch))

// `sort` is assigned by a BEFORE INSERT trigger (see
// supabase/migration-2026-09-10-plan4.sql); the insert never sends one, and
// `unique (list, sort)` means a concurrent create can lose a race with a
// `23505` (unique_violation) — retry a few times before giving up.
export const createCardDefault: AdminCardsDeps['create'] = async (type, list, row, env) => {
  const c = getSupabaseAdmin(env)
  if (!c) return { error: 'not_configured' }
  // `sort` is DB-assigned by a BEFORE INSERT trigger; never send one.
  const { sort: _drop, ...clean } = row as Record<string, unknown>
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await c.from(table(type)).insert({ ...clean, list })
    if (!error) return { error: null }
    // 23505 = unique_violation on (list, sort) — a concurrent create raced us; retry
    if ((error as { code?: string }).code !== '23505') return { error: error.message }
  }
  return { error: 'sort_conflict' }
}

const defaultDeps: AdminCardsDeps = {
  create: createCardDefault,
  update: async (type, list, id, row, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from(table(type)).update(row).eq('list', list).eq('id', id)
    return { error: error ? error.message : null }
  },
  remove: async (type, list, id, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    // read image_path/icon_path first so we can clean Storage
    const pathCol = type === 'project' ? 'image_path' : 'icon_path'
    const { data } = await c.from(table(type)).select(pathCol).eq('list', list).eq('id', id).maybeSingle()
    const objectPath = (data as Record<string, unknown> | null)?.[pathCol]
    const { error } = await c.from(table(type)).delete().eq('list', list).eq('id', id)
    if (error) return { error: error.message }
    if (typeof objectPath === 'string' && objectPath) {
      await c.storage.from(env.SUPABASE_MEDIA_BUCKET ?? 'public-media').remove([objectPath])
    }
    return { error: null }
  },
  reorder: async (type, list, orderedIds, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await c.from(table(type)).update({ sort: i }).eq('list', list).eq('id', orderedIds[i])
      if (error) return { error: error.message }
    }
    return { error: null }
  },
}

const bad = (): HandlerResult => ({ status: 400, body: { error: 'invalid_request' } })
const fail = (): HandlerResult => ({ status: 500, body: { error: 'write_failed' } })
const ok = (): HandlerResult => ({ status: 200, body: { ok: true } })

export async function handleAdminCards(
  input: { method: string; cookieHeader: string | undefined; query: Record<string, string | undefined>; body: unknown },
  env: Env,
  deps: AdminCardsDeps = defaultDeps,
): Promise<HandlerResult> {
  if (!requireSession(input.cookieHeader, env)) return { status: 401, body: { error: 'unauthorized' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 500, body: { error: 'not_configured' } }
  const type = input.query.type
  if (!isCardType(type)) return bad()
  const body = (input.body ?? {}) as Record<string, unknown>
  if (!isCardList(body.list)) return bad()
  const list = body.list

  if (input.method === 'POST' && body.op === 'reorder') {
    if (!Array.isArray(body.orderedIds) || !body.orderedIds.every((x) => typeof x === 'string')) return bad()
    const { error } = await deps.reorder(type, list, body.orderedIds as string[], env)
    return error ? fail() : ok()
  }
  if (input.method === 'POST') {
    const card = (body.card ?? {}) as Record<string, unknown>
    if (typeof card.id !== 'string' || !card.id) return bad()
    // `sort` is server-derived on create (see defaultDeps.create) — never trust
    // the client-supplied index, so strip it from the mapped row here.
    const { sort: _sort, ...mapped } = rowFor(type, card)
    const row = { ...mapped, id: card.id, list }
    const { error } = await deps.create(type, list, row, env)
    return error ? fail() : ok()
  }
  if (input.method === 'PUT') {
    if (typeof body.id !== 'string' || !body.id) return bad()
    const row = rowFor(type, (body.patch ?? {}) as Record<string, unknown>)
    if (Object.keys(row).length === 0) return bad()
    const { error } = await deps.update(type, list, body.id, row, env)
    return error ? fail() : ok()
  }
  if (input.method === 'DELETE') {
    if (typeof body.id !== 'string' || !body.id) return bad()
    const { error } = await deps.remove(type, list, body.id, env)
    return error ? fail() : ok()
  }
  return { status: 405, body: { error: 'method_not_allowed' } }
}
