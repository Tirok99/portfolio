import { describe, it, expect, vi } from 'vitest'
import { dispatch } from './telegramDispatch'
import type { BotCtx, DispatchDeps } from './telegramDispatch'
import type { TelegramAdminsDeps, ManagerRecord } from './telegramAdmins'
import type { TelegramSessionsDeps, TelegramState } from './telegramSessions'
import type { TelegramContentDeps, SectionRecord, SeoRecord } from './telegramContent'
import type { AdminContentDeps } from './adminContentHandler'
import type { CardsDispatchDeps } from './telegramCardsDispatch'
import type { RequestsDispatchDeps } from './telegramRequestsDispatch'

const ENV = {
  TELEGRAM_ADMIN_IDS: '111',
  ADMIN_SESSION_SECRET: 'a-long-enough-test-secret-value',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
}
const OWNER_ID = 111
const MANAGER: ManagerRecord = {
  telegramId: 42, role: 'content_manager', label: 'Anna', addedBy: OWNER_ID, createdAt: '2026-01-01T00:00:00Z',
}
const SALES: ManagerRecord = {
  telegramId: 77, role: 'sales_manager', label: 'Sam', addedBy: OWNER_ID, createdAt: '2026-01-01T00:00:00Z',
}

const L = (en: string, uk: string) => ({ en, uk })

const HERO: SectionRecord = {
  key: 'hero',
  eyebrow: L('Web solutions', 'Веб-рішення'),
  title: L('Built around your business', 'Створено під ваш бізнес'),
  body: L('We design and build.', 'Ми проєктуємо і будуємо.'),
  ctaLabel: L('Request an estimate', 'Отримати оцінку'),
}
const ABOUT: SectionRecord = {
  key: 'about',
  eyebrow: L('About', 'Про нас'),
  title: L('Who we are', 'Хто ми'),
  body: L('A small team.', 'Невелика команда.'),
  ctaLabel: null,
}
const HOME_SEO: SeoRecord = {
  pageKey: 'home',
  title: L('ONVORX', 'ONVORX'),
  description: L('Web solutions built around your business.', 'Веб-рішення під ваш бізнес.'),
}

function applySectionPatch(record: SectionRecord, patch: Record<string, unknown>): SectionRecord {
  const next = { ...record }
  if ('eyebrow' in patch) next.eyebrow = patch.eyebrow as SectionRecord['eyebrow']
  if ('title' in patch) next.title = patch.title as SectionRecord['title']
  if ('body' in patch) next.body = patch.body as SectionRecord['body']
  if ('cta_label' in patch) next.ctaLabel = patch.cta_label as SectionRecord['ctaLabel']
  return next
}

function applySeoPatch(record: SeoRecord, patch: Record<string, unknown>): SeoRecord {
  return { ...record, ...(patch as Partial<SeoRecord>) }
}

function makeDeps(initialState: TelegramState = { screen: 'main_menu' }) {
  let state = initialState
  let managers: ManagerRecord[] = []
  let sections: Record<string, SectionRecord> = { hero: { ...HERO }, about: { ...ABOUT } }
  let seoPages: Record<string, SeoRecord> = { home: { ...HOME_SEO } }

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
  const content: TelegramContentDeps = {
    getSection: vi.fn(async (key: string) => sections[key] ?? null),
    getSeo: vi.fn(async (pageKey: string) => seoPages[pageKey] ?? null),
  }
  const adminContent: AdminContentDeps = {
    updateSection: vi.fn(async (key: string, patch: Record<string, unknown>) => {
      if (!sections[key]) return { error: 'not_found' }
      sections[key] = applySectionPatch(sections[key], patch)
      return { error: null }
    }),
    updateSeo: vi.fn(async (pageKey: string, patch: Record<string, unknown>) => {
      if (!seoPages[pageKey]) return { error: 'not_found' }
      seoPages[pageKey] = applySeoPatch(seoPages[pageKey], patch)
      return { error: null }
    }),
    resetAll: vi.fn(async () => ({ error: null })),
  }
  const cardsDispatch: CardsDispatchDeps = {
    cards: { listProjects: vi.fn(async () => []), getProject: vi.fn(async () => null), listServices: vi.fn(async () => []), getService: vi.fn(async () => null) },
    adminCards: { create: vi.fn(async () => ({ error: null })), update: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })), reorder: vi.fn(async () => ({ error: null })) },
    adminUpload: { put: vi.fn(async () => ({ url: '', path: '', error: null })), del: vi.fn(async () => ({ error: null })) },
    sessions,
  }
  const requestsDispatch: RequestsDispatchDeps = {
    adminRequests: { list: vi.fn(async () => ({ rows: [], error: null })), patch: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })) },
    sessions,
  }
  const deps: DispatchDeps = { admins, sessions, content, adminContent, cardsDispatch, requestsDispatch }
  return {
    deps, admins, sessions, content, adminContent,
    getState: () => state,
    getManagers: () => managers,
    setManagers: (m: ManagerRecord[]) => (managers = m),
    getSections: () => sections,
    getSeoPages: () => seoPages,
  }
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

  it('an unknown id tapping a button still gets the callback answered (no stuck spinner)', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ fromId: 999, callbackData: 'stub:content' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.answerCallback).toHaveBeenCalled()
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
  it('stub:projects replies with a coming-soon message for anyone with access', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'stub:projects' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.answerCallback).toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'projects management is coming in a later update.' })
  })

  it('stub:requests replies with "no access" for a role that cannot see that section', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([MANAGER]) // content_manager — not allowed on the requests section
    const ctx = makeCtx({ fromId: 42, callbackData: 'stub:requests' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })
})

describe('dispatch — menu:main', () => {
  it('is reachable and resets state + shows the main menu', async () => {
    const { deps, sessions } = makeDeps({ screen: 'admins_list' })
    const ctx = makeCtx({ callbackData: 'menu:main' })
    await dispatch(ctx, ENV, deps)
    expect(sessions.save).toHaveBeenCalledWith(1, { screen: 'main_menu' }, ENV)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('ONVORX admin — choose a section:')
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

  it('shows an error and does not add the manager when addManager fails', async () => {
    const { deps, admins, getManagers } = makeDeps()
    ;(admins.addManager as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })

    await dispatch(makeCtx({ callbackData: 'admins:add' }), ENV, deps)
    await dispatch(makeCtx({ text: '42' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'admins:add:role:content_manager' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'Anna' })
    await dispatch(finalCtx, ENV, deps)

    expect(getManagers()).toEqual([])
    expect(finalCtx.reply).toHaveBeenCalledWith({ text: 'Could not add the manager — please try again.' })
  })

  it('shows an error and keeps the manager when removeManager fails', async () => {
    const { deps, admins, setManagers, getManagers } = makeDeps()
    setManagers([MANAGER])
    ;(admins.removeManager as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })

    await dispatch(makeCtx({ callbackData: 'admins:remove:42' }), ENV, deps)
    const confirmCtx = makeCtx({ callbackData: 'admins:remove:confirm:42' })
    await dispatch(confirmCtx, ENV, deps)

    expect(getManagers()).toEqual([MANAGER])
    expect(confirmCtx.reply).toHaveBeenCalledWith({ text: 'Could not remove the manager — please try again.' })
  })

  it('rejects a stale admins:add:role tap when the session has no pending telegramId', async () => {
    const { deps, getManagers } = makeDeps({ screen: 'main_menu' })
    const ctx = makeCtx({ callbackData: 'admins:add:role:content_manager' })
    await dispatch(ctx, ENV, deps)

    expect(getManagers()).toEqual([])
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Session out of sync — please /start and try again.' })
  })
})

describe('dispatch — free text fallback', () => {
  it('a non-owner sending free text gets a helpful hint instead of silence', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([MANAGER])
    const ctx = makeCtx({ fromId: 42, text: 'hello' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Use the menu buttons below, or /start to see them again.' })
  })

  it('an owner sending free text on main_menu (no flow in progress) gets a helpful hint', async () => {
    const { deps } = makeDeps({ screen: 'main_menu' })
    const ctx = makeCtx({ text: 'hello' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Use the menu buttons below, or /start to see them again.' })
  })
})

describe('dispatch — Content, owner + content_manager', () => {
  it('a sales_manager cannot open content:list', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, callbackData: 'content:list' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('owner opens content:list and sees the six blocks', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'content:list' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Content — choose a block:')
  })

  it('a content_manager opens a section detail and sees current EN/UA text', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([MANAGER])
    const ctx = makeCtx({ fromId: 42, callbackData: 'content:section:hero' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Built around your business')
    expect(reply.text).toContain('Створено під ваш бізнес')
  })

  it('an unknown section key shows an error and falls back to the list', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'content:section:bogus' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Could not load that section — please try again.' })
    const listReply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[1][0]
    expect(listReply.text).toBe('Content — choose a block:')
  })

  it('full edit flow: section -> field -> language -> new text -> saved, other language untouched', async () => {
    const { deps, getSections } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'content:section:hero' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:title' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:en' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'New English title' })
    await dispatch(finalCtx, ENV, deps)

    expect(getSections().hero.title).toEqual({ en: 'New English title', uk: 'Створено під ваш бізнес' })
    const reply = (finalCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
    expect(reply.text).toContain('New English title')
  })

  it('a content_manager can complete the full edit flow and save', async () => {
    const { deps, setManagers, getSections } = makeDeps()
    setManagers([MANAGER])
    await dispatch(makeCtx({ fromId: 42, callbackData: 'content:section:hero' }), ENV, deps)
    await dispatch(makeCtx({ fromId: 42, callbackData: 'content:field:title' }), ENV, deps)
    await dispatch(makeCtx({ fromId: 42, callbackData: 'content:lang:en' }), ENV, deps)
    const finalCtx = makeCtx({ fromId: 42, text: 'New English title' })
    await dispatch(finalCtx, ENV, deps)

    expect(getSections().hero.title).toEqual({ en: 'New English title', uk: 'Створено під ваш бізнес' })
  })

  it('editing UA preserves the existing EN text', async () => {
    const { deps, getSections } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'content:section:hero' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:body' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:uk' }), ENV, deps)
    await dispatch(makeCtx({ text: 'Новий текст' }), ENV, deps)

    expect(getSections().hero.body).toEqual({ en: 'We design and build.', uk: 'Новий текст' })
  })

  it('editing the CTA label on hero works and merges correctly', async () => {
    const { deps, getSections } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'content:section:hero' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:ctaLabel' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:en' }), ENV, deps)
    await dispatch(makeCtx({ text: 'Get a quote' }), ENV, deps)

    expect(getSections().hero.ctaLabel).toEqual({ en: 'Get a quote', uk: 'Отримати оцінку' })
  })

  it('about has no ctaLabel button, so its detail view never offers editing a null CTA label', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'content:section:about' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const buttonTexts = (reply.keyboard.inline_keyboard as { text: string }[][]).flat().map((b) => b.text)
    expect(buttonTexts).not.toContain('CTA label')
  })

  it('a stale field tap with no section chosen yet shows "session out of sync"', async () => {
    const { deps } = makeDeps({ screen: 'main_menu' })
    const ctx = makeCtx({ callbackData: 'content:field:title' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Session out of sync — please /start and try again.' })
  })

  it('a save failure shows an error with a Back button and does not change the record', async () => {
    const { deps, adminContent, getSections } = makeDeps()
    ;(adminContent.updateSection as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })
    await dispatch(makeCtx({ callbackData: 'content:section:hero' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:title' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:en' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'This should not stick' })
    await dispatch(finalCtx, ENV, deps)

    expect(getSections().hero.title).toEqual(HERO.title)
    expect(finalCtx.reply).toHaveBeenCalledWith({
      text: 'Could not save — please try again.',
      keyboard: expect.anything(),
    })
  })

  it('replies with a config error and does not call handleAdminContent when ADMIN_SESSION_SECRET is missing', async () => {
    const { deps, adminContent } = makeDeps()
    const badEnv = { TELEGRAM_ADMIN_IDS: '111' }
    await dispatch(makeCtx({ callbackData: 'content:section:hero' }), badEnv, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:title' }), badEnv, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:en' }), badEnv, deps)
    const finalCtx = makeCtx({ text: 'Anything' })
    await dispatch(finalCtx, badEnv, deps)

    expect(adminContent.updateSection).not.toHaveBeenCalled()
    expect(finalCtx.reply).toHaveBeenCalledWith({ text: 'Bot is not fully configured — contact the site owner.' })
  })
})

describe('dispatch — SEO, owner + content_manager', () => {
  it('a sales_manager cannot open seo:list', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, callbackData: 'seo:list' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('owner opens seo:list and sees all eight pages', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'seo:list' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('SEO — choose a page:')
  })

  it('full edit flow: page -> field -> language -> new text -> saved, other language untouched', async () => {
    const { deps, getSeoPages } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'seo:page:home' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'seo:field:description' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'seo:lang:en' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'New English description' })
    await dispatch(finalCtx, ENV, deps)

    expect(getSeoPages().home.description).toEqual({
      en: 'New English description',
      uk: 'Веб-рішення під ваш бізнес.',
    })
    const reply = (finalCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })

  it('an unknown page key shows an error and falls back to the list', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'seo:page:bogus' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Could not load that page — please try again.' })
  })

  it('a stale field tap with no page chosen yet shows "session out of sync"', async () => {
    const { deps } = makeDeps({ screen: 'main_menu' })
    const ctx = makeCtx({ callbackData: 'seo:field:title' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Session out of sync — please /start and try again.' })
  })

  it('a save failure shows an error with a Back button and does not change the record', async () => {
    const { deps, adminContent, getSeoPages } = makeDeps()
    ;(adminContent.updateSeo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })
    await dispatch(makeCtx({ callbackData: 'seo:page:home' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'seo:field:title' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'seo:lang:uk' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'Nope' })
    await dispatch(finalCtx, ENV, deps)

    expect(getSeoPages().home.title).toEqual(HOME_SEO.title)
    expect(finalCtx.reply).toHaveBeenCalledWith({
      text: 'Could not save — please try again.',
      keyboard: expect.anything(),
    })
  })
})

describe('dispatch — cards delegation', () => {
  it('cards:projects:list is reachable by a content_manager and shows the tab choice', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([MANAGER])
    const ctx = makeCtx({ fromId: 42, callbackData: 'cards:projects:list' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Projects — choose a list:')
  })

  it('cards:services:list is blocked for a sales_manager', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, callbackData: 'cards:services:list' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('text sent while awaiting a photo (cards_photo_wait) is delegated to dispatchCardsText, not the generic fallback', async () => {
    const { deps, setManagers } = makeDeps({
      screen: 'cards_photo_wait',
      data: { type: 'projects', list: 'home', id: 'a' },
    })
    setManagers([MANAGER])
    const ctx = makeCtx({ fromId: 42, text: 'oops, wrong message' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Please send a photo, or /start to cancel.' })
  })

  it('stub:projects no longer fires — the main menu now routes Projects to cards:projects:list', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ text: '/start' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const projectsButton = (reply.keyboard.inline_keyboard as { text: string; callback_data?: string }[][])
      .flat()
      .find((b) => b.text === 'Projects')
    expect(projectsButton?.callback_data).toBe('cards:projects:list')
  })
})

describe('dispatch — photo delegation', () => {
  it('a photo message from an unauthorized id gets "no access"', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ fromId: 999, photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('a photo message from a sales_manager gets "no access" (cards is content_manager-only)', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('a photo message whose download failed (isPhotoMessage true, no photoDataUrl) gets a clear reply, not silence', async () => {
    const { deps, sessions } = makeDeps({
      screen: 'cards_photo_wait',
      data: { type: 'projects', list: 'home', id: 'a' },
    })
    const ctx = makeCtx({ isPhotoMessage: true })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Could not process that photo — please try again.' })
    // session state is left untouched so a retry still lands on the same step
    expect(sessions.save).not.toHaveBeenCalled()
  })

  it('a failed-download photo message from an unauthorized id still gets the standard "no access" reply, not the photo-specific one', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ fromId: 999, isPhotoMessage: true })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('a failed-download photo message from a sales_manager gets "no access", not the photo-specific reply', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, isPhotoMessage: true })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })
})

describe('dispatch — requests delegation', () => {
  it('requests:list is reachable by a sales_manager and shows the filter menu', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, callbackData: 'requests:list' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Requests — filter by status:')
  })

  it('requests:list is blocked for a content_manager', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([MANAGER])
    const ctx = makeCtx({ fromId: 42, callbackData: 'requests:list' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('stub:requests no longer fires — the main menu now routes Requests to requests:list', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, text: '/start' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const requestsButton = (reply.keyboard.inline_keyboard as { text: string; callback_data?: string }[][])
      .flat()
      .find((b) => b.text === 'Requests')
    expect(requestsButton?.callback_data).toBe('requests:list')
  })
})
