import { describe, it, expect, vi, afterEach } from 'vitest'
import { getBot } from './telegramBot'
import type { DispatchDeps } from './telegramDispatch'

afterEach(() => {
  vi.unstubAllGlobals()
})

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
      cardsDispatch: {
        cards: {
          listProjects: vi.fn().mockResolvedValue([]),
          getProject: vi.fn().mockResolvedValue(null),
          listServices: vi.fn().mockResolvedValue([]),
          getService: vi.fn().mockResolvedValue(null),
        },
        adminCards: {
          create: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockResolvedValue({ error: null }),
          remove: vi.fn().mockResolvedValue({ error: null }),
          reorder: vi.fn().mockResolvedValue({ error: null }),
        },
        adminUpload: {
          put: vi.fn().mockResolvedValue({ url: '', path: '', error: null }),
          del: vi.fn().mockResolvedValue({ error: null }),
        },
        sessions: {
          load: vi.fn().mockResolvedValue({ screen: 'main_menu' }),
          save: vi.fn().mockResolvedValue(undefined),
        },
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

  it('a photo message is downloaded via ctx.api.getFile + the raw global fetch, and passed through as photoDataUrl', async () => {
    const calls: string[] = []
    // grammY's own API calls (getMe during bot.init(), getFile, sendMessage, ...)
    // go through this fake — the same `client: { fetch }` seam Plan 1 established
    // and the existing tests above already use.
    const grammyFetch = vi.fn(async (url: unknown) => {
      const u = String(url)
      calls.push(u)
      if (u.includes('getMe')) return { json: async () => ({ ok: true, result: FAKE_ME }) } as Response
      if (u.includes('getFile')) {
        return {
          json: async () => ({ ok: true, result: { file_id: 'f1', file_unique_id: 'u1', file_path: 'photos/f1.jpg' } }),
        } as Response
      }
      return { json: async () => ({ ok: true, result: true }) } as Response
    })

    // toBotCtx's raw byte-download call uses the plain GLOBAL fetch, not grammY's
    // client.fetch override — grammY never sees this URL, so it needs its own stub.
    const rawDownloadCalls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => {
        rawDownloadCalls.push(String(url))
        return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as unknown as Response
      }),
    )

    let capturedPhotoDataUrl: string | undefined
    const put = vi.fn(async (_folder: string, _key: string, bytes: Buffer) => {
      capturedPhotoDataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`
      return { url: 'https://x/new.jpg', path: 'projects/new.jpg', error: null }
    })
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
      cardsDispatch: {
        cards: {
          listProjects: vi.fn().mockResolvedValue([]),
          getProject: vi.fn().mockResolvedValue({
            list: 'home', id: 'a', sort: 0, published: true,
            title: { en: 'A', uk: 'А' }, tags: [], description: { en: '', uk: '' },
            imageUrl: null, imagePath: null, imageAlt: { en: '', uk: '' },
          }),
          listServices: vi.fn().mockResolvedValue([]),
          getService: vi.fn().mockResolvedValue(null),
        },
        adminCards: {
          create: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockResolvedValue({ error: null }),
          remove: vi.fn().mockResolvedValue({ error: null }),
          reorder: vi.fn().mockResolvedValue({ error: null }),
        },
        adminUpload: {
          put,
          del: vi.fn().mockResolvedValue({ error: null }),
        },
        sessions: {
          load: vi.fn().mockResolvedValue({
            screen: 'cards_photo_wait',
            data: { type: 'projects', list: 'home', id: 'a' },
          }),
          save: vi.fn().mockResolvedValue(undefined),
        },
      },
    }

    const bot = await getBot(
      {
        TELEGRAM_BOT_TOKEN: '555:eee',
        TELEGRAM_ADMIN_IDS: '111',
        ADMIN_SESSION_SECRET: 'a-long-enough-test-secret-value',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      },
      deps,
      { fetch: grammyFetch as unknown as typeof fetch },
    )
    await bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: 1, type: 'private' as const, first_name: 'Owner' },
        from: { id: 111, is_bot: false, first_name: 'Owner' },
        photo: [{ file_id: 'f1', file_unique_id: 'u1', width: 10, height: 10 }],
      },
    })

    expect(rawDownloadCalls.some((u) => u.startsWith('https://api.telegram.org/file/bot555:eee/photos/f1.jpg'))).toBe(true)
    expect(put).toHaveBeenCalled()
    expect(capturedPhotoDataUrl).toMatch(/^data:image\/jpeg;base64,/)
    // Buffer.from([1,2,3]).toString('base64') === 'AQID' — confirms the exact
    // bytes returned by the stubbed raw download reached the upload call.
    expect(capturedPhotoDataUrl).toBe(`data:image/jpeg;base64,${Buffer.from([1, 2, 3]).toString('base64')}`)
  })
})
