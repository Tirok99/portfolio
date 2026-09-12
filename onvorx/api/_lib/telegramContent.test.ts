import { describe, it, expect } from 'vitest'
import { defaultTelegramContentDeps } from './telegramContent'

describe('defaultTelegramContentDeps', () => {
  it('getSection returns null when Supabase is not configured', async () => {
    expect(await defaultTelegramContentDeps.getSection('hero', {})).toBeNull()
  })
  it('getSeo returns null when Supabase is not configured', async () => {
    expect(await defaultTelegramContentDeps.getSeo('home', {})).toBeNull()
  })
})
