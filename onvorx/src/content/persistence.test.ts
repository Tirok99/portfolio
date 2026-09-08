import { describe, it, expect, beforeEach } from 'vitest'
import {
  STORAGE_KEY,
  loadAdminData,
  saveAdminData,
  seedAdminData,
} from './persistence'

beforeEach(() => {
  localStorage.clear()
})

describe('loadAdminData', () => {
  it('seeds and persists when storage is empty', () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    const data = loadAdminData()
    expect(data.sections).toHaveLength(6)
    expect(data.requests.length).toBeGreaterThan(0)
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('round-trips a saved store', () => {
    const seeded = seedAdminData()
    seeded.sections[0].title.en = 'Custom hero'
    saveAdminData(seeded)
    const loaded = loadAdminData()
    expect(loaded.sections[0].title.en).toBe('Custom hero')
  })

  it('reseeds on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{ not json')
    const data = loadAdminData()
    expect(data.sections).toHaveLength(6)
  })

  it('reseeds on version mismatch', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 0, sections: [] }),
    )
    const data = loadAdminData()
    expect(data.version).toBe(seedAdminData().version)
    expect(data.sections).toHaveLength(6)
  })
})
