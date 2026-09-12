import { describe, it, expect, vi } from 'vitest'
import { parseOwnerIds, isOwner, resolveRole, MANAGER_ROLES } from './telegramAdmins'
import type { TelegramAdminsDeps, ManagerRecord } from './telegramAdmins'

const ENV = { TELEGRAM_ADMIN_IDS: '111,222 , 333' }

const MANAGER: ManagerRecord = {
  telegramId: 999,
  role: 'content_manager',
  label: 'Anna',
  addedBy: 111,
  createdAt: '2026-01-01T00:00:00Z',
}

const deps = (): TelegramAdminsDeps => ({
  findManager: vi.fn().mockResolvedValue(null),
  listManagers: vi.fn().mockResolvedValue([]),
  addManager: vi.fn().mockResolvedValue({ error: null }),
  removeManager: vi.fn().mockResolvedValue({ error: null }),
})

describe('parseOwnerIds', () => {
  it('splits, trims, and converts to numbers', () => {
    expect(parseOwnerIds(ENV)).toEqual([111, 222, 333])
  })
  it('returns [] when unset', () => {
    expect(parseOwnerIds({})).toEqual([])
  })
  it('drops non-numeric or non-positive junk', () => {
    expect(parseOwnerIds({ TELEGRAM_ADMIN_IDS: '111,abc,-5,0,222' })).toEqual([111, 222])
  })
})

describe('isOwner', () => {
  it('true for a listed id', () => {
    expect(isOwner(222, ENV)).toBe(true)
  })
  it('false for an unlisted id', () => {
    expect(isOwner(999, ENV)).toBe(false)
  })
})

describe('resolveRole', () => {
  it('owner ids resolve to "owner" without touching the DB', async () => {
    const d = deps()
    expect(await resolveRole(111, ENV, d)).toBe('owner')
    expect(d.findManager).not.toHaveBeenCalled()
  })
  it('a manager row resolves to its role', async () => {
    const d = deps()
    d.findManager = vi.fn().mockResolvedValue(MANAGER)
    expect(await resolveRole(999, ENV, d)).toBe('content_manager')
  })
  it('an unknown id resolves to null', async () => {
    expect(await resolveRole(555, ENV, deps())).toBeNull()
  })
})

describe('MANAGER_ROLES', () => {
  it('is exactly the two DB-allowed roles', () => {
    expect(MANAGER_ROLES).toEqual(['content_manager', 'sales_manager'])
  })
})
