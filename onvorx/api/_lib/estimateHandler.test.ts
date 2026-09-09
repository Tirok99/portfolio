import { describe, it, expect, vi } from 'vitest'
import { handleEstimate } from './estimateHandler'

const ENV = { SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const goodBody = { name: 'Jane', email: 'jane@roe.com', message: 'Hi', locale: 'en' }

describe('handleEstimate', () => {
  it('405 on non-POST', async () => {
    const r = await handleEstimate({ method: 'GET', body: goodBody }, ENV)
    expect(r.status).toBe(405)
  })

  it('400 on an invalid body, without calling insert', async () => {
    const insert = vi.fn()
    const r = await handleEstimate({ method: 'POST', body: { name: '' } }, ENV, { insert })
    expect(r.status).toBe(400)
    expect(r.body).toEqual({ error: 'invalid_request' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('500 when Supabase env is not configured', async () => {
    const r = await handleEstimate({ method: 'POST', body: goodBody }, {})
    expect(r.status).toBe(500)
    expect(r.body).toEqual({ error: 'not_configured' })
  })

  it('inserts the validated row and returns 200 { ok: true }', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const r = await handleEstimate(
      { method: 'POST', body: { ...goodBody, company: 'Acme', interestedIn: ['x'] } },
      ENV,
      { insert },
    )
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true })
    const [row, passedEnv] = insert.mock.calls[0]
    expect(row).toEqual({
      name: 'Jane', email: 'jane@roe.com', company: 'Acme', budget: null,
      interested_in: ['x'], message: 'Hi', locale: 'en', source_page: null,
    })
    expect(row).not.toHaveProperty('status') // DB default applies
    expect(passedEnv).toBe(ENV)
  })

  it('500 { error: insert_failed } when the insert errors', async () => {
    const insert = vi.fn().mockResolvedValue({ error: 'boom' })
    const r = await handleEstimate({ method: 'POST', body: goodBody }, ENV, { insert })
    expect(r.status).toBe(500)
    expect(r.body).toEqual({ error: 'insert_failed' })
  })
})
