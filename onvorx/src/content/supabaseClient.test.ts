import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ mock: true }))
}))

vi.mock('@supabase/supabase-js', () => ({ createClient }))

import { getSupabase, __resetSupabaseForTest } from './supabaseClient'
import * as env from './env'

beforeEach(() => {
  __resetSupabaseForTest()
  createClient.mockClear()
})

describe('getSupabase', () => {
  it('returns null and does not construct a client when env is absent', () => {
    vi.spyOn(env, 'readSupabaseEnv').mockReturnValue(null)
    expect(getSupabase()).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('constructs once and caches', () => {
    vi.spyOn(env, 'readSupabaseEnv').mockReturnValue({ url: 'u', anonKey: 'k' })
    const a = getSupabase()
    const b = getSupabase()
    expect(a).toBe(b)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith('u', 'k', expect.objectContaining({
      auth: expect.objectContaining({ persistSession: false }),
    }))
  })
})
