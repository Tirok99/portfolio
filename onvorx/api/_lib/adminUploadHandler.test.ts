import { describe, it, expect, vi } from 'vitest'
import { handleAdminUpload } from './adminUploadHandler'
import { signToken, SESSION_COOKIE } from './session'

const SECRET = 'secret-secret-secret-secret-secret-secret'
const ENV = { ADMIN_SESSION_SECRET: SECRET, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const cookie = `${SESSION_COOKIE}=${signToken(SECRET)}`
// 1x1 png
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const deps = () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://cdn/public-media/projects/x-ab12cd34.png', path: 'projects/x-ab12cd34.png', error: null }),
  del: vi.fn().mockResolvedValue({ error: null }),
})

describe('handleAdminUpload', () => {
  it('401 without a session', async () => {
    expect((await handleAdminUpload({ method: 'POST', cookieHeader: undefined, body: {} }, ENV, deps())).status).toBe(401)
  })
  it('400 on a non-image data URL', async () => {
    expect((await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: 'data:text/plain;base64,aGk=', fileName: 'x.txt', folder: 'projects' } }, ENV, deps())).status).toBe(400)
  })
  it('400 on an unknown folder', async () => {
    expect((await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: PNG, fileName: 'x.png', folder: 'evil' } }, ENV, deps())).status).toBe(400)
  })
  it('accepts the cards folder for uploads', async () => {
    const d = deps()
    const r = await handleAdminUpload(
      { method: 'POST', cookieHeader: cookie, body: { dataUrl: PNG, fileName: 'icon.png', folder: 'cards' } },
      ENV, d,
    )
    expect(r.status).toBe(200)
  })
  it('400 when the decoded image exceeds 2 MB', async () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(3_000_000)
    expect((await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: big, fileName: 'x.png', folder: 'projects' } }, ENV, deps())).status).toBe(400)
  })
  it('accepts a clean svg and stores it as-is', async () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>'
    const svg = 'data:image/svg+xml;base64,' + Buffer.from(raw).toString('base64')
    const d = deps()
    const r = await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: svg, fileName: 'x.svg', folder: 'cards' } }, ENV, d)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ url: expect.any(String), path: expect.stringMatching(/^cards\/x-[0-9a-f]{8}\.svg$/) })
    const stored = (d.put.mock.calls[0][2] as Buffer).toString('utf8')
    expect(stored).toContain('<circle')
  })
  it('strips a <script> and an onload handler from an uploaded svg instead of storing them', async () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect width="10" height="10"/></svg>'
    const svg = 'data:image/svg+xml;base64,' + Buffer.from(raw).toString('base64')
    const d = deps()
    const r = await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: svg, fileName: 'evil.svg', folder: 'cards' } }, ENV, d)
    expect(r.status).toBe(200)
    const stored = (d.put.mock.calls[0][2] as Buffer).toString('utf8')
    expect(stored).not.toContain('<script')
    expect(stored).not.toContain('onload')
    expect(stored).toContain('<rect')
  })
  it('400 on an svg that sanitizes down to nothing usable', async () => {
    const svg = 'data:image/svg+xml;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64')
    expect((await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: svg, fileName: 'x.svg', folder: 'cards' } }, ENV, deps())).status).toBe(400)
  })
  it('POST a valid png → deps.put with a projects/<slug>-<hex>.png key, returns {url,path}', async () => {
    const d = deps()
    const r = await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: PNG, fileName: 'My Photo.PNG', folder: 'projects' } }, ENV, d)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ url: expect.any(String), path: expect.stringMatching(/^projects\/my-photo-[0-9a-f]{8}\.png$/) })
    expect(d.put).toHaveBeenCalledWith(
      'projects', expect.stringMatching(/^projects\/my-photo-[0-9a-f]{8}\.png$/),
      expect.any(Buffer), 'image/png', ENV,
    )
  })
  it('DELETE { path } → deps.del', async () => {
    const d = deps()
    const r = await handleAdminUpload({ method: 'DELETE', cookieHeader: cookie, body: { path: 'projects/x.png' } }, ENV, d)
    expect(r.status).toBe(200)
    expect(d.del).toHaveBeenCalledWith('projects/x.png', ENV)
  })
  it('DELETE rejects a path outside the two folders', async () => {
    expect((await handleAdminUpload({ method: 'DELETE', cookieHeader: cookie, body: { path: '../secrets' } }, ENV, deps())).status).toBe(400)
  })
})
