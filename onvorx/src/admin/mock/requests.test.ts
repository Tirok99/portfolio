import { describe, it, expect } from 'vitest'
import { mockRequests } from './requests'

describe('mockRequests', () => {
  it('has unique ids and valid ISO timestamps', () => {
    const ids = new Set(mockRequests.map((r) => r.id))
    expect(ids.size).toBe(mockRequests.length)
    for (const r of mockRequests) {
      expect(new Date(r.createdAt).toISOString()).toBe(r.createdAt)
    }
  })

  it('covers every status and both locales', () => {
    const statuses = new Set(mockRequests.map((r) => r.status))
    expect(statuses).toEqual(
      new Set(['new', 'in_progress', 'done', 'archived']),
    )
    const locales = new Set(mockRequests.map((r) => r.locale))
    expect(locales).toEqual(new Set(['en', 'uk']))
  })
})
