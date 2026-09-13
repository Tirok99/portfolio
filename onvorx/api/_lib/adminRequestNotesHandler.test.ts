import { describe, it, expect, vi } from 'vitest'
import { handleAdminRequestNotes } from './adminRequestNotesHandler'
import { signToken, SESSION_COOKIE } from './session'

const SECRET = 'secret-secret-secret-secret-secret-secret'
const ENV = { ADMIN_SESSION_SECRET: SECRET, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const cookie = `${SESSION_COOKIE}=${signToken(SECRET)}`
const ROW = { id: 'n1', created_at: '2026-01-01T00:00:00Z', author: 'Admin (web)', body: 'hi' }
const deps = () => ({
  list: vi.fn().mockResolvedValue({ rows: [ROW], error: null }),
  add: vi.fn().mockResolvedValue({ error: null }),
})

describe('handleAdminRequestNotes', () => {
  it('401 without a session', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'GET', cookieHeader: undefined, query: { requestId: 'r1' }, body: undefined }, ENV, deps(),
    )
    expect(r.status).toBe(401)
  })
  it('500 when Supabase is not configured', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'GET', cookieHeader: cookie, query: { requestId: 'r1' }, body: undefined },
      { ADMIN_SESSION_SECRET: SECRET }, deps(),
    )
    expect(r.status).toBe(500)
  })
  it('GET requires a requestId query param → 400 without it', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'GET', cookieHeader: cookie, query: {}, body: undefined }, ENV, deps(),
    )
    expect(r.status).toBe(400)
  })
  it('GET → 200 with camelCase DTOs, newest first as returned by deps.list', async () => {
    const d = deps()
    const r = await handleAdminRequestNotes(
      { method: 'GET', cookieHeader: cookie, query: { requestId: 'r1' }, body: undefined }, ENV, d,
    )
    expect(d.list).toHaveBeenCalledWith('r1', ENV)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ notes: [{ id: 'n1', createdAt: '2026-01-01T00:00:00Z', author: 'Admin (web)', body: 'hi' }] })
  })
  it('GET → 500 on a list error', async () => {
    const d = deps(); d.list.mockResolvedValue({ rows: [], error: 'boom' })
    const r = await handleAdminRequestNotes(
      { method: 'GET', cookieHeader: cookie, query: { requestId: 'r1' }, body: undefined }, ENV, d,
    )
    expect(r.status).toBe(500)
  })
  it('POST → deps.add(requestId, author, body)', async () => {
    const d = deps()
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { requestId: 'r1', author: 'Admin (web)', body: 'called' } }, ENV, d,
    )
    expect(d.add).toHaveBeenCalledWith('r1', 'Admin (web)', 'called', ENV)
    expect(r.status).toBe(200)
  })
  it('POST missing requestId → 400, does not call deps.add', async () => {
    const d = deps()
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { author: 'Admin (web)', body: 'called' } }, ENV, d,
    )
    expect(r.status).toBe(400)
    expect(d.add).not.toHaveBeenCalled()
  })
  it('POST empty body text → 400', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { requestId: 'r1', author: 'Admin (web)', body: '   ' } }, ENV, deps(),
    )
    expect(r.status).toBe(400)
  })
  it('POST body over 500 chars → 400', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { requestId: 'r1', author: 'Admin (web)', body: 'x'.repeat(501) } }, ENV, deps(),
    )
    expect(r.status).toBe(400)
  })
  it('POST missing author → 400', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { requestId: 'r1', body: 'called' } }, ENV, deps(),
    )
    expect(r.status).toBe(400)
  })
  it('POST → 500 on a write error', async () => {
    const d = deps(); d.add.mockResolvedValue({ error: 'boom' })
    const r = await handleAdminRequestNotes(
      { method: 'POST', cookieHeader: cookie, body: { requestId: 'r1', author: 'Admin (web)', body: 'called' } }, ENV, d,
    )
    expect(r.status).toBe(500)
  })
  it('405 on an unsupported method', async () => {
    const r = await handleAdminRequestNotes(
      { method: 'DELETE', cookieHeader: cookie, body: {} }, ENV, deps(),
    )
    expect(r.status).toBe(405)
  })
})
