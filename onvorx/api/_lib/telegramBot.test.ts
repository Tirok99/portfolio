import { describe, it, expect, vi } from 'vitest'
import { getBot } from './telegramBot'
import type { DispatchDeps } from './telegramDispatch'

const FAKE_ME = {
  id: 1,
  is_bot: true,
  first_name: 'ONVORX Admin',
  username: 'onvorx_admin_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
}

function fakeFetch(calls: string[]) {
  return vi.fn(async (url: unknown) => {
    const u = String(url)
    calls.push(u)
    if (u.includes('getMe')) return { json: async () => ({ ok: true, result: FAKE_ME }) } as Response
    return { json: async () => ({ ok: true, result: true }) } as Response
  })
}

describe('getBot', () => {
  it('caches the instance per token — concurrent calls only trigger one getMe', async () => {
    const calls: string[] = []
    const env = { TELEGRAM_BOT_TOKEN: '111:aaa' }
    const client = { fetch: fakeFetch(calls) as unknown as typeof fetch }
    const [a, b] = await Promise.all([getBot(env, undefined, client), getBot(env, undefined, client)])
    expect(a).toBe(b)
    expect(calls.filter((u) => u.includes('getMe'))).toHaveLength(1)
  })

  it('builds a new instance when the token changes', async () => {
    const calls: string[] = []
    const client = { fetch: fakeFetch(calls) as unknown as typeof fetch }
    const a = await getBot({ TELEGRAM_BOT_TOKEN: '111:aaa' }, undefined, client)
    const b = await getBot({ TELEGRAM_BOT_TOKEN: '222:bbb' }, undefined, client)
    expect(a).not.toBe(b)
  })

  it('does not keep a rejected botPromise cached — the next call for the same token gets a fresh attempt', async () => {
    // grammY's bot.init() retries getMe internally on transient errors (5xx, 429,
    // network errors), so to observe a genuinely rejected botPromise we need a
    // non-retryable Telegram error (grammY only rethrows outside that retry loop
    // for a 4xx other than 429 — e.g. 401, an invalid-token response).
    const calls: string[] = []
    const token = '333:ccc'
    let getMeCallCount = 0
    const fetchImpl = vi.fn(async (url: unknown) => {
      const u = String(url)
      calls.push(u)
      if (u.includes('getMe')) {
        getMeCallCount += 1
        if (getMeCallCount === 1) {
          return { json: async () => ({ ok: false, description: 'Unauthorized', error_code: 401 }) } as Response
        }
        return { json: async () => ({ ok: true, result: FAKE_ME }) } as Response
      }
      return { json: async () => ({ ok: true, result: true }) } as Response
    })
    const client = { fetch: fetchImpl as unknown as typeof fetch }

    await expect(getBot({ TELEGRAM_BOT_TOKEN: token }, undefined, client)).rejects.toBeTruthy()
    const bot = await getBot({ TELEGRAM_BOT_TOKEN: token }, undefined, client)
    expect(bot).toBeTruthy()
    expect(calls.filter((u) => u.includes('getMe'))).toHaveLength(2)
  })

  it('a real Update flows through bot.handleUpdate to a real ctx.reply, network faked via client.fetch', async () => {
    const calls: string[] = []
    const deps: DispatchDeps = {
      admins: {
        findManager: vi.fn().mockResolvedValue(null),
        listManagers: vi.fn().mockResolvedValue([]),
        addManager: vi.fn().mockResolvedValue({ error: null }),
        removeManager: vi.fn().mockResolvedValue({ error: null }),
      },
      sessions: {
        load: vi.fn().mockResolvedValue({ screen: 'main_menu' }),
        save: vi.fn().mockResolvedValue(undefined),
      },
      content: {
        getSection: vi.fn().mockResolvedValue(null),
        getSeo: vi.fn().mockResolvedValue(null),
      },
      adminContent: {
        updateSection: vi.fn().mockResolvedValue({ error: null }),
        updateSeo: vi.fn().mockResolvedValue({ error: null }),
        resetAll: vi.fn().mockResolvedValue({ error: null }),
      },
    }
    const bot = await getBot(
      { TELEGRAM_BOT_TOKEN: '444:ddd', TELEGRAM_ADMIN_IDS: '111' },
      deps,
      { fetch: fakeFetch(calls) as unknown as typeof fetch },
    )
    const update = {
      update_id: 1,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: 1, type: 'private' as const, first_name: 'Owner' },
        from: { id: 111, is_bot: false, first_name: 'Owner' },
        text: '/start',
      },
    }
    await bot.handleUpdate(update)
    expect(deps.sessions.save).toHaveBeenCalledWith(1, { screen: 'main_menu' }, expect.anything())
    expect(calls.some((u) => u.includes('sendMessage'))).toBe(true)
  })
})
