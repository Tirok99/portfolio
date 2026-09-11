import { describe, it, expect, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))

import { handleAdminCards, createCardDefault, reorderCardsDefault } from './adminCardsHandler'
import { signToken, SESSION_COOKIE } from './session'

const SECRET = 'secret-secret-secret-secret-secret-secret'
const ENV = { ADMIN_SESSION_SECRET: SECRET, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const cookie = `${SESSION_COOKIE}=${signToken(SECRET)}`
const q = (type = 'project') => ({ type })

const deps = () => ({
  create: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn().mockResolvedValue({ error: null }),
  remove: vi.fn().mockResolvedValue({ error: null }),
  reorder: vi.fn().mockResolvedValue({ error: null }),
})

describe('handleAdminCards', () => {
  it('401 without a session', async () => {
    expect((await handleAdminCards({ method: 'POST', cookieHeader: undefined, query: q(), body: {} }, ENV, deps())).status).toBe(401)
  })
  it('400 on a bad ?type', async () => {
    expect((await handleAdminCards({ method: 'POST', cookieHeader: cookie, query: { type: 'x' }, body: {} }, ENV, deps())).status).toBe(400)
  })
  it('POST create → deps.create(type,list,row) without a client sort', async () => {
    const d = deps()
    const body = { list: 'home', card: { id: 'proj_1', order: 2, published: false, title: { en: 'N', uk: 'N' } } }
    const r = await handleAdminCards({ method: 'POST', cookieHeader: cookie, query: q('project'), body }, ENV, d)
    expect(r.status).toBe(200)
    expect(d.create).toHaveBeenCalledWith('project', 'home',
      expect.objectContaining({ list: 'home', id: 'proj_1', published: false, title: { en: 'N', uk: 'N' } }), ENV)
    // `sort` is server-derived (defaultDeps.create) — the handler must not
    // forward the client-supplied index.
    const row = d.create.mock.calls[0][2] as Record<string, unknown>
    expect(row).not.toHaveProperty('sort')
  })
  it('PUT update → deps.update(type,list,id,row)', async () => {
    const d = deps()
    await handleAdminCards({ method: 'PUT', cookieHeader: cookie, query: q('service'),
      body: { list: 'page', id: 's1', patch: { published: true } } }, ENV, d)
    expect(d.update).toHaveBeenCalledWith('service', 'page', 's1', { published: true }, ENV)
  })
  it('DELETE → deps.remove(type,list,id)', async () => {
    const d = deps()
    await handleAdminCards({ method: 'DELETE', cookieHeader: cookie, query: q('project'),
      body: { list: 'home', id: 'p1' } }, ENV, d)
    expect(d.remove).toHaveBeenCalledWith('project', 'home', 'p1', ENV)
  })
  it('POST reorder → deps.reorder(type,list,orderedIds)', async () => {
    const d = deps()
    await handleAdminCards({ method: 'POST', cookieHeader: cookie, query: q('project'),
      body: { op: 'reorder', list: 'home', orderedIds: ['a', 'b', 'c'] } }, ENV, d)
    expect(d.reorder).toHaveBeenCalledWith('project', 'home', ['a', 'b', 'c'], ENV)
  })
  it('400 when create body has no id', async () => {
    expect((await handleAdminCards({ method: 'POST', cookieHeader: cookie, query: q(),
      body: { list: 'home', card: { title: { en: 'x', uk: 'x' } } } }, ENV, deps())).status).toBe(400)
  })
  it('500 on a dep error', async () => {
    const d = deps(); d.update.mockResolvedValue({ error: 'boom' })
    expect((await handleAdminCards({ method: 'PUT', cookieHeader: cookie, query: q(),
      body: { list: 'home', id: 'p1', patch: { published: true } } }, ENV, d)).status).toBe(500)
  })
})

describe('createCardDefault — DB-assigned sort + retry on unique violation', () => {
  it('inserts without a client sort and retries once on a 23505, then succeeds', async () => {
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } })
      .mockResolvedValueOnce({ error: null })
    const from = vi.fn(() => ({ insert }))
    createClientMock.mockReturnValue({ from })

    const res = await createCardDefault('project', 'home',
      { id: 'proj_1', sort: 7, published: false, title: { en: 'N', uk: 'N' } }, ENV)

    expect(res).toEqual({ error: null })
    expect(insert).toHaveBeenCalledTimes(2)
    expect(from).toHaveBeenCalledWith('projects')
    const sent = insert.mock.calls[0][0] as Record<string, unknown>
    expect(sent).not.toHaveProperty('sort')
    expect(sent).toMatchObject({ list: 'home', id: 'proj_1', published: false })
  })

  it('gives up with sort_conflict after 3 failed attempts', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'dup' } })
    createClientMock.mockReturnValue({ from: () => ({ insert }) })
    const res = await createCardDefault('service', 'page', { id: 's1' }, ENV)
    expect(res).toEqual({ error: 'sort_conflict' })
    expect(insert).toHaveBeenCalledTimes(3)
  })

  it('returns the message on a non-23505 error without retrying', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: '23502', message: 'null value' } })
    createClientMock.mockReturnValue({ from: () => ({ insert }) })
    const res = await createCardDefault('project', 'home', { id: 'p2' }, ENV)
    expect(res).toEqual({ error: 'null value' })
    expect(insert).toHaveBeenCalledTimes(1)
  })
})

// A fake client that tracks (list, sort) pairs the way `unique (list, sort)`
// does, and rejects any `.update()` that would create a duplicate.
function makeSortTrackingClient(initial: { id: string; list: string; sort: number }[]) {
  const rows = new Map(initial.map((r) => [r.id, { ...r }]))
  return {
    rows,
    from: () => ({
      update: (patch: { sort: number }) => ({
        eq: (_col: string, listVal: string) => ({
          eq: (_col2: string, idVal: string) => {
            const row = rows.get(idVal)!
            const nextSort = patch.sort
            for (const [oid, orow] of rows) {
              if (oid !== idVal && orow.list === listVal && orow.sort === nextSort) {
                return Promise.resolve({ error: { code: '23505' } })
              }
            }
            row.sort = nextSort
            return Promise.resolve({ error: null })
          },
        }),
      }),
    }),
  }
}

describe('reorderCardsDefault — two-pass avoids the unique(list,sort) collision', () => {
  it('reorders a,b,c -> b,a,c with no transient 23505', async () => {
    const fake = makeSortTrackingClient([
      { id: 'a', list: 'home', sort: 0 },
      { id: 'b', list: 'home', sort: 1 },
      { id: 'c', list: 'home', sort: 2 },
    ])
    createClientMock.mockReturnValue({ from: fake.from })

    const res = await reorderCardsDefault('project', 'home', ['b', 'a', 'c'], ENV)

    expect(res).toEqual({ error: null })
    expect(fake.rows.get('a')!.sort).toBe(1)
    expect(fake.rows.get('b')!.sort).toBe(0)
    expect(fake.rows.get('c')!.sort).toBe(2)
  })
})
