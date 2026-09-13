import { describe, it, expect } from 'vitest'
import { defaultTelegramCardsDeps } from './telegramCards'

describe('defaultTelegramCardsDeps', () => {
  it('listProjects returns [] when Supabase is not configured', async () => {
    expect(await defaultTelegramCardsDeps.listProjects('home', {})).toEqual([])
  })
  it('getProject returns null when Supabase is not configured', async () => {
    expect(await defaultTelegramCardsDeps.getProject('home', 'x', {})).toBeNull()
  })
  it('listServices returns [] when Supabase is not configured', async () => {
    expect(await defaultTelegramCardsDeps.listServices('home', {})).toEqual([])
  })
  it('getService returns null when Supabase is not configured', async () => {
    expect(await defaultTelegramCardsDeps.getService('home', 'x', {})).toBeNull()
  })
})
