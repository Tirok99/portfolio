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
