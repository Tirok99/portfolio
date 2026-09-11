import type { HandlerResult, SupabaseAdminEnv } from './types'
import { validateEstimate, type EstimateInsert } from './estimate'
import { getSupabaseAdmin } from './supabaseAdmin'
import { checkRateLimit } from './estimateRateLimit'

export interface EstimateDeps {
  insert: (row: EstimateInsert, env: SupabaseAdminEnv) => Promise<{ error: string | null }>
}

const defaultInsert: EstimateDeps['insert'] = async (row, env) => {
  const client = getSupabaseAdmin(env)
  if (!client) return { error: 'not_configured' }
  const { error } = await client.from('estimate_requests').insert(row)
  return { error: error ? error.message : null }
}

export async function handleEstimate(
  input: { method: string; body: unknown; ip: string },
  env: SupabaseAdminEnv,
  deps: EstimateDeps = { insert: defaultInsert },
): Promise<HandlerResult> {
  if (input.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 500, body: { error: 'not_configured' } }
  }
  const v = validateEstimate(input.body)
  if (!v.ok) {
    // honeypot: pretend success, do not insert, do not reveal the trap
    if (v.error === 'honeypot') return { status: 200, body: { ok: true } }
    return { status: 400, body: { error: 'invalid_request' } }
  }
  if (!checkRateLimit(input.ip)) return { status: 429, body: { error: 'rate_limited' } }

  const { error } = await deps.insert(v.row, env)
  if (error) return { status: 500, body: { error: 'insert_failed' } }
  return { status: 200, body: { ok: true } }
}
