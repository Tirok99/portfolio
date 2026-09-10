import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readSupabaseEnv } from './env'

let cached: SupabaseClient | null | undefined

/** The browser anon client, or `null` when Supabase env is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached
  const env = readSupabaseEnv()
  cached = env
    ? createClient(env.url, env.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null
  return cached
}

/** Test-only: drops the memoised instance. */
export function __resetSupabaseForTest(): void {
  cached = undefined
}
