import type { HandlerResult, AuthEnv, SupabaseAdminEnv } from './types'
import { requireSession } from './handlers'
import { getSupabaseAdmin } from './supabaseAdmin'
import { estimateFromRow } from './adminRows'

type Env = AuthEnv & SupabaseAdminEnv
const STATUSES = ['new', 'in_progress', 'done', 'archived']
interface DepResult { error: string | null }
export interface AdminRequestsDeps {
  list: (env: Env) => Promise<{ rows: Record<string, unknown>[]; error: string | null }>
  patch: (id: string, fields: Record<string, unknown>, env: Env) => Promise<DepResult>
  remove: (id: string, env: Env) => Promise<DepResult>
}

const defaultDeps: AdminRequestsDeps = {
  list: async (env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { rows: [], error: 'not_configured' }
    const { data, error } = await c.from('estimate_requests').select('*').order('created_at', { ascending: false })
    return { rows: (data ?? []) as Record<string, unknown>[], error: error ? error.message : null }
  },
  patch: async (id, fields, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from('estimate_requests').update(fields).eq('id', id)
    return { error: error ? error.message : null }
  },
  remove: async (id, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from('estimate_requests').delete().eq('id', id)
    return { error: error ? error.message : null }
  },
}

const bad = (): HandlerResult => ({ status: 400, body: { error: 'invalid_request' } })
const fail = (): HandlerResult => ({ status: 500, body: { error: 'write_failed' } })
const ok = (): HandlerResult => ({ status: 200, body: { ok: true } })

export async function handleAdminRequests(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: Env,
  deps: AdminRequestsDeps = defaultDeps,
): Promise<HandlerResult> {
  if (!requireSession(input.cookieHeader, env)) return { status: 401, body: { error: 'unauthorized' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 500, body: { error: 'not_configured' } }
  const body = (input.body ?? {}) as Record<string, unknown>

  if (input.method === 'GET') {
    const { rows, error } = await deps.list(env)
    if (error) return fail()
    return { status: 200, body: { requests: rows.map(estimateFromRow) } }
  }
  if (input.method === 'PATCH') {
    if (typeof body.id !== 'string' || !body.id) return bad()
    const fields: Record<string, unknown> = {}
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as string)) return bad()
      fields.status = body.status
    }
    if (body.note !== undefined) {
      if (typeof body.note !== 'string' || body.note.length > 5000) return bad()
      fields.note = body.note
    }
    if (Object.keys(fields).length === 0) return bad()
    const { error } = await deps.patch(body.id, fields, env)
    return error ? fail() : ok()
  }
  if (input.method === 'DELETE') {
    if (typeof body.id !== 'string' || !body.id) return bad()
    const { error } = await deps.remove(body.id, env)
    return error ? fail() : ok()
  }
  return { status: 405, body: { error: 'method_not_allowed' } }
}
