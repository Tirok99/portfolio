import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ mock: true })),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient }))

import { getSupabaseAdmin } from './supabaseAdmin'

beforeEach(() => createClient.mockClear())

describe('getSupabaseAdmin', () => {
  it('returns null when url or key is missing', () => {
    expect(getSupabaseAdmin({})).toBeNull()
    expect(getSupabaseAdmin({ SUPABASE_URL: 'u' })).toBeNull()
    expect(getSupabaseAdmin({ SUPABASE_SERVICE_ROLE_KEY: 'k' })).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('builds a non-persistent client when both are present', () => {
    getSupabaseAdmin({ SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' })
    expect(createClient).toHaveBeenCalledWith('u', 'k', expect.objectContaining({
      auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
    }))
  })
})
