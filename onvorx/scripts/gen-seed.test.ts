import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildSeedSql, q } from './gen-seed'

/** Split an `insert ... values (a,b,c);` statement into its raw SQL literals. */
const argsOf = (stmt: string): string[] => {
  const body = stmt.slice(stmt.indexOf('values (') + 'values ('.length, stmt.lastIndexOf(');'))
  const out: string[] = []
  let cur = ''
  let inStr = false
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (inStr) {
      if (ch === "'" && body[i + 1] === "'") { cur += "''"; i += 1; continue }
      if (ch === "'") { inStr = false }
      cur += ch
      continue
    }
    if (ch === "'") { inStr = true; cur += ch; continue }
    if (ch === ',') { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

const SECTION_COLS = ['key', 'eyebrow', 'title', 'body', 'cta_label', 'cards', 'launch']

/** The JSON text behind one jsonb column of a site_sections insert, or `null`. */
const jsonbArg = (stmt: string, col: 'cards' | 'launch'): string | null => {
  const raw = argsOf(stmt)[SECTION_COLS.indexOf(col)]
  if (raw === 'null') return null
  const m = /^'([\s\S]*)'::jsonb$/.exec(raw)
  if (!m) throw new Error(`${col} is not a jsonb literal: ${raw}`)
  return m[1].replace(/''/g, "'")
}

describe('buildSeedSql', () => {
  const sql = buildSeedSql()
  const sectionInserts = sql
    .split('\n')
    .filter((l) => l.startsWith('insert into public.site_sections'))

  it('is idempotent-friendly: truncates before inserting', () => {
    expect(sql).toMatch(/truncate table public\.site_sections/i)
  })

  it('carries a loud DESTRUCTIVE banner above the truncate', () => {
    expect(sql).toMatch(/DESTRUCTIVE/)
    const banner = sql.indexOf('DESTRUCTIVE')
    expect(banner).toBeGreaterThan(-1)
    expect(banner).toBeLessThan(sql.search(/truncate table/i))
  })

  it('does not emit an explicit begin;/commit; wrapper (SQL Editor wraps for us)', () => {
    expect(sql).not.toMatch(/^\s*begin;\s*$/im)
    expect(sql).not.toMatch(/^\s*commit;\s*$/im)
  })

  it('inserts 7 sections, 8 seo pages', () => {
    expect(sql.match(/insert into public\.site_sections/gi) ?? []).toHaveLength(7)
    expect(sql.match(/insert into public\.seo_pages/gi) ?? []).toHaveLength(8)
  })

  it('emits the cards/launch columns on every site_sections insert', () => {
    for (const stmt of sectionInserts) {
      expect(stmt).toMatch(
        /insert into public\.site_sections \(key,eyebrow,title,body,cta_label,cards,launch\) values/,
      )
    }
  })

  it("emits hero's real cards and launch as jsonb literals, not empty/null", () => {
    const hero = sectionInserts.find((s) => s.includes("('hero',"))!
    expect(hero).toBeDefined()
    // 4 stat cards, each with an icon + both locales of title/text
    const cards = JSON.parse(jsonbArg(hero, 'cards')!) as {
      icon: { kind: string; src: string }
      title: { en: string; uk: string }
      text: { en: string; uk: string }
      sub?: unknown
    }[]
    expect(cards).toHaveLength(4)
    expect(cards[0].icon).toEqual({ kind: 'asset', src: '/assets/icons/hero-target-red.svg' })
    expect(cards[0].title.en).toBe('Business Goals')
    expect(cards[0].text.en).toBe('Define outcomes')
    expect(cards.every((c) => c.sub === undefined)).toBe(true)

    const launch = JSON.parse(jsonbArg(hero, 'launch')!) as {
      icon: { kind: string; src: string }
      title: { en: string }
    }
    expect(launch.icon.src).toBe('/assets/icons/hero-launch-check-circle-red.svg')
    expect(launch.title.en).toBe('Launch')
  })

  it("emits howWork's 4 cards with a sub field, and about's 3 without", () => {
    const howWork = sectionInserts.find((s) => s.includes("('howWork',"))!
    const steps = JSON.parse(jsonbArg(howWork, 'cards')!) as { sub?: { en: string } }[]
    expect(steps).toHaveLength(4)
    expect(steps.every((s) => typeof s.sub?.en === 'string' && s.sub.en.length > 0)).toBe(true)
    expect(jsonbArg(howWork, 'launch')).toBe(null)

    const about = sectionInserts.find((s) => s.includes("('about',"))!
    const stats = JSON.parse(jsonbArg(about, 'cards')!) as { sub?: unknown }[]
    expect(stats).toHaveLength(3)
    expect(stats.every((s) => s.sub === undefined)).toBe(true)
  })

  it('emits SQL null (not [] or {}) for sections with no cards/launch', () => {
    for (const key of ['services', 'projects', 'cta', 'footer']) {
      const stmt = sectionInserts.find((s) => s.includes(`('${key}',`))!
      expect(stmt, `missing insert for ${key}`).toBeDefined()
      expect(stmt.endsWith(',null,null);'), `${key} should end with ,null,null);`).toBe(true)
    }
  })

  it('emits a footer section row (allowed by the widened key constraint)', () => {
    expect(sectionInserts.some((s) => s.includes("('footer',"))).toBe(true)
    // schema.sql must permit it, or the generated seed fails on a fresh project
    const schema = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'schema.sql'),
      'utf8',
    )
    expect(schema).toMatch(/check \(key in \('hero','services','projects','howWork','about','cta','footer'\)\)/)
    expect(schema).toMatch(/^\s*cards\s+jsonb,$/m)
    expect(schema).toMatch(/^\s*launch\s+jsonb,$/m)
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

  it('q() SQL-escapes embedded single quotes by doubling them', () => {
    expect(q("Let's")).toBe("'Let''s'")
    expect(q('plain')).toBe("'plain'")
  })

  it('does NOT insert any estimate_requests', () => {
    expect(sql).not.toMatch(/insert into public\.estimate_requests/i)
  })
})
