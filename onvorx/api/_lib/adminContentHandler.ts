import type { HandlerResult, AuthEnv, SupabaseAdminEnv } from './types'
import { requireSession } from './handlers'
import { getSupabaseAdmin } from './supabaseAdmin'
import { sectionRow, seoRow, isSectionKey, isSeoPageKey } from './adminRows'

type Env = AuthEnv & SupabaseAdminEnv
interface DepResult { error: string | null }
export interface AdminContentDeps {
  updateSection: (key: string, patch: Record<string, unknown>, env: Env) => Promise<DepResult>
  updateSeo: (pageKey: string, patch: Record<string, unknown>, env: Env) => Promise<DepResult>
  resetAll: (content: unknown, env: Env) => Promise<DepResult>
}

const defaultDeps: AdminContentDeps = {
  updateSection: async (key, patch, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from('site_sections').update(patch).eq('key', key)
    return { error: error ? error.message : null }
  },
  updateSeo: async (pageKey, patch, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from('seo_pages').update(patch).eq('page_key', pageKey)
    return { error: error ? error.message : null }
  },
  resetAll: async (content, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { resetContent } = await import('./adminReset')
    return resetContent(c, content)
  },
}

const ok = (): HandlerResult => ({ status: 200, body: { ok: true } })
const bad = (): HandlerResult => ({ status: 400, body: { error: 'invalid_request' } })
const fail = (): HandlerResult => ({ status: 500, body: { error: 'write_failed' } })

export async function handleAdminContent(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: Env,
  deps: AdminContentDeps = defaultDeps,
): Promise<HandlerResult> {
  if (!requireSession(input.cookieHeader, env)) return { status: 401, body: { error: 'unauthorized' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 500, body: { error: 'not_configured' } }

  const body = (input.body ?? {}) as Record<string, unknown>

  if (input.method === 'PUT' && body.kind === 'section') {
    if (!isSectionKey(body.key)) return bad()
    const row = sectionRow(body.key as string, (body.patch ?? {}) as Record<string, unknown>)
    if (Object.keys(row).length === 0) return bad()
    const { error } = await deps.updateSection(body.key as string, row, env)
    return error ? fail() : ok()
  }
  if (input.method === 'PUT' && body.kind === 'seo') {
    if (!isSeoPageKey(body.pageKey)) return bad()
    const row = seoRow((body.patch ?? {}) as Record<string, unknown>)
    if (Object.keys(row).length === 0) return bad()
    const { error } = await deps.updateSeo(body.pageKey as string, row, env)
    return error ? fail() : ok()
  }
  if (input.method === 'POST' && body.op === 'reset') {
    if (typeof body.content !== 'object' || body.content === null) return bad()
    const { error } = await deps.resetAll(body.content, env)
    return error ? fail() : ok()
  }
  return { status: 405, body: { error: 'method_not_allowed' } }
}
