import { describe, it, expect } from 'vitest'
import {
  buildMainMenu,
  buildStubReply,
  buildNoAccessReply,
  buildAdminsList,
  buildAddIdPrompt,
  buildRolePrompt,
  buildLabelPrompt,
  buildRemoveConfirm,
  canAccessSection,
  buildContentList,
  buildSectionDetail,
  sectionFieldValue,
  buildContentFieldLangPrompt,
  buildContentValuePrompt,
  buildSeoList,
  buildSeoDetail,
  buildSeoFieldLangPrompt,
  buildSeoValuePrompt,
  buildSaveFailed,
} from './telegramMenu'
import type { ManagerRecord } from './telegramAdmins'
import type { SectionRecord, SeoRecord } from './telegramContent'

const readButtons = (reply: ReturnType<typeof buildMainMenu>) =>
  reply.keyboard!.inline_keyboard.flat().map((b) => ({ text: b.text, data: (b as { callback_data?: string }).callback_data }))

const MANAGER: ManagerRecord = {
  telegramId: 42,
  role: 'content_manager',
  label: 'Anna',
  addedBy: 111,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('buildMainMenu', () => {
  it('owner sees all six sections', () => {
    const buttons = readButtons(buildMainMenu('owner'))
    expect(buttons.map((b) => b.text)).toEqual([
      'Content', 'Projects', 'Services', 'SEO', 'Requests', 'Administrators',
    ])
    expect(buttons.find((b) => b.text === 'Administrators')?.data).toBe('menu:admins')
    expect(buttons.find((b) => b.text === 'Content')?.data).toBe('content:list')
    expect(buttons.find((b) => b.text === 'SEO')?.data).toBe('seo:list')
    expect(buttons.find((b) => b.text === 'Projects')?.data).toBe('stub:projects')
  })
  it('content_manager sees only content sections, no Administrators', () => {
    const buttons = readButtons(buildMainMenu('content_manager'))
    expect(buttons.map((b) => b.text)).toEqual(['Content', 'Projects', 'Services', 'SEO'])
  })
  it('sales_manager sees only Requests', () => {
    const buttons = readButtons(buildMainMenu('sales_manager'))
    expect(buttons.map((b) => b.text)).toEqual(['Requests'])
  })
})

describe('buildStubReply', () => {
  it('names the section', () => {
    expect(buildStubReply('Content').text).toContain('Content')
  })
})

describe('buildNoAccessReply', () => {
  it('has no keyboard', () => {
    expect(buildNoAccessReply().keyboard).toBeUndefined()
  })
})

describe('buildAdminsList', () => {
  it('empty list still offers Add manager and Back', () => {
    const r = buildAdminsList([])
    expect(readButtons(r).map((b) => b.text)).toEqual(['➕ Add manager', '⬅ Back'])
  })
  it('lists each manager with a remove button, then Add manager, then Back', () => {
    const r = buildAdminsList([MANAGER])
    expect(r.text).toContain('Anna')
    expect(r.text).toContain('Content manager')
    const buttons = readButtons(r)
    expect(buttons[0]).toEqual({ text: '🗑 Remove Anna', data: 'admins:remove:42' })
    expect(buttons[1].text).toBe('➕ Add manager')
    expect(buttons[2]).toEqual({ text: '⬅ Back', data: 'menu:main' })
  })
})

describe('canAccessSection', () => {
  it('owner can access admins', () => {
    expect(canAccessSection('owner', 'admins')).toBe(true)
  })
  it('content_manager can access content but not admins or requests', () => {
    expect(canAccessSection('content_manager', 'content')).toBe(true)
    expect(canAccessSection('content_manager', 'admins')).toBe(false)
    expect(canAccessSection('content_manager', 'requests')).toBe(false)
  })
  it('sales_manager can access requests but not content', () => {
    expect(canAccessSection('sales_manager', 'requests')).toBe(true)
    expect(canAccessSection('sales_manager', 'content')).toBe(false)
  })
  it('returns false for an unknown section key', () => {
    expect(canAccessSection('owner', 'not-a-real-section')).toBe(false)
  })
})

describe('add-manager prompts', () => {
  it('buildAddIdPrompt has no keyboard', () => {
    expect(buildAddIdPrompt().keyboard).toBeUndefined()
  })
  it('buildRolePrompt offers both roles', () => {
    const buttons = readButtons(buildRolePrompt())
    expect(buttons).toEqual([
      { text: 'Content manager', data: 'admins:add:role:content_manager' },
      { text: 'Sales manager', data: 'admins:add:role:sales_manager' },
    ])
  })
  it('buildLabelPrompt offers Skip', () => {
    expect(readButtons(buildLabelPrompt())).toEqual([{ text: 'Skip', data: 'admins:add:skip_label' }])
  })
})

describe('buildRemoveConfirm', () => {
  it('names the target and offers Yes/Cancel', () => {
    const r = buildRemoveConfirm(MANAGER)
    expect(r.text).toContain('Anna')
    expect(readButtons(r)).toEqual([
      { text: 'Yes, remove', data: 'admins:remove:confirm:42' },
      { text: 'Cancel', data: 'admins:remove:cancel' },
    ])
  })
  it('falls back to the numeric id when there is no label', () => {
    const noLabel = { ...MANAGER, label: null }
    expect(buildRemoveConfirm(noLabel).text).toContain('42')
  })
})

const L = (en: string, uk: string) => ({ en, uk })

const HERO: SectionRecord = {
  key: 'hero',
  eyebrow: L('Web solutions', 'Веб-рішення'),
  title: L('Built around your business', 'Створено під ваш бізнес'),
  body: L('We design and build.', 'Ми проєктуємо і будуємо.'),
  ctaLabel: L('Request an estimate', 'Отримати оцінку'),
}

const ABOUT: SectionRecord = {
  key: 'about',
  eyebrow: L('About', 'Про нас'),
  title: L('Who we are', 'Хто ми'),
  body: L('A small team.', 'Невелика команда.'),
  ctaLabel: null,
}

const HOME_SEO: SeoRecord = {
  pageKey: 'home',
  title: L('ONVORX', 'ONVORX'),
  description: L('Web solutions built around your business.', 'Веб-рішення під ваш бізнес.'),
}

describe('buildContentList', () => {
  it('lists all six blocks, each routing to content:section:<key>, then Back to menu:main', () => {
    const buttons = readButtons(buildContentList())
    expect(buttons).toEqual([
      { text: 'Hero', data: 'content:section:hero' },
      { text: 'Services', data: 'content:section:services' },
      { text: 'Projects', data: 'content:section:projects' },
      { text: 'How We Work', data: 'content:section:howWork' },
      { text: 'About', data: 'content:section:about' },
      { text: 'CTA', data: 'content:section:cta' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
})

describe('buildSectionDetail', () => {
  it('hero shows Eyebrow/Title/Body/CTA label buttons and current text for both languages', () => {
    const r = buildSectionDetail(HERO)
    expect(r.text).toContain('Built around your business')
    expect(r.text).toContain('Створено під ваш бізнес')
    expect(readButtons(r)).toEqual([
      { text: 'Eyebrow', data: 'content:field:eyebrow' },
      { text: 'Title', data: 'content:field:title' },
      { text: 'Body', data: 'content:field:body' },
      { text: 'CTA label', data: 'content:field:ctaLabel' },
      { text: '⬅ Back', data: 'content:list' },
    ])
  })
  it('about has no CTA label field or button (ctaLabel is null and about is not a CTA section)', () => {
    const r = buildSectionDetail(ABOUT)
    expect(r.text).not.toContain('CTA label')
    expect(readButtons(r).map((b) => b.text)).toEqual(['Eyebrow', 'Title', 'Body', '⬅ Back'])
  })
  it('prefixes "Saved." when opts.saved is true', () => {
    expect(buildSectionDetail(HERO, { saved: true }).text.startsWith('Saved.\n\n')).toBe(true)
  })
})

describe('sectionFieldValue', () => {
  it('reads a plain field', () => {
    expect(sectionFieldValue(HERO, 'title')).toEqual(HERO.title)
  })
  it('falls back to an empty L when ctaLabel is null', () => {
    expect(sectionFieldValue(ABOUT, 'ctaLabel')).toEqual({ en: '', uk: '' })
  })
})

describe('buildContentFieldLangPrompt', () => {
  it('offers EN/UA and a Back to the section detail', () => {
    const r = buildContentFieldLangPrompt('hero', 'title')
    expect(r.text).toContain('Title')
    expect(readButtons(r)).toEqual([
      { text: 'EN', data: 'content:lang:en' },
      { text: 'UA', data: 'content:lang:uk' },
      { text: '⬅ Back', data: 'content:section:hero' },
    ])
  })
})

describe('buildContentValuePrompt', () => {
  it('shows the current text and asks for the new one, no keyboard', () => {
    const r = buildContentValuePrompt('title', 'en', 'Built around your business')
    expect(r.text).toContain('Built around your business')
    expect(r.text).toContain('EN')
    expect(r.keyboard).toBeUndefined()
  })
  it('shows "(empty)" when there is no current text', () => {
    expect(buildContentValuePrompt('ctaLabel', 'uk', '').text).toContain('(empty)')
  })
})

describe('buildSeoList', () => {
  it('lists all eight pages, then Back to menu:main', () => {
    const buttons = readButtons(buildSeoList())
    expect(buttons).toEqual([
      { text: 'Home', data: 'seo:page:home' },
      { text: 'Services', data: 'seo:page:services' },
      { text: 'Projects', data: 'seo:page:projects' },
      { text: 'About', data: 'seo:page:about' },
      { text: 'Web Development', data: 'seo:page:web-development' },
      { text: 'Support', data: 'seo:page:support' },
      { text: 'Business Analysis', data: 'seo:page:business-analysis' },
      { text: 'Google Ads', data: 'seo:page:google-ads' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
})

describe('buildSeoDetail', () => {
  it('shows Title/Description buttons and current text for both languages', () => {
    const r = buildSeoDetail(HOME_SEO)
    expect(r.text).toContain('ONVORX')
    expect(readButtons(r)).toEqual([
      { text: 'Title', data: 'seo:field:title' },
      { text: 'Description', data: 'seo:field:description' },
      { text: '⬅ Back', data: 'seo:list' },
    ])
  })
  it('prefixes "Saved." when opts.saved is true', () => {
    expect(buildSeoDetail(HOME_SEO, { saved: true }).text.startsWith('Saved.\n\n')).toBe(true)
  })
})

describe('buildSeoFieldLangPrompt', () => {
  it('offers EN/UA and a Back to the page detail', () => {
    const r = buildSeoFieldLangPrompt('home', 'description')
    expect(readButtons(r)).toEqual([
      { text: 'EN', data: 'seo:lang:en' },
      { text: 'UA', data: 'seo:lang:uk' },
      { text: '⬅ Back', data: 'seo:page:home' },
    ])
  })
})

describe('buildSeoValuePrompt', () => {
  it('shows the current text and asks for the new one', () => {
    const r = buildSeoValuePrompt('title', 'uk', 'ONVORX')
    expect(r.text).toContain('ONVORX')
    expect(r.text).toContain('UA')
  })
})

describe('buildSaveFailed', () => {
  it('offers a Back button to the given callback', () => {
    const r = buildSaveFailed('content:section:hero')
    expect(r.text).toBe('Could not save — please try again.')
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'content:section:hero' }])
  })
})
