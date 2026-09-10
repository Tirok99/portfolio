import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { adminApi } from './api'

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('adminApi', () => {
  it('saveSection PUTs {kind:section,key,patch} with credentials', async () => {
    await adminApi.saveSection('hero', { title: { en: 'N', uk: 'N' } })
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/content', expect.objectContaining({
      method: 'PUT', credentials: 'same-origin',
    }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      kind: 'section', key: 'hero', patch: { title: { en: 'N', uk: 'N' } },
    })
  })
  it('createCard POSTs to /api/admin/cards?type=project', async () => {
    await adminApi.createCard('project', 'home', { id: 'p1' } as never)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/cards?type=project')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ list: 'home', card: { id: 'p1' } })
  })
  it('reorderCards POSTs {op:reorder,list,orderedIds}', async () => {
    await adminApi.reorderCards('service', 'page', ['a', 'b'])
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/cards?type=service')
    expect(JSON.parse(opts.body)).toEqual({ op: 'reorder', list: 'page', orderedIds: ['a', 'b'] })
  })
  it('uploadImage returns {url,path} from the response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'U', path: 'P' }) })
    const r = await adminApi.uploadImage('projects', 'data:image/png;base64,AA', 'x.png')
    expect(r).toEqual({ url: 'U', path: 'P' })
  })
  it('listRequests returns the requests array', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ requests: [{ id: 'r1' }] }) })
    expect(await adminApi.listRequests()).toEqual([{ id: 'r1' }])
  })
  it('throws on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'x' }) })
    await expect(adminApi.saveSeo('home', { title: { en: 'x', uk: 'x' } })).rejects.toThrow()
  })
})
