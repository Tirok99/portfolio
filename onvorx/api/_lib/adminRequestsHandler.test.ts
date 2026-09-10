import { describe, it, expect, vi } from 'vitest'
import { handleAdminRequests } from './adminRequestsHandler'
import { signToken, SESSION_COOKIE } from './session'

const SECRET = 'secret-secret-secret-secret-secret-secret'
const ENV = { ADMIN_SESSION_SECRET: SECRET, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const cookie = `${SESSION_COOKIE}=${signToken(SECRET)}`
const ROW = {
  id: 'r1', created_at: '2026-01-01T00:00:00Z', status: 'new', name: 'A', email: 'a@b.c',
  company: null, budget: null, interested_in: [], message: 'hi', locale: 'en', source_page: null, note: null,
}
const deps = () => ({
  list: vi.fn().mockResolvedValue({ rows: [ROW], error: null }),
  patch: vi.fn().mockResolvedValue({ error: null }),
  remove: vi.fn().mockResolvedValue({ error: null }),
})

describe('handleAdminRequests', () => {
  it('401 without a session', async () => {
    expect((await handleAdminRequests({ method: 'GET', cookieHeader: undefined, body: {} }, ENV, deps())).status).toBe(401)
  })
  it('GET → 200 with camelCase DTOs', async () => {
    const r = await handleAdminRequests({ method: 'GET', cookieHeader: cookie, body: {} }, ENV, deps())
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ requests: [expect.objectContaining({ id: 'r1', createdAt: '2026-01-01T00:00:00Z', interestedIn: [] })] })
  })
  it('PATCH status → deps.patch(id, {status})', async () => {
    const d = deps()
    await handleAdminRequests({ method: 'PATCH', cookieHeader: cookie, body: { id: 'r1', status: 'done' } }, ENV, d)
    expect(d.patch).toHaveBeenCalledWith('r1', { status: 'done' }, ENV)
  })
  it('PATCH bad status → 400', async () => {
    expect((await handleAdminRequests({ method: 'PATCH', cookieHeader: cookie, body: { id: 'r1', status: 'nope' } }, ENV, deps())).status).toBe(400)
  })
  it('PATCH note → deps.patch(id, {note})', async () => {
    const d = deps()
    await handleAdminRequests({ method: 'PATCH', cookieHeader: cookie, body: { id: 'r1', note: 'called' } }, ENV, d)
    expect(d.patch).toHaveBeenCalledWith('r1', { note: 'called' }, ENV)
  })
  it('DELETE → deps.remove(id)', async () => {
    const d = deps()
    await handleAdminRequests({ method: 'DELETE', cookieHeader: cookie, body: { id: 'r1' } }, ENV, d)
    expect(d.remove).toHaveBeenCalledWith('r1', ENV)
  })
  it('500 on a list error', async () => {
    const d = deps(); d.list.mockResolvedValue({ rows: [], error: 'boom' })
    expect((await handleAdminRequests({ method: 'GET', cookieHeader: cookie, body: {} }, ENV, d)).status).toBe(500)
  })
})
