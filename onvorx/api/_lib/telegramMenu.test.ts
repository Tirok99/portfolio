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
  buildCardTypeTabs,
  buildProjectList,
  buildServiceList,
  buildProjectDetail,
  buildServiceDetail,
  buildCardFieldLangPrompt,
  buildCardValuePrompt,
  buildTagsPrompt,
  buildPhotoPrompt,
  buildCardDeleteConfirm,
  buildCardSaveFailed,
  buildRequestFilterMenu,
  buildRequestList,
  buildRequestDetail,
  buildRequestStatusPrompt,
  buildRequestNotePrompt,
  buildRequestDeleteConfirm,
} from './telegramMenu'
import type { ManagerRecord } from './telegramAdmins'
import type { SectionRecord, SeoRecord } from './telegramContent'
import type { ProjectCardRecord, ServiceCardRecord } from './telegramCards'
import type { EstimateRequestDTO } from './adminRows'

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
    expect(buttons.find((b) => b.text === 'Projects')?.data).toBe('cards:projects:list')
    expect(buttons.find((b) => b.text === 'Services')?.data).toBe('cards:services:list')
    expect(buttons.find((b) => b.text === 'Requests')?.data).toBe('requests:list')
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

const PROJECT_A: ProjectCardRecord = {
  list: 'home', id: 'encryptia-cloud', sort: 0, published: true,
  title: L('Encryptia Cloud', 'Encryptia Cloud'),
  tags: ['WordPress'],
  description: L('Website implementation for a cloud-focused business.', 'Реалізація сайту для хмарного бізнесу.'),
  imageUrl: 'https://example.supabase.co/storage/v1/object/public/public-media/projects/encryptia-abcd.jpg',
  imagePath: 'projects/encryptia-abcd.jpg',
  imageAlt: L('Encryptia Cloud website shown on a laptop', 'Сайт Encryptia Cloud на ноутбуці'),
}
const PROJECT_NO_IMAGE: ProjectCardRecord = {
  list: 'home', id: 'no-image', sort: 1, published: false,
  title: L('Draft', 'Чернетка'), tags: [], description: L('', ''),
  imageUrl: null, imagePath: null, imageAlt: L('', ''),
}
const SERVICE_A: ServiceCardRecord = {
  list: 'home', id: 'web-development', sort: 0, published: true, featured: true,
  title: L('Web Development', 'Веб-розробка'),
  text: L('Build a new website.', 'Створення нового сайту.'),
  iconUrl: 'https://example.supabase.co/storage/v1/object/public/public-media/services/icon.png',
  iconPath: 'services/icon.png',
}

describe('buildCardTypeTabs', () => {
  it('projects: "On the home page" / "Projects page"', () => {
    const buttons = readButtons(buildCardTypeTabs('projects'))
    expect(buttons).toEqual([
      { text: 'On the home page', data: 'cards:projects:tab:home' },
      { text: 'Projects page', data: 'cards:projects:tab:page' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
  it('services: "On the home page" / "Services page"', () => {
    const buttons = readButtons(buildCardTypeTabs('services'))
    expect(buttons).toEqual([
      { text: 'On the home page', data: 'cards:services:tab:home' },
      { text: 'Services page', data: 'cards:services:tab:page' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
})

describe('buildProjectList', () => {
  it('shows each card with a published marker, then Back', () => {
    const r = buildProjectList('home', [PROJECT_A, PROJECT_NO_IMAGE])
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: '✅ Encryptia Cloud', data: 'cards:card:encryptia-cloud' },
      { text: '🚫 Draft', data: 'cards:card:no-image' },
      { text: '⬅ Back', data: 'cards:projects:list' },
    ])
  })
  it('empty list still offers Back', () => {
    const r = buildProjectList('page', [])
    expect(r.text).toContain('No cards')
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'cards:projects:list' }])
  })
})

describe('buildServiceList', () => {
  it('shows each card with a published marker, then Back', () => {
    const buttons = readButtons(buildServiceList('home', [SERVICE_A]))
    expect(buttons).toEqual([
      { text: '✅ Web Development', data: 'cards:card:web-development' },
      { text: '⬅ Back', data: 'cards:services:list' },
    ])
  })
})

describe('buildProjectDetail', () => {
  it('shows fields, tags, image state, published toggle, move, delete, back', () => {
    const r = buildProjectDetail(PROJECT_A, { index: 0, total: 2 })
    expect(r.text).toContain('Position 1 of 2')
    expect(r.text).toContain('Encryptia Cloud')
    expect(r.text).toContain('WordPress')
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: 'Title', data: 'cards:field:title' },
      { text: 'Description', data: 'cards:field:description' },
      { text: 'Tags', data: 'cards:field:tags' },
      { text: 'Image alt text', data: 'cards:field:imageAlt' },
      { text: '🖼 Replace image', data: 'cards:image:replace' },
      { text: '🗑 Remove image', data: 'cards:image:remove' },
      { text: '✅ Published (tap to hide)', data: 'cards:toggle:published' },
      { text: '▲ Move up', data: 'cards:move:up' },
      { text: '▼ Move down', data: 'cards:move:down' },
      { text: '🗑 Delete card', data: 'cards:delete' },
      { text: '⬅ Back', data: 'cards:back:list' },
    ])
  })
  it('omits "Remove image" when there is no image', () => {
    const buttons = readButtons(buildProjectDetail(PROJECT_NO_IMAGE, { index: 1, total: 2 }))
    expect(buttons.map((b) => b.text)).not.toContain('🗑 Remove image')
    expect(buttons.map((b) => b.text)).toContain('🖼 Replace image')
  })
  it('hidden card shows the "tap to publish" toggle label', () => {
    const r = buildProjectDetail(PROJECT_NO_IMAGE, { index: 1, total: 2 })
    expect(readButtons(r).find((b) => b.data === 'cards:toggle:published')?.text).toBe(
      '🚫 Hidden (tap to publish)',
    )
  })
  it('prefixes "Saved." when opts.saved is true', () => {
    expect(buildProjectDetail(PROJECT_A, { index: 0, total: 1 }, { saved: true }).text.startsWith('Saved.\n\n')).toBe(true)
  })
})

describe('buildServiceDetail', () => {
  it('services show Title/Text/image/published/featured/move/back, no tags, image-alt, or delete', () => {
    const r = buildServiceDetail(SERVICE_A, { index: 0, total: 1 })
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: 'Title', data: 'cards:field:title' },
      { text: 'Text', data: 'cards:field:text' },
      { text: '🖼 Replace image', data: 'cards:image:replace' },
      { text: '🗑 Remove image', data: 'cards:image:remove' },
      { text: '✅ Published (tap to hide)', data: 'cards:toggle:published' },
      { text: '⭐ Featured (tap to unfeature)', data: 'cards:toggle:featured' },
      { text: '▲ Move up', data: 'cards:move:up' },
      { text: '▼ Move down', data: 'cards:move:down' },
      { text: '⬅ Back', data: 'cards:back:list' },
    ])
  })
  it('omits the featured toggle when list is "page"', () => {
    const pageService: ServiceCardRecord = { ...SERVICE_A, list: 'page' }
    const buttons = readButtons(buildServiceDetail(pageService, { index: 0, total: 1 }))
    expect(buttons.map((b) => b.text)).not.toContain('⭐ Featured (tap to unfeature)')
  })
  it('non-featured card shows the "tap to feature" toggle label', () => {
    const notFeatured: ServiceCardRecord = { ...SERVICE_A, featured: false }
    const r = buildServiceDetail(notFeatured, { index: 0, total: 1 })
    expect(readButtons(r).find((b) => b.data === 'cards:toggle:featured')?.text).toBe(
      '☆ Not featured (tap to feature)',
    )
  })
})

describe('buildCardFieldLangPrompt', () => {
  it('offers EN/UA and the given back callback', () => {
    const r = buildCardFieldLangPrompt('Title', 'cards:card:encryptia-cloud')
    expect(r.text).toContain('Title')
    expect(readButtons(r)).toEqual([
      { text: 'EN', data: 'cards:lang:en' },
      { text: 'UA', data: 'cards:lang:uk' },
      { text: '⬅ Back', data: 'cards:card:encryptia-cloud' },
    ])
  })
})

describe('buildCardValuePrompt', () => {
  it('shows current text and language label, no keyboard', () => {
    const r = buildCardValuePrompt('Title', 'en', 'Encryptia Cloud')
    expect(r.text).toContain('Encryptia Cloud')
    expect(r.text).toContain('EN')
    expect(r.keyboard).toBeUndefined()
  })
  it('shows "(empty)" for empty text', () => {
    expect(buildCardValuePrompt('Description', 'uk', '').text).toContain('(empty)')
  })
})

describe('buildTagsPrompt', () => {
  it('shows current tags, no keyboard', () => {
    const r = buildTagsPrompt(['WordPress', 'WooCommerce'])
    expect(r.text).toContain('WordPress, WooCommerce')
    expect(r.keyboard).toBeUndefined()
  })
  it('shows "(none)" for an empty tag list', () => {
    expect(buildTagsPrompt([]).text).toContain('(none)')
  })
})

describe('buildPhotoPrompt', () => {
  it('has the given back callback, no other buttons', () => {
    const r = buildPhotoPrompt('cards:card:encryptia-cloud')
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'cards:card:encryptia-cloud' }])
  })
  it('mentions sending as a file to preserve transparency', () => {
    const r = buildPhotoPrompt('cards:card:encryptia-cloud')
    expect(r.text).toBe(
      'Send a new photo for this card. For an icon with a transparent background, send it as a file (not a photo) to keep the transparency.',
    )
  })
})

describe('buildCardDeleteConfirm', () => {
  it('names the card and offers Yes/Cancel, project copy', () => {
    const r = buildCardDeleteConfirm('Encryptia Cloud', 'project')
    expect(r.text).toContain('Encryptia Cloud')
    expect(r.text).toContain('project card')
    expect(readButtons(r)).toEqual([
      { text: 'Yes, delete', data: 'cards:delete:confirm' },
      { text: 'Cancel', data: 'cards:delete:cancel' },
    ])
  })
  it('service copy says "service card"', () => {
    expect(buildCardDeleteConfirm('Web Development', 'service').text).toContain('service card')
  })
})

describe('buildCardSaveFailed', () => {
  it('offers a Back button to the given callback', () => {
    const r = buildCardSaveFailed('cards:card:encryptia-cloud')
    expect(r.text).toBe('Could not save — please try again.')
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'cards:card:encryptia-cloud' }])
  })
})

const REQUEST_A: EstimateRequestDTO = {
  id: 'req-1',
  createdAt: '2026-09-10T14:05:00.000Z',
  status: 'new',
  name: 'Jane Doe',
  email: 'jane@example.com',
  company: 'Acme Inc',
  budget: '3-10k',
  interestedIn: ['web-development', 'support'],
  message: 'We need a new website for our product launch.',
  locale: 'en',
  sourcePage: '/services',
  note: undefined,
}
const REQUEST_B: EstimateRequestDTO = {
  id: 'req-2',
  createdAt: '2026-09-11T09:30:00.000Z',
  status: 'in_progress',
  name: 'Ivan Petrenko',
  email: 'ivan@example.com',
  company: undefined,
  budget: undefined,
  interestedIn: [],
  message: 'Потрібен новий сайт.',
  locale: 'uk',
  sourcePage: undefined,
  note: 'Called back, waiting on budget confirmation.',
}

describe('buildRequestFilterMenu', () => {
  it('offers All + every status, then Back to menu:main', () => {
    const buttons = readButtons(buildRequestFilterMenu())
    expect(buttons).toEqual([
      { text: 'All', data: 'requests:filter:all' },
      { text: 'New', data: 'requests:filter:new' },
      { text: 'In Progress', data: 'requests:filter:in_progress' },
      { text: 'Done', data: 'requests:filter:done' },
      { text: 'Archived', data: 'requests:filter:archived' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
})

describe('buildRequestList', () => {
  it('shows one button per request with name and status, then Back', () => {
    const r = buildRequestList('all', [REQUEST_A, REQUEST_B])
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: 'New — Jane Doe', data: 'requests:card:req-1' },
      { text: 'In Progress — Ivan Petrenko', data: 'requests:card:req-2' },
      { text: '⬅ Back', data: 'requests:list' },
    ])
  })
  it('empty list still offers Back', () => {
    const r = buildRequestList('archived', [])
    expect(r.text).toContain('No requests')
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'requests:list' }])
  })
})

describe('buildRequestDetail', () => {
  it('shows every read-only field, a Status button with the current value, Edit note, Delete, Back', () => {
    const r = buildRequestDetail(REQUEST_A)
    expect(r.text).toContain('Jane Doe')
    expect(r.text).toContain('jane@example.com')
    expect(r.text).toContain('Acme Inc')
    expect(r.text).toContain('3-10k')
    expect(r.text).toContain('web-development, support')
    expect(r.text).toContain('EN')
    expect(r.text).toContain('/services')
    expect(r.text).toContain('2026-09-10 14:05')
    expect(r.text).toContain('We need a new website for our product launch.')
    expect(r.text).toContain('(none)')
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: 'Status: New', data: 'requests:status' },
      { text: '✏️ Edit note', data: 'requests:note' },
      { text: '🗑 Delete', data: 'requests:delete' },
      { text: '⬅ Back', data: 'requests:back:list' },
    ])
  })
  it('shows "—" for missing optional fields and "UA" for the uk locale', () => {
    const r = buildRequestDetail(REQUEST_B)
    expect(r.text).toContain('—')
    expect(r.text).toContain('UA')
    expect(r.text).toContain('Called back, waiting on budget confirmation.')
    expect(readButtons(r).find((b) => b.data === 'requests:status')?.text).toBe('Status: In Progress')
  })
  it('prefixes "Saved." when opts.saved is true', () => {
    expect(buildRequestDetail(REQUEST_A, { saved: true }).text.startsWith('Saved.\n\n')).toBe(true)
  })
  it('clips a very long message and note so the reply stays under Telegram\'s 4096-char limit', () => {
    const req: EstimateRequestDTO = {
      ...REQUEST_A,
      message: 'x'.repeat(5000),
      note: 'y'.repeat(5000),
    }
    const r = buildRequestDetail(req)
    expect(r.text.length).toBeLessThan(4096)
    expect(r.text).toContain('…')
  })
  it('stays under the 4096-char limit even when every field is independently maxed out', () => {
    // Mirrors validateEstimate's own per-field maximums (estimate.ts), all of
    // which are attacker-reachable via the public estimate endpoint, not just
    // message/note — a 20-tag interestedIn list alone runs past 2000 chars.
    const req: EstimateRequestDTO = {
      ...REQUEST_A,
      name: 'n'.repeat(200),
      email: `${'e'.repeat(190)}@x.com`,
      company: 'c'.repeat(200),
      sourcePage: 's'.repeat(200),
      interestedIn: Array.from({ length: 20 }, (_, i) => 'i'.repeat(100) + i),
      message: 'x'.repeat(5000),
      note: 'y'.repeat(5000),
    }
    const r = buildRequestDetail(req, { saved: true })
    expect(r.text.length).toBeLessThan(4096)
  })
})

describe('buildRequestStatusPrompt', () => {
  it('offers all four statuses and a Back to the given callback', () => {
    const r = buildRequestStatusPrompt('New', 'requests:card:req-1')
    expect(r.text).toContain('New')
    expect(readButtons(r)).toEqual([
      { text: 'New', data: 'requests:status:new' },
      { text: 'In Progress', data: 'requests:status:in_progress' },
      { text: 'Done', data: 'requests:status:done' },
      { text: 'Archived', data: 'requests:status:archived' },
      { text: '⬅ Back', data: 'requests:card:req-1' },
    ])
  })
})

describe('buildRequestNotePrompt', () => {
  it('shows the current note and asks for the new one, no keyboard', () => {
    const r = buildRequestNotePrompt('Called back, waiting on budget confirmation.')
    expect(r.text).toContain('Called back, waiting on budget confirmation.')
    expect(r.keyboard).toBeUndefined()
  })
  it('shows "(none)" when there is no current note', () => {
    expect(buildRequestNotePrompt(undefined).text).toContain('(none)')
  })
  it('clips a very long current note so the reply stays under Telegram\'s 4096-char limit', () => {
    const r = buildRequestNotePrompt('y'.repeat(5000))
    expect(r.text.length).toBeLessThan(4096)
    expect(r.text).toContain('…')
  })
})

describe('buildRequestDeleteConfirm', () => {
  it('names the request and offers Yes/Cancel', () => {
    const r = buildRequestDeleteConfirm('Jane Doe')
    expect(r.text).toContain('Jane Doe')
    expect(readButtons(r)).toEqual([
      { text: 'Yes, delete', data: 'requests:delete:confirm' },
      { text: 'Cancel', data: 'requests:delete:cancel' },
    ])
  })
})
