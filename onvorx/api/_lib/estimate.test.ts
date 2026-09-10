import { describe, it, expect } from 'vitest'
import { validateEstimate } from './estimate'

const base = {
  name: 'Jane Roe',
  email: 'jane@roe.com',
  message: 'We need a new site.',
  locale: 'en',
}

describe('validateEstimate', () => {
  it('accepts a minimal valid body and normalizes optionals to null/[]', () => {
    const r = validateEstimate(base)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.row).toEqual({
        name: 'Jane Roe',
        email: 'jane@roe.com',
        company: null,
        budget: null,
        interested_in: [],
        message: 'We need a new site.',
        locale: 'en',
        source_page: null,
      })
    }
  })

  it('trims strings and keeps provided optionals', () => {
    const r = validateEstimate({
      ...base,
      name: '  Jane  ',
      company: '  Acme  ',
      budget: '3-10k',
      interestedIn: ['web-development', 'google-ads'],
      sourcePage: '/services',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.row.name).toBe('Jane')
      expect(r.row.company).toBe('Acme')
      expect(r.row.budget).toBe('3-10k')
      expect(r.row.interested_in).toEqual(['web-development', 'google-ads'])
      expect(r.row.source_page).toBe('/services')
    }
  })

  it('rejects a non-object body', () => {
    expect(validateEstimate(null).ok).toBe(false)
    expect(validateEstimate('x').ok).toBe(false)
  })

  it('rejects missing or blank required fields', () => {
    expect(validateEstimate({ ...base, name: '   ' }).ok).toBe(false)
    expect(validateEstimate({ ...base, email: '' }).ok).toBe(false)
    expect(validateEstimate({ ...base, message: undefined }).ok).toBe(false)
  })

  it('rejects an invalid email (same regex as the client)', () => {
    expect(validateEstimate({ ...base, email: 'not-an-email' }).ok).toBe(false)
  })

  it('rejects an unknown locale or budget', () => {
    expect(validateEstimate({ ...base, locale: 'de' }).ok).toBe(false)
    expect(validateEstimate({ ...base, budget: 'huge' }).ok).toBe(false)
  })

  it('drops non-string entries from interestedIn and caps the array', () => {
    const r = validateEstimate({ ...base, interestedIn: ['a', 2, null, 'b'] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.row.interested_in).toEqual(['a', 'b'])
    const many = validateEstimate({ ...base, interestedIn: Array(50).fill('x') })
    expect(many.ok).toBe(false)
  })

  it('rejects over-long fields', () => {
    expect(validateEstimate({ ...base, message: 'x'.repeat(5001) }).ok).toBe(false)
    expect(validateEstimate({ ...base, name: 'x'.repeat(201) }).ok).toBe(false)
  })

  it('rejects a filled honeypot field with error "honeypot"', () => {
    const r = validateEstimate({ ...base, company_url: 'http://spam.example' })
    expect(r).toEqual({ ok: false, error: 'honeypot' })
  })

  it('ignores an empty-string honeypot', () => {
    expect(validateEstimate({ ...base, company_url: '' }).ok).toBe(true)
  })
})
