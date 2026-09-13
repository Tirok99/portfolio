import { describe, it, expect, vi } from 'vitest'
import { dispatchRequestsCallback, dispatchRequestsText } from './telegramRequestsDispatch'
import type { RequestsDispatchDeps } from './telegramRequestsDispatch'
import type { BotCtx } from './telegramDispatch'
import type { AdminRequestsDeps } from './adminRequestsHandler'
import type { TelegramSessionsDeps, TelegramState } from './telegramSessions'
import type { EstimateRequestDTO } from './adminRows'

const ENV = {
  ADMIN_SESSION_SECRET: 'a-long-enough-test-secret-value',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
}

const REQUEST_A: EstimateRequestDTO = {
  id: 'req-1', createdAt: '2026-09-10T14:05:00.000Z', status: 'new',
  name: 'Jane Doe', email: 'jane@example.com', company: 'Acme Inc', budget: '3-10k',
  interestedIn: ['web-development'], message: 'We need a new website.',
  locale: 'en', sourcePage: '/services', note: undefined,
}
const REQUEST_B: EstimateRequestDTO = {
  id: 'req-2', createdAt: '2026-09-11T09:30:00.000Z', status: 'archived',
  name: 'Ivan Petrenko', email: 'ivan@example.com', company: undefined, budget: undefined,
  interestedIn: [], message: 'Потрібен сайт.', locale: 'uk', sourcePage: undefined,
  note: 'Old lead.',
}

function makeDeps(initialState: TelegramState = { screen: 'main_menu' }) {
  let state = initialState
  let requests: EstimateRequestDTO[] = [{ ...REQUEST_A }, { ...REQUEST_B }]

  const adminRequests: AdminRequestsDeps = {
    list: vi.fn(async () => ({
      rows: requests.map((r) => ({
        id: r.id, created_at: r.createdAt, status: r.status, name: r.name, email: r.email,
        company: r.company, budget: r.budget, interested_in: r.interestedIn, message: r.message,
        locale: r.locale, source_page: r.sourcePage, note: r.note,
      })),
      error: null,
    })),
    patch: vi.fn(async (id: string, fields: Record<string, unknown>) => {
      requests = requests.map((r) => (r.id === id ? { ...r, ...fields } as EstimateRequestDTO : r))
      return { error: null }
    }),
    remove: vi.fn(async (id: string) => {
      requests = requests.filter((r) => r.id !== id)
      return { error: null }
    }),
  }
  const sessions: TelegramSessionsDeps = {
    load: vi.fn(async () => state),
    save: vi.fn(async (_chatId, next) => {
      state = next
    }),
  }
  const deps: RequestsDispatchDeps = { adminRequests, sessions }
  return { deps, adminRequests, sessions, getState: () => state, getRequests: () => requests }
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

describe('dispatchRequestsCallback — filter and list', () => {
  it('requests:list shows the filter menu', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:list', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Requests — filter by status:')
  })

  it('requests:filter:all lists every request, newest first', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:filter:all', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const buttons = (reply.keyboard.inline_keyboard as { text: string }[][]).flat().map((b) => b.text)
    expect(buttons[0]).toBe('Archived — Ivan Petrenko')
    expect(buttons[1]).toBe('New — Jane Doe')
  })

  it('requests:filter:new only shows matching requests', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:filter:new', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const buttons = (reply.keyboard.inline_keyboard as { text: string }[][]).flat().map((b) => b.text)
    expect(buttons).toEqual(['New — Jane Doe', '⬅ Back'])
  })
})

describe('dispatchRequestsCallback — detail', () => {
  it('requests:card:<id> shows the detail view', async () => {
    const { deps } = makeDeps({ screen: 'requests_list', data: { filter: 'all' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:card:req-1', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Jane Doe')
  })

  it('an unknown request id shows an error and falls back to the filter menu', async () => {
    const { deps } = makeDeps({ screen: 'requests_list', data: { filter: 'all' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:card:bogus', ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Could not load that request — please try again.' })
  })

  it('requests:back:list returns to the same filtered list', async () => {
    const { deps } = makeDeps({ screen: 'requests_detail', data: { filter: 'new', id: 'req-1' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:back:list', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const buttons = (reply.keyboard.inline_keyboard as { text: string }[][]).flat().map((b) => b.text)
    expect(buttons).toEqual(['New — Jane Doe', '⬅ Back'])
  })
})

describe('dispatchRequestsCallback — status change', () => {
  it('full flow: status -> new value -> saved, immediate apply', async () => {
    const { deps, getRequests } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:status', ENV, deps)
    const finalCtx = makeCtx({})
    await dispatchRequestsCallback(finalCtx, 'requests:status:done', ENV, deps)

    expect(getRequests().find((r) => r.id === 'req-1')?.status).toBe('done')
    const reply = (finalCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
    // buildRequestDetail (Task 1) surfaces the current status only as a keyboard
    // button label, never in the text body — check the button, not reply.text.
    const buttons = (reply.keyboard.inline_keyboard as { text: string }[][]).flat().map((b) => b.text)
    expect(buttons).toContain('Status: Done')
  })

  it('a stale status tap with no request chosen yet shows "session out of sync"', async () => {
    const { deps } = makeDeps({ screen: 'main_menu' })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:status:done', ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Session out of sync — please /start and try again.' })
  })
})

describe('dispatchRequestsCallback — note edit', () => {
  it('requests:note prompts for a new note, no keyboard', async () => {
    const { deps } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-2' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:note', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Old lead.')
    expect(reply.keyboard).toBeUndefined()
  })

  it('sending text while requests_note_value saves the note', async () => {
    const { deps, getRequests } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-1' } })
    const ctx = makeCtx({})
    await dispatchRequestsText(ctx, 'Called, will follow up next week.', ENV, deps)
    expect(getRequests().find((r) => r.id === 'req-1')?.note).toBe('Called, will follow up next week.')
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })
})

describe('dispatchRequestsCallback — delete', () => {
  it('delete -> confirm removes the request and returns to the list', async () => {
    const { deps, getRequests } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    await dispatchRequestsCallback(makeCtx({}), 'requests:delete', ENV, deps)
    const confirmCtx = makeCtx({})
    await dispatchRequestsCallback(confirmCtx, 'requests:delete:confirm', ENV, deps)
    expect(getRequests().find((r) => r.id === 'req-1')).toBeUndefined()
    const reply = (confirmCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Requests')
  })

  it('delete -> cancel keeps the request and returns to the detail', async () => {
    const { deps, getRequests } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    await dispatchRequestsCallback(makeCtx({}), 'requests:delete', ENV, deps)
    const cancelCtx = makeCtx({})
    await dispatchRequestsCallback(cancelCtx, 'requests:delete:cancel', ENV, deps)
    expect(getRequests().find((r) => r.id === 'req-1')).toBeDefined()
    const reply = (cancelCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Jane Doe')
  })

  it('a delete failure shows an error and stays recoverable via its Back button', async () => {
    const { deps, adminRequests, getRequests } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    ;(adminRequests.remove as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })
    await dispatchRequestsCallback(makeCtx({}), 'requests:delete', ENV, deps)
    const confirmCtx = makeCtx({})
    await dispatchRequestsCallback(confirmCtx, 'requests:delete:confirm', ENV, deps)

    expect(getRequests().find((r) => r.id === 'req-1')).toBeDefined()
    expect(confirmCtx.reply).toHaveBeenCalledWith({
      text: 'Could not save — please try again.',
      keyboard: expect.anything(),
    })
  })
})

describe('dispatchRequestsCallback — config error', () => {
  it('replies with a config error and does not call adminRequests.patch when ADMIN_SESSION_SECRET is missing', async () => {
    const { deps, adminRequests } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    const badEnv = {}
    await dispatchRequestsCallback(makeCtx({}), 'requests:status', badEnv, deps)
    const finalCtx = makeCtx({})
    await dispatchRequestsCallback(finalCtx, 'requests:status:done', badEnv, deps)

    expect(adminRequests.patch).not.toHaveBeenCalled()
    expect(finalCtx.reply).toHaveBeenCalledWith({ text: 'Bot is not fully configured — contact the site owner.' })
  })
})
