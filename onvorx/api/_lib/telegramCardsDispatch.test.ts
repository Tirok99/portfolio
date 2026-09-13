import { describe, it, expect, vi } from 'vitest'
import { dispatchCardsCallback, dispatchCardsText, dispatchCardsPhoto } from './telegramCardsDispatch'
import type { CardsDispatchDeps } from './telegramCardsDispatch'
import type { BotCtx } from './telegramDispatch'
import type { TelegramCardsDeps, ProjectCardRecord, ServiceCardRecord } from './telegramCards'
import type { AdminCardsDeps } from './adminCardsHandler'
import type { AdminUploadDeps } from './adminUploadHandler'
import type { TelegramSessionsDeps, TelegramState } from './telegramSessions'

const ENV = { ADMIN_SESSION_SECRET: 'a-long-enough-test-secret-value', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }

const L = (en: string, uk: string) => ({ en, uk })

const PROJECT_A: ProjectCardRecord = {
  list: 'home', id: 'a', sort: 0, published: true,
  title: L('Alpha', 'Альфа'), tags: ['WordPress'],
  description: L('Alpha desc', 'Опис альфа'),
  imageUrl: 'https://x/a.jpg', imagePath: 'projects/a.jpg',
  imageAlt: L('Alpha image', 'Зображення альфа'),
}
const PROJECT_B: ProjectCardRecord = {
  list: 'home', id: 'b', sort: 1, published: false,
  title: L('Beta', 'Бета'), tags: [], description: L('', ''),
  imageUrl: null, imagePath: null, imageAlt: L('', ''),
}
const SERVICE_A: ServiceCardRecord = {
  list: 'home', id: 's1', sort: 0, published: true, featured: false,
  title: L('Web Dev', 'Веброзробка'), text: L('Build sites', 'Створення сайтів'),
  iconUrl: 'https://x/i.png', iconPath: 'services/i.png',
}

function applyProjectPatch(record: ProjectCardRecord, patch: Record<string, unknown>): ProjectCardRecord {
  const next = { ...record }
  if ('title' in patch) next.title = patch.title as ProjectCardRecord['title']
  if ('description' in patch) next.description = patch.description as ProjectCardRecord['description']
  if ('image_alt' in patch) next.imageAlt = patch.image_alt as ProjectCardRecord['imageAlt']
  if ('tags' in patch) next.tags = patch.tags as string[]
  if ('published' in patch) next.published = patch.published as boolean
  if ('image_url' in patch) next.imageUrl = patch.image_url as string | null
  if ('image_path' in patch) next.imagePath = patch.image_path as string | null
  return next
}
function applyServicePatch(record: ServiceCardRecord, patch: Record<string, unknown>): ServiceCardRecord {
  const next = { ...record }
  if ('title' in patch) next.title = patch.title as ServiceCardRecord['title']
  if ('text' in patch) next.text = patch.text as ServiceCardRecord['text']
  if ('published' in patch) next.published = patch.published as boolean
  if ('featured' in patch) next.featured = patch.featured as boolean
  if ('icon_url' in patch) next.iconUrl = patch.icon_url as string | null
  if ('icon_path' in patch) next.iconPath = patch.icon_path as string | null
  return next
}

function makeDeps(initialState: TelegramState = { screen: 'main_menu' }) {
  let state = initialState
  let projects: ProjectCardRecord[] = [{ ...PROJECT_A }, { ...PROJECT_B }]
  let services: ServiceCardRecord[] = [{ ...SERVICE_A }]

  const cards: TelegramCardsDeps = {
    listProjects: vi.fn(async () => projects),
    getProject: vi.fn(async (_list: string, id: string) => projects.find((p) => p.id === id) ?? null),
    listServices: vi.fn(async () => services),
    getService: vi.fn(async (_list: string, id: string) => services.find((s) => s.id === id) ?? null),
  }
  const adminCards: AdminCardsDeps = {
    create: vi.fn(async () => ({ error: null })),
    update: vi.fn(async (type: 'project' | 'service', _list, id: string, patch: Record<string, unknown>) => {
      if (type === 'project') projects = projects.map((p) => (p.id === id ? applyProjectPatch(p, patch) : p))
      else services = services.map((s) => (s.id === id ? applyServicePatch(s, patch) : s))
      return { error: null }
    }),
    remove: vi.fn(async (type: 'project' | 'service', _list, id: string) => {
      if (type === 'project') projects = projects.filter((p) => p.id !== id)
      else services = services.filter((s) => s.id !== id)
      return { error: null }
    }),
    reorder: vi.fn(async (type: 'project' | 'service', _list, orderedIds: string[]) => {
      const apply = <T extends { id: string; sort: number }>(list: T[]): T[] =>
        orderedIds.map((id, i) => ({ ...list.find((x) => x.id === id)!, sort: i }))
      if (type === 'project') projects = apply(projects)
      else services = apply(services)
      return { error: null }
    }),
  }
  const adminUpload: AdminUploadDeps = {
    put: vi.fn(async () => ({ url: '', path: '', error: 'not_used_in_this_task' })),
    del: vi.fn(async () => ({ error: null })),
  }
  const sessions: TelegramSessionsDeps = {
    load: vi.fn(async () => state),
    save: vi.fn(async (_chatId, next) => {
      state = next
    }),
  }
  const deps: CardsDispatchDeps = { cards, adminCards, adminUpload, sessions }
  return {
    deps, cards, adminCards, sessions,
    getState: () => state,
    getProjects: () => projects,
    getServices: () => services,
  }
}

function makeCtx(overrides: Partial<BotCtx>): BotCtx {
  return {
    chatId: 1,
    fromId: 111,
    reply: vi.fn(async () => {}),
    answerCallback: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('dispatchCardsCallback — list and detail', () => {
  it('cards:projects:list shows the tab choice', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:projects:list', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Projects — choose a list:')
  })

  it('cards:projects:tab:home lists the home cards', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:projects:tab:home', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Projects')
  })

  it('cards:card:<id> shows the project detail with position', async () => {
    const { deps } = makeDeps({ screen: 'cards_list', data: { type: 'projects', list: 'home' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:card:a', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Alpha')
    expect(reply.text).toContain('Position 1 of 2')
  })

  it('cards:card:<id> for services shows the service detail', async () => {
    const { deps } = makeDeps({ screen: 'cards_list', data: { type: 'services', list: 'home' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:card:s1', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Web Dev')
  })

  it('an unknown card id shows an error and falls back to the list', async () => {
    const { deps } = makeDeps({ screen: 'cards_list', data: { type: 'projects', list: 'home' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:card:bogus', ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Could not load that card — please try again.' })
  })
})

describe('dispatchCardsCallback — field edit flow (L fields)', () => {
  it('full edit flow: field -> lang -> new text -> saved, other language untouched', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:field:title', ENV, deps)
    await dispatchCardsCallback(makeCtx({}), 'cards:lang:en', ENV, deps)
    const finalCtx = makeCtx({})
    await dispatchCardsText(finalCtx, 'New English title', ENV, deps)

    expect(getProjects().find((p) => p.id === 'a')?.title).toEqual({ en: 'New English title', uk: 'Альфа' })
    const reply = (finalCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })

  it('editing a service text field works the same way', async () => {
    const { deps, getServices } = makeDeps({ screen: 'cards_detail', data: { type: 'services', list: 'home', id: 's1' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:field:text', ENV, deps)
    await dispatchCardsCallback(makeCtx({}), 'cards:lang:uk', ENV, deps)
    await dispatchCardsText(makeCtx({}), 'Новий текст', ENV, deps)

    expect(getServices().find((s) => s.id === 's1')?.text).toEqual({ en: 'Build sites', uk: 'Новий текст' })
  })

  it('a stale field tap with no card chosen yet shows "session out of sync"', async () => {
    const { deps } = makeDeps({ screen: 'main_menu' })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:field:title', ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Session out of sync — please /start and try again.' })
  })
})

describe('dispatchCardsCallback — tags (Projects only, no language split)', () => {
  it('editing tags goes straight to a text prompt, no language step', async () => {
    const { deps } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:field:tags', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('WordPress')
    expect(reply.keyboard).toBeUndefined()
  })

  it('saving tags splits on comma, trims, and drops empties', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:field:tags', ENV, deps)
    await dispatchCardsText(makeCtx({}), 'WordPress,  WooCommerce ,, Elementor', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.tags).toEqual(['WordPress', 'WooCommerce', 'Elementor'])
  })
})

describe('dispatchCardsCallback — toggles', () => {
  it('cards:toggle:published flips published and re-renders the detail', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:toggle:published', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.published).toBe(false)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const buttonTexts = (reply.keyboard.inline_keyboard as { text: string }[][]).flat().map((b) => b.text)
    expect(buttonTexts).toContain('🚫 Hidden (tap to publish)')
  })

  it('cards:toggle:featured flips featured for a service', async () => {
    const { deps, getServices } = makeDeps({ screen: 'cards_detail', data: { type: 'services', list: 'home', id: 's1' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:toggle:featured', ENV, deps)
    expect(getServices().find((s) => s.id === 's1')?.featured).toBe(true)
  })
})

describe('dispatchCardsCallback — reorder', () => {
  it('cards:move:down swaps the card with its next neighbour', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:move:down', ENV, deps)
    const sorted = [...getProjects()].sort((x, y) => x.sort - y.sort)
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('moving the first card up is a no-op', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:move:up', ENV, deps)
    const sorted = [...getProjects()].sort((x, y) => x.sort - y.sort)
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('moving the last card down is a no-op', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'b' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:move:down', ENV, deps)
    const sorted = [...getProjects()].sort((x, y) => x.sort - y.sort)
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('dispatchCardsCallback — delete', () => {
  it('delete -> confirm removes the card and returns to the list', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:delete', ENV, deps)
    const confirmCtx = makeCtx({})
    await dispatchCardsCallback(confirmCtx, 'cards:delete:confirm', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')).toBeUndefined()
    const reply = (confirmCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Projects')
  })

  it('delete -> cancel keeps the card and returns to the detail', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:delete', ENV, deps)
    const cancelCtx = makeCtx({})
    await dispatchCardsCallback(cancelCtx, 'cards:delete:cancel', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')).toBeDefined()
    const reply = (cancelCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Alpha')
  })
})

describe('dispatchCardsCallback — save failure', () => {
  it('shows an error and does not change the record', async () => {
    const { deps, adminCards, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    ;(adminCards.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })
    await dispatchCardsCallback(makeCtx({}), 'cards:field:title', ENV, deps)
    await dispatchCardsCallback(makeCtx({}), 'cards:lang:en', ENV, deps)
    const finalCtx = makeCtx({})
    await dispatchCardsText(finalCtx, 'Should not stick', ENV, deps)

    expect(getProjects().find((p) => p.id === 'a')?.title).toEqual(PROJECT_A.title)
    expect(finalCtx.reply).toHaveBeenCalledWith({
      text: 'Could not save — please try again.',
      keyboard: expect.anything(),
    })
  })

  it('replies with a config error and does not call adminCards.update when ADMIN_SESSION_SECRET is missing', async () => {
    const { deps, adminCards } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    const badEnv = {}
    await dispatchCardsCallback(makeCtx({}), 'cards:field:title', badEnv, deps)
    await dispatchCardsCallback(makeCtx({}), 'cards:lang:en', badEnv, deps)
    const finalCtx = makeCtx({})
    await dispatchCardsText(finalCtx, 'Anything', badEnv, deps)

    expect(adminCards.update).not.toHaveBeenCalled()
    expect(finalCtx.reply).toHaveBeenCalledWith({ text: 'Bot is not fully configured — contact the site owner.' })
  })
})

describe('dispatchCardsPhoto — replace flow', () => {
  it('cards:image:replace prompts for a photo', async () => {
    const { deps } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:image:replace', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe(
      'Send a new photo for this card. For an icon with a transparent background, send it as a file (not a photo) to keep the transparency.',
    )
  })

  it('a real photo uploads, updates the card, and best-effort deletes the old object', async () => {
    const { deps, getProjects } = makeDeps({
      screen: 'cards_photo_wait', data: { type: 'projects', list: 'home', id: 'a' },
    })
    const put = vi.fn(async () => ({ url: 'https://x/new.jpg', path: 'projects/new.jpg', error: null }))
    const del = vi.fn(async () => ({ error: null }))
    deps.adminUpload.put = put
    deps.adminUpload.del = del

    const ctx = makeCtx({ photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatchCardsPhoto(ctx, ENV, deps)

    // dispatchCardsPhoto routes through handleAdminUpload (not deps.adminUpload.put
    // directly), so the mock sees handleAdminUpload's decoded call shape: folder,
    // a server-generated storage key, the decoded bytes as a Buffer, the parsed
    // MIME type, and env — not the raw folder/dataUrl/fileName/env from the caller.
    expect(put).toHaveBeenCalledWith('projects', expect.any(String), expect.any(Buffer), 'image/jpeg', ENV)
    const updated = getProjects().find((p) => p.id === 'a')
    expect(updated?.imageUrl).toBe('https://x/new.jpg')
    // handleAdminUpload returns its own server-generated storage key as `path`
    // (ignoring whatever `path` the put dependency echoed back), so the saved
    // imagePath is that generated key, not the mock's literal 'projects/new.jpg'.
    expect(updated?.imagePath).toMatch(/^projects\/a-[0-9a-f]{8}\.jpg$/)
    expect(del).toHaveBeenCalledWith('projects/a.jpg', ENV) // PROJECT_A's original imagePath
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })

  it('does not delete the old object when there was none', async () => {
    const { deps } = makeDeps({ screen: 'cards_photo_wait', data: { type: 'projects', list: 'home', id: 'b' } })
    const del = vi.fn(async () => ({ error: null }))
    deps.adminUpload.put = vi.fn(async () => ({ url: 'https://x/new.jpg', path: 'projects/new.jpg', error: null }))
    deps.adminUpload.del = del
    const ctx = makeCtx({ photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatchCardsPhoto(ctx, ENV, deps)
    expect(del).not.toHaveBeenCalled()
  })

  it('a delete failure on the OLD object does not fail the save (best-effort)', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_photo_wait', data: { type: 'projects', list: 'home', id: 'a' } })
    deps.adminUpload.put = vi.fn(async () => ({ url: 'https://x/new.jpg', path: 'projects/new.jpg', error: null }))
    deps.adminUpload.del = vi.fn(async () => ({ error: 'boom' }))
    const ctx = makeCtx({ photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatchCardsPhoto(ctx, ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.imageUrl).toBe('https://x/new.jpg')
  })

  it('uploading for a service writes to the icon fields via the "services" folder', async () => {
    const { deps, getServices } = makeDeps({ screen: 'cards_photo_wait', data: { type: 'services', list: 'home', id: 's1' } })
    const put = vi.fn(async () => ({ url: 'https://x/new-icon.png', path: 'services/new-icon.png', error: null }))
    deps.adminUpload.put = put
    const ctx = makeCtx({ photoDataUrl: 'data:image/png;base64,BBBB' })
    await dispatchCardsPhoto(ctx, ENV, deps)
    expect(put).toHaveBeenCalledWith('services', expect.any(String), expect.any(Buffer), 'image/png', ENV)
    expect(getServices().find((s) => s.id === 's1')?.iconUrl).toBe('https://x/new-icon.png')
  })

  it('an upload failure shows an error and does not touch the record', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_photo_wait', data: { type: 'projects', list: 'home', id: 'a' } })
    deps.adminUpload.put = vi.fn(async () => ({ url: '', path: '', error: 'too_large' }))
    const ctx = makeCtx({ photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatchCardsPhoto(ctx, ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.imageUrl).toBe(PROJECT_A.imageUrl)
    // dispatchCardsPhoto reuses menu.buildCardSaveFailed for the upload-failure
    // reply, the same generic "could not save" message every other write
    // failure in this file uses (field save, tags save, toggle, reorder, delete).
    expect(ctx.reply).toHaveBeenCalledWith({
      text: 'Could not save — please try again.',
      keyboard: expect.anything(),
    })
  })

  it('an unprompted photo (session not in cards_photo_wait) is ignored — no upload, no delete, no change', async () => {
    const { deps, getProjects } = makeDeps({
      screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' },
    })
    const put = vi.fn(async () => ({ url: 'https://x/new.jpg', path: 'projects/new.jpg', error: null }))
    const del = vi.fn(async () => ({ error: null }))
    deps.adminUpload.put = put
    deps.adminUpload.del = del

    const ctx = makeCtx({ photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatchCardsPhoto(ctx, ENV, deps)

    expect(put).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
    expect(ctx.reply).not.toHaveBeenCalled()
    const updated = getProjects().find((p) => p.id === 'a')
    expect(updated?.imageUrl).toBe(PROJECT_A.imageUrl)
    expect(updated?.imagePath).toBe(PROJECT_A.imagePath)
  })

  it('receiving text instead of a photo asks for a photo again and does not touch the record', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_photo_wait', data: { type: 'projects', list: 'home', id: 'a' } })
    const ctx = makeCtx({ text: 'oops, wrong message' })
    await dispatchCardsText(ctx, 'oops, wrong message', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.imageUrl).toBe(PROJECT_A.imageUrl)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Please send a photo, or /start to cancel.' })
  })
})

describe('dispatchCardsCallback — cards:image:remove', () => {
  it('clears the ref first, then best-effort deletes the old object', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    const del = vi.fn(async () => ({ error: null }))
    deps.adminUpload.del = del
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:image:remove', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.imageUrl).toBeNull()
    expect(del).toHaveBeenCalledWith('projects/a.jpg', ENV)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })
})
