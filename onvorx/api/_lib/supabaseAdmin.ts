import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseAdminEnv } from './types'

/**
 * The service-role client. Bypasses RLS — only ever call this from serverless
 * functions after an auth check. Returns `null` when env is not configured so
 * callers can answer 500 "not configured" instead of throwing at import time.
 */
export function getSupabaseAdmin(env: SupabaseAdminEnv): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
