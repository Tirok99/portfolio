import { describe, it, expect } from 'vitest'
import { readSupabaseEnv } from './env'

describe('readSupabaseEnv', () => {
  it('returns null when either var is missing', () => {
    expect(readSupabaseEnv({})).toBeNull()
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
    expect(readSupabaseEnv({ VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
  })

  it('returns null when a var is present but blank', () => {
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toBeNull()
  })

  it('returns the trimmed pair when both are set', () => {
    expect(
      readSupabaseEnv({
        VITE_SUPABASE_URL: ' https://x.supabase.co ',
        VITE_SUPABASE_ANON_KEY: ' anon-key ',
      }),
    ).toEqual({ url: 'https://x.supabase.co', anonKey: 'anon-key' })
  })
})
