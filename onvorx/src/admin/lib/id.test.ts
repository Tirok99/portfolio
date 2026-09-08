import { describe, it, expect } from 'vitest'
import { newId } from './id'

describe('newId', () => {
  it('applies the prefix and is unique across calls', () => {
    const a = newId('proj')
    const b = newId('proj')
    expect(a.startsWith('proj_')).toBe(true)
    expect(a).not.toBe(b)
  })
})
