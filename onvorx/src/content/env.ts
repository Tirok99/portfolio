export interface SupabaseBrowserEnv {
  url: string
  anonKey: string
}

/**
 * Reads the browser Supabase config. `source` is injectable for tests; in the
 * app it defaults to Vite's `import.meta.env`. Returns `null` (not a throw) when
 * unconfigured so the app can fall back to bundled defaults.
 */
export function readSupabaseEnv(
  source: Record<string, unknown> = import.meta.env as unknown as Record<string, unknown>,
): SupabaseBrowserEnv | null {
  const url = typeof source.VITE_SUPABASE_URL === 'string' ? source.VITE_SUPABASE_URL.trim() : ''
  const anonKey =
    typeof source.VITE_SUPABASE_ANON_KEY === 'string' ? source.VITE_SUPABASE_ANON_KEY.trim() : ''
  if (!url || !anonKey) return null
  return { url, anonKey }
}
