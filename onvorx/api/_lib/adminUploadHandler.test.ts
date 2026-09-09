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
  it('400 when the decoded image exceeds 2 MB', async () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(3_000_000)
    expect((await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: big, fileName: 'x.png', folder: 'projects' } }, ENV, deps())).status).toBe(400)
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
