import { describe, it, expect, vi } from 'vitest'
import { handleAdminContent } from './adminContentHandler'
import { signToken, SESSION_COOKIE } from './session'

const SECRET = 'secret-secret-secret-secret-secret-secret'
const ENV = { ADMIN_SESSION_SECRET: SECRET, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const cookie = `${SESSION_COOKIE}=${signToken(SECRET)}`
const L = (s: string) => ({ en: s, uk: s })

const okDeps = () => ({
  updateSection: vi.fn().mockResolvedValue({ error: null }),
  updateSeo: vi.fn().mockResolvedValue({ error: null }),
  resetAll: vi.fn().mockResolvedValue({ error: null }),
})

describe('handleAdminContent', () => {
  it('401 without a valid session', async () => {
    const r = await handleAdminContent({ method: 'PUT', cookieHeader: undefined, body: {} }, ENV, okDeps())
    expect(r.status).toBe(401)
  })
  it('405 on an unsupported method', async () => {
    const r = await handleAdminContent({ method: 'GET', cookieHeader: cookie, body: {} }, ENV, okDeps())
    expect(r.status).toBe(405)
  })
  it('PUT a section: validates key + patch, calls updateSection with the row', async () => {
    const deps = okDeps()
    const r = await handleAdminContent(
      { method: 'PUT', cookieHeader: cookie, body: { kind: 'section', key: 'hero', patch: { title: L('New') } } },
      ENV, deps,
    )
    expect(r.status).toBe(200)
    expect(deps.updateSection).toHaveBeenCalledWith('hero', { title: L('New') }, ENV)
  })
  it('PUT a section with a bad key → 400', async () => {
    const r = await handleAdminContent(
      { method: 'PUT', cookieHeader: cookie, body: { kind: 'section', key: 'bogus', patch: { title: L('x') } } },
      ENV, okDeps(),
    )
    expect(r.status).toBe(400)
  })
  it('PUT a seo entry → updateSeo', async () => {
    const deps = okDeps()
    await handleAdminContent(
      { method: 'PUT', cookieHeader: cookie, body: { kind: 'seo', pageKey: 'home', patch: { description: L('D') } } },
      ENV, deps,
    )
    expect(deps.updateSeo).toHaveBeenCalledWith('home', { description: L('D') }, ENV)
  })
  it('POST reset → resetAll with the content payload', async () => {
    const deps = okDeps()
    const content = { sections: [], seo: [], projectsHome: [], projectsPage: [], servicesHome: [], servicesPage: [] }
    const r = await handleAdminContent({ method: 'POST', cookieHeader: cookie, body: { op: 'reset', content } }, ENV, deps)
    expect(r.status).toBe(200)
    expect(deps.resetAll).toHaveBeenCalledWith(content, ENV)
  })
  it('500 when a dep reports an error', async () => {
    const deps = okDeps()
    deps.updateSection.mockResolvedValue({ error: 'boom' })
    const r = await handleAdminContent(
      { method: 'PUT', cookieHeader: cookie, body: { kind: 'section', key: 'hero', patch: { title: L('x') } } },
      ENV, deps,
    )
    expect(r.status).toBe(500)
  })
  it('500 when SUPABASE env missing', async () => {
    const r = await handleAdminContent(
      { method: 'PUT', cookieHeader: cookie, body: { kind: 'section', key: 'hero', patch: { title: L('x') } } },
      { ADMIN_SESSION_SECRET: SECRET }, okDeps(),
    )
    expect(r.status).toBe(500)
  })
})
