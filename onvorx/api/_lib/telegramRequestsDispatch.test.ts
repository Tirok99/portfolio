import { describe, it, expect, vi } from 'vitest'
import { dispatchRequestsCallback, dispatchRequestsText } from './telegramRequestsDispatch'
import type { RequestsDispatchDeps } from './telegramRequestsDispatch'
import type { BotCtx } from './telegramDispatch'
import type { AdminRequestsDeps } from './adminRequestsHandler'
import { type AdminRequestNotesDeps, type RequestNoteDTO } from './adminRequestNotesHandler'
import type { TelegramAdminsDeps, ManagerRecord } from './telegramAdmins'
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
  locale: 'en', sourcePage: '/services',
}
const REQUEST_B: EstimateRequestDTO = {
  id: 'req-2', createdAt: '2026-09-11T09:30:00.000Z', status: 'archived',
  name: 'Ivan Petrenko', email: 'ivan@example.com', company: undefined, budget: undefined,
  interestedIn: [], message: 'Потрібен сайт.', locale: 'uk', sourcePage: undefined,
}

function makeDeps(initialState: TelegramState = { screen: 'main_menu' }) {
  let state = initialState
  let requests: EstimateRequestDTO[] = [{ ...REQUEST_A }, { ...REQUEST_B }]
  let notesByRequest: Record<string, RequestNoteDTO[]> = {
    'req-2': [{ id: 'note-1', createdAt: '2026-09-09T08:00:00.000Z', author: 'Admin (web)', body: 'Old lead.' }],
  }
  let noteSeq = 2

  const adminRequests: AdminRequestsDeps = {
    list: vi.fn(async () => ({
      rows: requests.map((r) => ({
        id: r.id, created_at: r.createdAt, status: r.status, name: r.name, email: r.email,
        company: r.company, budget: r.budget, interested_in: r.interestedIn, message: r.message,
        locale: r.locale, source_page: r.sourcePage,
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
  const adminRequestNotes: AdminRequestNotesDeps = {
    list: vi.fn(async (requestId: string) => ({
      rows: (notesByRequest[requestId] ?? []).map((n) => ({
        id: n.id, created_at: n.createdAt, author: n.author, body: n.body,
      })),
      error: null,
    })),
    add: vi.fn(async (requestId: string, author: string, body: string) => {
      const note: RequestNoteDTO = { id: `note-${noteSeq++}`, createdAt: '2026-09-13T12:00:00.000Z', author, body }
      notesByRequest[requestId] = [note, ...(notesByRequest[requestId] ?? [])]
      return { error: null }
    }),
  }
  const admins: TelegramAdminsDeps = {
    findManager: vi.fn(async () => null as ManagerRecord | null),
    listManagers: vi.fn(async () => []),
    addManager: vi.fn(async () => ({ error: null })),
    removeManager: vi.fn(async () => ({ error: null })),
  }
  const sessions: TelegramSessionsDeps = {
    load: vi.fn(async () => state),
    save: vi.fn(async (_chatId, next) => {
      state = next
    }),
  }
  const deps: RequestsDispatchDeps = { adminRequests, adminRequestNotes, admins, sessions }
  return {
    deps, adminRequests, adminRequestNotes, admins, sessions,
    getState: () => state,
    getRequests: () => requests,
    getNotes: (requestId: string) => notesByRequest[requestId] ?? [],
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

  it('shows the title-cased current status (via STATUS_LABEL) instead of a raw underscore replace', async () => {
    const { deps } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    await dispatchRequestsCallback(makeCtx({}), 'requests:status', ENV, deps)
    await dispatchRequestsCallback(makeCtx({}), 'requests:status:in_progress', ENV, deps)

    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:status', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Current status: In Progress')
  })
})

describe('dispatchRequestsCallback — note edit', () => {
  it('requests:note prompts with the most recent note as context, no keyboard', async () => {
    const { deps } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-2' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:note', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Old lead.')
    expect(reply.text).toContain('Send the note text to add')
    expect(reply.keyboard).toBeUndefined()
  })

  it('requests:note shows "(no notes yet)" for a request with no notes', async () => {
    const { deps } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:note', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('(no notes yet)')
  })

  it('sending text while requests_note_value adds a new note without touching existing ones', async () => {
    const { deps, getNotes } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-2' } })
    const ctx = makeCtx({})
    await dispatchRequestsText(ctx, 'Called back today.', ENV, deps)
    const notes = getNotes('req-2')
    expect(notes).toHaveLength(2)
    expect(notes[0].body).toBe('Called back today.')
    expect(notes[1].body).toBe('Old lead.')
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })

  it('attributes a note added by the owner as "Owner"', async () => {
    const { deps, getNotes } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-1' } })
    const ownerEnv = { ...ENV, TELEGRAM_ADMIN_IDS: '111' }
    await dispatchRequestsText(makeCtx({}), 'From the owner.', ownerEnv, deps)
    expect(getNotes('req-1')[0].author).toBe('Owner')
  })

  it('attributes a note added by a labeled sales_manager', async () => {
    const { deps, admins, getNotes } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-1' } })
    ;(admins.findManager as ReturnType<typeof vi.fn>).mockResolvedValue({
      telegramId: 111, role: 'sales_manager', label: 'Sam', addedBy: 1, createdAt: '2026-01-01T00:00:00Z',
    })
    await dispatchRequestsText(makeCtx({}), 'From Sam.', ENV, deps)
    expect(getNotes('req-1')[0].author).toBe('Sam (sales_manager)')
  })

  it('falls back to a generic label for an unlabeled sales_manager', async () => {
    const { deps, admins, getNotes } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-1' } })
    ;(admins.findManager as ReturnType<typeof vi.fn>).mockResolvedValue({
      telegramId: 111, role: 'sales_manager', label: null, addedBy: 1, createdAt: '2026-01-01T00:00:00Z',
    })
    await dispatchRequestsText(makeCtx({}), 'From an unlabeled manager.', ENV, deps)
    expect(getNotes('req-1')[0].author).toBe('Sales manager')
  })

  it('a note over 500 characters is rejected with a specific message and never written', async () => {
    const { deps, adminRequestNotes } = makeDeps({ screen: 'requests_note_value', data: { filter: 'all', id: 'req-1' } })
    const ctx = makeCtx({})
    await dispatchRequestsText(ctx, 'x'.repeat(501), ENV, deps)
    expect(adminRequestNotes.add).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'That note is empty or too long — please send 1-500 characters.' })
  })
})

describe('dispatchRequestsCallback — notes history', () => {
  it('requests:notes:<id> shows the full history with a Back to the card', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:notes:req-2', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Old lead.')
    const buttons = (reply.keyboard.inline_keyboard as { text: string; callback_data: string }[][]).flat()
    expect(buttons).toEqual([{ text: '⬅ Back', callback_data: 'requests:card:req-2' }])
  })

  it('requests:notes:<id> replies with a config error when ADMIN_SESSION_SECRET is missing', async () => {
    const { deps, adminRequestNotes } = makeDeps()
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:notes:req-2', {}, deps)
    expect(adminRequestNotes.list).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Bot is not fully configured — contact the site owner.' })
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
    const { deps, adminRequests, getRequests, getState } = makeDeps({ screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } })
    ;(adminRequests.remove as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })
    await dispatchRequestsCallback(makeCtx({}), 'requests:delete', ENV, deps)
    const confirmCtx = makeCtx({})
    await dispatchRequestsCallback(confirmCtx, 'requests:delete:confirm', ENV, deps)

    expect(getRequests().find((r) => r.id === 'req-1')).toBeDefined()
    expect(confirmCtx.reply).toHaveBeenCalledWith({
      text: 'Could not save — please try again.',
      keyboard: expect.anything(),
    })
    expect(getState()).toEqual({ screen: 'requests_delete_confirm', data: { filter: 'all', id: 'req-1' } })
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

  it('requests:card:<id> replies with a config error and leaves the session untouched when ADMIN_SESSION_SECRET is missing', async () => {
    const initialState: TelegramState = { screen: 'requests_detail', data: { filter: 'all', id: 'req-1' } }
    const { deps, getState } = makeDeps(initialState)
    const badEnv = {}
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:card:req-1', badEnv, deps)

    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Bot is not fully configured — contact the site owner.' })
    // showDetail's fetchRequests call is itself auth-gated — under a missing
    // secret it must fail fast rather than being misread as "no such request"
    // and resetting the session to the (data-less) filter menu.
    expect(getState()).toEqual(initialState)
  })

  it('requests:filter:<x> replies with a config error, not "no requests match", when ADMIN_SESSION_SECRET is missing', async () => {
    const { deps } = makeDeps()
    const badEnv = {}
    const ctx = makeCtx({})
    await dispatchRequestsCallback(ctx, 'requests:filter:new', badEnv, deps)

    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Bot is not fully configured — contact the site owner.' })
  })
})
