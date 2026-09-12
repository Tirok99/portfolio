import { describe, it, expect, vi } from 'vitest'
import { dispatch } from './telegramDispatch'
import type { BotCtx, DispatchDeps } from './telegramDispatch'
import type { TelegramAdminsDeps, ManagerRecord } from './telegramAdmins'
import type { TelegramSessionsDeps, TelegramState } from './telegramSessions'

const ENV = { TELEGRAM_ADMIN_IDS: '111' }
const OWNER_ID = 111
const MANAGER: ManagerRecord = {
  telegramId: 42, role: 'content_manager', label: 'Anna', addedBy: OWNER_ID, createdAt: '2026-01-01T00:00:00Z',
}

function makeDeps(initialState: TelegramState = { screen: 'main_menu' }) {
  let state = initialState
  let managers: ManagerRecord[] = []
  const admins: TelegramAdminsDeps = {
    findManager: vi.fn(async (id: number) => managers.find((m) => m.telegramId === id) ?? null),
    listManagers: vi.fn(async () => managers),
    addManager: vi.fn(async (record) => {
      managers = [...managers, { ...record, createdAt: '2026-01-01T00:00:00Z' }]
      return { error: null }
    }),
    removeManager: vi.fn(async (id: number) => {
      managers = managers.filter((m) => m.telegramId !== id)
      return { error: null }
    }),
  }
  const sessions: TelegramSessionsDeps = {
    load: vi.fn(async () => state),
    save: vi.fn(async (_chatId, next) => {
      state = next
    }),
  }
  const deps: DispatchDeps = { admins, sessions }
  return { deps, admins, sessions, getState: () => state, getManagers: () => managers, setManagers: (m: ManagerRecord[]) => (managers = m) }
}

function makeCtx(overrides: Partial<BotCtx>): BotCtx {
  return {
    chatId: 1,
    fromId: OWNER_ID,
    reply: vi.fn(async () => {}),
    answerCallback: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('dispatch — access control', () => {
  it('an unknown id gets "no access" and nothing else happens', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ fromId: 999, text: '/start' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })
})

describe('dispatch — /start', () => {
  it('owner gets the full menu and state resets to main_menu', async () => {
    const { deps, sessions } = makeDeps()
    const ctx = makeCtx({ text: '/start' })
    await dispatch(ctx, ENV, deps)
    expect(sessions.save).toHaveBeenCalledWith(1, { screen: 'main_menu' }, ENV)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('ONVORX admin — choose a section:')
  })
})

describe('dispatch — stub sections', () => {
  it('stub:content replies with a coming-soon message for anyone with access', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'stub:content' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.answerCallback).toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'content management is coming in a later update.' })
  })
})

describe('dispatch — Administrators, owner-only', () => {
  it('a manager cannot open menu:admins', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([MANAGER])
    const ctx = makeCtx({ fromId: 42, callbackData: 'menu:admins' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('owner opens menu:admins and sees the (empty) list', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'menu:admins' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('No managers yet.')
  })

  it('full add-manager flow: id -> role -> label -> added', async () => {
    const { deps, getManagers } = makeDeps()

    await dispatch(makeCtx({ callbackData: 'admins:add' }), ENV, deps)
    await dispatch(makeCtx({ text: '42' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'admins:add:role:content_manager' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'Anna' })
    await dispatch(finalCtx, ENV, deps)

    expect(getManagers()).toEqual([
      { telegramId: 42, role: 'content_manager', label: 'Anna', addedBy: OWNER_ID, createdAt: '2026-01-01T00:00:00Z' },
    ])
    const lastReply = (finalCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(lastReply.text).toContain('Anna')
  })

  it('add-manager flow: Skip label adds with a null label', async () => {
    const { deps, getManagers } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'admins:add' }), ENV, deps)
    await dispatch(makeCtx({ text: '77' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'admins:add:role:sales_manager' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'admins:add:skip_label' }), ENV, deps)
    expect(getManagers()).toEqual([
      { telegramId: 77, role: 'sales_manager', label: null, addedBy: OWNER_ID, createdAt: '2026-01-01T00:00:00Z' },
    ])
  })

  it('rejects a non-numeric id and stays on the same step', async () => {
    const { deps, getState } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'admins:add' }), ENV, deps)
    const ctx = makeCtx({ text: 'not-a-number' })
    await dispatch(ctx, ENV, deps)
    expect(getState().screen).toBe('admins_add_id')
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('valid Telegram ID') }),
    )
  })

  it('remove flow: tap remove -> confirm -> gone', async () => {
    const { deps, setManagers, getManagers } = makeDeps()
    setManagers([MANAGER])
    await dispatch(makeCtx({ callbackData: 'admins:remove:42' }), ENV, deps)
    const confirmCtx = makeCtx({ callbackData: 'admins:remove:confirm:42' })
    await dispatch(confirmCtx, ENV, deps)
    expect(getManagers()).toEqual([])
    const reply = (confirmCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('No managers yet.')
  })

  it('remove flow: cancel keeps the manager', async () => {
    const { deps, setManagers, getManagers } = makeDeps()
    setManagers([MANAGER])
    await dispatch(makeCtx({ callbackData: 'admins:remove:42' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'admins:remove:cancel' }), ENV, deps)
    expect(getManagers()).toEqual([MANAGER])
  })
})
