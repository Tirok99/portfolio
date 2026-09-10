import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, __resetRateLimitForTest } from './estimateRateLimit'

beforeEach(() => __resetRateLimitForTest())

describe('checkRateLimit', () => {
  it('allows the first 5 requests from an IP within the window, blocks the 6th', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) expect(checkRateLimit('1.2.3.4', t + i * 1000)).toBe(true)
    expect(checkRateLimit('1.2.3.4', t + 6000)).toBe(false)
  })
  it('tracks IPs independently', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) checkRateLimit('1.1.1.1', t)
    expect(checkRateLimit('1.1.1.1', t)).toBe(false)
    expect(checkRateLimit('2.2.2.2', t)).toBe(true)
  })
  it('frees the slot after the 10-minute window passes', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) checkRateLimit('9.9.9.9', t)
    expect(checkRateLimit('9.9.9.9', t)).toBe(false)
    expect(checkRateLimit('9.9.9.9', t + 10 * 60 * 1000 + 1)).toBe(true)
  })
  it('an empty / unknown ip is allowed (never blocks on a missing IP)', () => {
    expect(checkRateLimit('', 1)).toBe(true)
  })
  it('bounds the hits map: a flood of distinct IPs clears earlier limits', () => {
    const t = 1_000_000
    // limit one IP, then flood past the 5000-entry cap
    for (let i = 0; i < 5; i++) checkRateLimit('7.7.7.7', t)
    expect(checkRateLimit('7.7.7.7', t)).toBe(false)
    for (let i = 0; i < 5100; i++) checkRateLimit(`10.${(i >> 8) & 255}.${i & 255}.1`, t)
    // the map was cleared along the way, so the previously-limited IP is allowed again
    expect(checkRateLimit('7.7.7.7', t)).toBe(true)
  })
})
