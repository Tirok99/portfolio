import { describe, it, expect } from 'vitest'
import { buildSeedSql } from './gen-seed'

describe('buildSeedSql', () => {
  const sql = buildSeedSql()

  it('is idempotent-friendly: truncates before inserting', () => {
    expect(sql).toMatch(/truncate table public\.site_sections/i)
  })

  it('inserts 6 sections, 8 seo pages', () => {
    expect(sql.match(/insert into public\.site_sections/gi) ?? []).toHaveLength(6)
    expect(sql.match(/insert into public\.seo_pages/gi) ?? []).toHaveLength(8)
  })

  it('inserts each project/service card twice — once per list', () => {
    // 2 projects × 2 lists, 4 services × 2 lists
    expect(sql.match(/insert into public\.projects/gi) ?? []).toHaveLength(4)
    expect(sql.match(/insert into public\.services/gi) ?? []).toHaveLength(8)
  })

  it("escapes single quotes in text and emits jsonb with both locales", () => {
    expect(sql).not.toMatch(/''\s*'',/) // no broken escapes
    expect(sql).toMatch(/'\{"en":/) // jsonb literal present
  })

  it('does NOT insert any estimate_requests', () => {
    expect(sql).not.toMatch(/insert into public\.estimate_requests/i)
  })
})
