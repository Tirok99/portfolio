import { InlineKeyboard } from 'grammy'
import type { ManagerRecord, ManagerRole, Role } from './telegramAdmins'
import type { ContentField, SeoField, SectionRecord, SeoRecord } from './telegramContent'
import type { ProjectCardRecord, ServiceCardRecord } from './telegramCards'
import type { EstimateRequestDTO } from './adminRows'
import type { RequestNoteDTO } from './adminRequestNotesHandler'

export interface BotReply {
  text: string
  keyboard?: InlineKeyboard
}

const MENU_ITEMS: { key: string; label: string; roles: Role[]; callback: string }[] = [
  { key: 'content', label: 'Content', roles: ['owner', 'content_manager'], callback: 'content:list' },
  { key: 'cards', label: 'Cards', roles: ['owner', 'content_manager'], callback: 'cards:list' },
  { key: 'seo', label: 'SEO', roles: ['owner', 'content_manager'], callback: 'seo:list' },
  { key: 'requests', label: 'Requests', roles: ['owner', 'sales_manager'], callback: 'requests:list' },
  { key: 'admins', label: 'Administrators', roles: ['owner'], callback: 'menu:admins' },
]

export function buildMainMenu(role: Role): BotReply {
  const items = MENU_ITEMS.filter((m) => m.roles.includes(role))
  const kb = new InlineKeyboard()
  items.forEach((m, i) => {
    kb.text(m.label, m.callback)
    if (i < items.length - 1) kb.row()
  })
  return { text: 'ONVORX admin — choose a section:', keyboard: kb }
}

export function buildStubReply(section: string): BotReply {
  return { text: `${section} management is coming in a later update.` }
}

export function canAccessSection(role: Role, key: string): boolean {
  const item = MENU_ITEMS.find((m) => m.key === key)
  return item ? item.roles.includes(role) : false
}

export function buildNoAccessReply(): BotReply {
  return { text: "You don't have access to this bot." }
}

const ROLE_LABEL: Record<ManagerRole, string> = {
  content_manager: 'Content manager',
  sales_manager: 'Sales manager',
}

export function buildAdminsList(managers: ManagerRecord[]): BotReply {
  const kb = new InlineKeyboard()
  managers.forEach((m) => {
    kb.text(`🗑 Remove ${m.label ?? m.telegramId}`, `admins:remove:${m.telegramId}`).row()
  })
  kb.text('➕ Add manager', 'admins:add').row().text('⬅ Back', 'menu:main')
  if (managers.length === 0) return { text: 'No managers yet.', keyboard: kb }
  const lines = managers.map((m) => `• ${m.label ?? m.telegramId} — ${ROLE_LABEL[m.role]} (id ${m.telegramId})`)
  return { text: `Managers:\n${lines.join('\n')}`, keyboard: kb }
}

export function buildAddIdPrompt(): BotReply {
  return { text: 'Send the Telegram ID of the person to add.' }
}

export function buildRolePrompt(): BotReply {
  const kb = new InlineKeyboard()
    .text('Content manager', 'admins:add:role:content_manager')
    .row()
    .text('Sales manager', 'admins:add:role:sales_manager')
  return { text: 'Choose a role:', keyboard: kb }
}

export function buildLabelPrompt(): BotReply {
  const kb = new InlineKeyboard().text('Skip', 'admins:add:skip_label')
  return { text: 'Optional: send a name/label for this person, or tap Skip.', keyboard: kb }
}

export function buildRemoveConfirm(target: ManagerRecord): BotReply {
  const kb = new InlineKeyboard()
    .text('Yes, remove', `admins:remove:confirm:${target.telegramId}`)
    .row()
    .text('Cancel', 'admins:remove:cancel')
  return {
    text: `Remove ${target.label ?? target.telegramId} (${ROLE_LABEL[target.role]})?`,
    keyboard: kb,
  }
}

// ---- Content ----

export type ContentPage = 'home' | 'services'

const CONTENT_SECTIONS: Record<ContentPage, { key: string; label: string }[]> = {
  home: [
    { key: 'hero', label: 'Hero' },
    { key: 'services', label: 'Services' },
    { key: 'projects', label: 'Projects' },
    { key: 'howWork', label: 'How We Work' },
    { key: 'about', label: 'About' },
    { key: 'cta', label: 'CTA' },
  ],
  services: [
    { key: 'svcHero', label: 'Hero' },
    { key: 'svcWebDevelopment', label: 'Web Development' },
    { key: 'svcAiBuild', label: 'AI Build' },
    { key: 'svcWebsiteSupport', label: 'Website Support' },
    { key: 'svcBusinessAnalysis', label: 'Business Analysis' },
    { key: 'svcGoogleAds', label: 'Google Ads' },
    { key: 'svcCta', label: 'CTA' },
  ],
}

const CTA_SECTIONS = ['hero', 'cta']

const CONTENT_FIELD_LABEL: Record<ContentField, string> = {
  eyebrow: 'Eyebrow',
  title: 'Title',
  body: 'Body',
  ctaLabel: 'CTA label',
}

export const contentPageOf = (key: string): ContentPage => (key.startsWith('svc') ? 'services' : 'home')

/** The bot edits only Title + Body of the /services sections (spec §7). */
export function sectionFieldsFor(key: string): ContentField[] {
  if (contentPageOf(key) === 'services') return ['title', 'body']
  return CTA_SECTIONS.includes(key) ? ['eyebrow', 'title', 'body', 'ctaLabel'] : ['eyebrow', 'title', 'body']
}

export function sectionFieldValue(record: SectionRecord, field: ContentField): { en: string; uk: string } {
  return field === 'ctaLabel' ? (record.ctaLabel ?? { en: '', uk: '' }) : record[field]
}

export function buildContentPagePicker(): BotReply {
  const kb = new InlineKeyboard()
    .text('Home', 'content:page:home')
    .row()
    .text('Services', 'content:page:services')
    .row()
    .text('⬅ Back', 'menu:main')
  return { text: 'Content — choose a page:', keyboard: kb }
}

export function buildContentList(page: ContentPage): BotReply {
  const kb = new InlineKeyboard()
  CONTENT_SECTIONS[page].forEach((s) => kb.text(s.label, `content:section:${s.key}`).row())
  kb.text('⬅ Back', 'content:list')
  return { text: 'Content — choose a block:', keyboard: kb }
}

export function buildSectionDetail(record: SectionRecord, opts: { saved?: boolean } = {}): BotReply {
  const fields = sectionFieldsFor(record.key)
  const lines = fields.map((f) => {
    const v = sectionFieldValue(record, f)
    return `${CONTENT_FIELD_LABEL[f]} — EN: ${v.en || '(empty)'} / UA: ${v.uk || '(empty)'}`
  })
  const kb = new InlineKeyboard()
  fields.forEach((f) => kb.text(CONTENT_FIELD_LABEL[f], `content:field:${f}`).row())
  kb.text('⬅ Back', `content:page:${contentPageOf(record.key)}`)
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return { text: `${prefix}${record.key}\n${lines.join('\n')}`, keyboard: kb }
}

export function buildContentFieldLangPrompt(key: string, field: ContentField): BotReply {
  const kb = new InlineKeyboard()
    .text('EN', 'content:lang:en')
    .text('UA', 'content:lang:uk')
    .row()
    .text('⬅ Back', `content:section:${key}`)
  return { text: `Edit ${CONTENT_FIELD_LABEL[field]} — choose a language:`, keyboard: kb }
}

export function buildContentValuePrompt(field: ContentField, lang: 'en' | 'uk', currentText: string): BotReply {
  const langLabel = lang === 'en' ? 'EN' : 'UA'
  return {
    text: `Current ${CONTENT_FIELD_LABEL[field]} (${langLabel}):\n${currentText || '(empty)'}\n\nSend the new ${langLabel} text.`,
  }
}

// ---- SEO ----

/**
 * Same grouping as the web admin's SEO tabs: a site page, then (Services
 * only) its blocks. A single-entry page opens its record directly.
 */
const SEO_GROUPS: { key: string; label: string; entries: { pageKey: string; label: string }[] }[] = [
  { key: 'home', label: 'Home', entries: [{ pageKey: 'home', label: 'Home' }] },
  {
    key: 'services',
    label: 'Services',
    entries: [
      { pageKey: 'services', label: 'Services page' },
      { pageKey: 'web-development', label: 'Web Development' },
      { pageKey: 'support', label: 'Website Support & Development' },
      { pageKey: 'business-analysis', label: 'Business Analysis' },
      { pageKey: 'google-ads', label: 'Google Ads' },
    ],
  },
  { key: 'projects', label: 'Projects', entries: [{ pageKey: 'projects', label: 'Projects' }] },
  { key: 'about', label: 'About', entries: [{ pageKey: 'about', label: 'About' }] },
]

const SEO_FIELD_LABEL: Record<SeoField, string> = { title: 'Title', description: 'Description' }
const SEO_FIELDS: SeoField[] = ['title', 'description']

const seoGroupOf = (pageKey: string) => SEO_GROUPS.find((g) => g.entries.some((e) => e.pageKey === pageKey))

export function buildSeoList(): BotReply {
  const kb = new InlineKeyboard()
  SEO_GROUPS.forEach((g) => {
    const target = g.entries.length === 1 ? `seo:page:${g.entries[0].pageKey}` : `seo:tab:${g.key}`
    kb.text(g.label, target).row()
  })
  kb.text('⬅ Back', 'menu:main')
  return { text: 'SEO — choose a page:', keyboard: kb }
}

/** The blocks of a multi-entry page (Services); null for an unknown group. */
export function buildSeoGroup(key: string): BotReply | null {
  const group = SEO_GROUPS.find((g) => g.key === key && g.entries.length > 1)
  if (!group) return null
  const kb = new InlineKeyboard()
  group.entries.forEach((e) => kb.text(e.label, `seo:page:${e.pageKey}`).row())
  kb.text('⬅ Back', 'seo:list')
  return { text: `SEO — ${group.label} — choose a block:`, keyboard: kb }
}

export function buildSeoDetail(record: SeoRecord, opts: { saved?: boolean } = {}): BotReply {
  const lines = SEO_FIELDS.map(
    (f) => `${SEO_FIELD_LABEL[f]} — EN: ${record[f].en || '(empty)'} / UA: ${record[f].uk || '(empty)'}`,
  )
  const group = seoGroupOf(record.pageKey)
  const label = group?.entries.find((e) => e.pageKey === record.pageKey)?.label ?? record.pageKey
  const kb = new InlineKeyboard()
  SEO_FIELDS.forEach((f) => kb.text(SEO_FIELD_LABEL[f], `seo:field:${f}`).row())
  kb.text('⬅ Back', group && group.entries.length > 1 ? `seo:tab:${group.key}` : 'seo:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return { text: `${prefix}${label}\n${lines.join('\n')}`, keyboard: kb }
}

export function buildSeoFieldLangPrompt(pageKey: string, field: SeoField): BotReply {
  const kb = new InlineKeyboard()
    .text('EN', 'seo:lang:en')
    .text('UA', 'seo:lang:uk')
    .row()
    .text('⬅ Back', `seo:page:${pageKey}`)
  return { text: `Edit ${SEO_FIELD_LABEL[field]} — choose a language:`, keyboard: kb }
}

export function buildSeoValuePrompt(field: SeoField, lang: 'en' | 'uk', currentText: string): BotReply {
  const langLabel = lang === 'en' ? 'EN' : 'UA'
  return {
    text: `Current ${SEO_FIELD_LABEL[field]} (${langLabel}):\n${currentText || '(empty)'}\n\nSend the new ${langLabel} text.`,
  }
}

export function buildSaveFailed(backCallback: string): BotReply {
  const kb = new InlineKeyboard().text('⬅ Back', backCallback)
  return { text: 'Could not save — please try again.', keyboard: kb }
}

// ---- Cards: Projects & Services ----

export type CardsPage = 'home' | 'services'

/**
 * Same structure as the web admin's Cards screen: a site page, then the block
 * on it. Blocks with a `callback` are edited here; the rest are edited only in
 * the web admin, and the bot says so.
 */
const CARD_BLOCKS: Record<CardsPage, { key: string; label: string; callback?: string }[]> = {
  home: [
    { key: 'hero', label: 'Hero' },
    { key: 'howWork', label: 'How it works' },
    { key: 'about', label: 'About' },
    { key: 'projects', label: 'Projects', callback: 'cards:projects:list' },
    { key: 'services', label: 'Services', callback: 'cards:services:list' },
  ],
  services: [
    { key: 'svcHero', label: 'Hero' },
    { key: 'svcWebDevelopment', label: 'Web Development' },
    { key: 'svcAiBuild', label: 'AI Build' },
    { key: 'svcWebsiteSupport', label: 'Website Support' },
    { key: 'svcBusinessAnalysis', label: 'Business Analysis' },
    { key: 'svcGoogleAds', label: 'Google Ads' },
  ],
}

const CARDS_PAGE_LABEL: Record<CardsPage, string> = { home: 'Home', services: 'Services' }

export const isCardsPage = (v: string): v is CardsPage => v === 'home' || v === 'services'

export function buildCardsPagePicker(): BotReply {
  const kb = new InlineKeyboard()
    .text('Home', 'cards:page:home')
    .row()
    .text('Services', 'cards:page:services')
    .row()
    .text('⬅ Back', 'menu:main')
  return { text: 'Cards — choose a page:', keyboard: kb }
}

export function buildCardsBlockList(page: CardsPage): BotReply {
  const kb = new InlineKeyboard()
  CARD_BLOCKS[page].forEach((b) => kb.text(b.label, b.callback ?? `cards:block:${b.key}`).row())
  kb.text('⬅ Back', 'cards:list')
  return { text: `Cards — ${CARDS_PAGE_LABEL[page]} — choose a block:`, keyboard: kb }
}

/** For a block the bot doesn't edit: where to find it in the web admin. Null otherwise. */
export function buildCardsWebAdminOnly(key: string): BotReply | null {
  for (const page of ['home', 'services'] as const) {
    const block = CARD_BLOCKS[page].find((b) => b.key === key && !b.callback)
    if (!block) continue
    const kb = new InlineKeyboard().text('⬅ Back', `cards:page:${page}`)
    return {
      text: `${block.label} is edited in the web admin only: Cards → ${CARDS_PAGE_LABEL[page]} → ${block.label}.`,
      keyboard: kb,
    }
  }
  return null
}

export function buildProjectList(list: 'home' | 'page', cards: ProjectCardRecord[]): BotReply {
  const kb = new InlineKeyboard()
  cards.forEach((c) => {
    kb.text(`${c.published ? '✅' : '🚫'} ${c.title.en || c.id}`, `cards:card:${c.id}`).row()
  })
  kb.text('⬅ Back', 'cards:page:home')
  if (cards.length === 0) return { text: 'No cards in this list yet.', keyboard: kb }
  return { text: `Projects — ${list === 'home' ? 'home page' : 'Projects page'}:`, keyboard: kb }
}

export function buildServiceList(list: 'home' | 'page', cards: ServiceCardRecord[]): BotReply {
  const kb = new InlineKeyboard()
  cards.forEach((c) => {
    kb.text(`${c.published ? '✅' : '🚫'} ${c.title.en || c.id}`, `cards:card:${c.id}`).row()
  })
  kb.text('⬅ Back', 'cards:page:home')
  if (cards.length === 0) return { text: 'No cards in this list yet.', keyboard: kb }
  return { text: `Services — ${list === 'home' ? 'home page' : 'Services page'}:`, keyboard: kb }
}

const publishedToggleLabel = (published: boolean): string =>
  published ? '✅ Published (tap to hide)' : '🚫 Hidden (tap to publish)'
const featuredToggleLabel = (featured: boolean): string =>
  featured ? '⭐ Featured (tap to unfeature)' : '☆ Not featured (tap to feature)'

export function buildProjectDetail(
  card: ProjectCardRecord,
  position: { index: number; total: number },
  opts: { saved?: boolean } = {},
): BotReply {
  const lines = [
    `Title — EN: ${card.title.en || '(empty)'} / UA: ${card.title.uk || '(empty)'}`,
    `Description — EN: ${card.description.en || '(empty)'} / UA: ${card.description.uk || '(empty)'}`,
    `Tags: ${card.tags.length ? card.tags.join(', ') : '(none)'}`,
    `Image alt — EN: ${card.imageAlt.en || '(empty)'} / UA: ${card.imageAlt.uk || '(empty)'}`,
    `Image: ${card.imageUrl ? 'set' : 'none'}`,
  ]
  const kb = new InlineKeyboard()
    .text('Title', 'cards:field:title')
    .row()
    .text('Description', 'cards:field:description')
    .row()
    .text('Tags', 'cards:field:tags')
    .row()
    .text('Image alt text', 'cards:field:imageAlt')
    .row()
    .text('🖼 Replace image', 'cards:image:replace')
    .row()
  if (card.imageUrl) kb.text('🗑 Remove image', 'cards:image:remove').row()
  kb.text(publishedToggleLabel(card.published), 'cards:toggle:published')
    .row()
    .text('▲ Move up', 'cards:move:up')
    .text('▼ Move down', 'cards:move:down')
    .row()
    .text('🗑 Delete card', 'cards:delete')
    .row()
    .text('⬅ Back', 'cards:back:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return {
    text: `${prefix}${card.title.en || card.id}\nPosition ${position.index + 1} of ${position.total}\n${lines.join('\n')}`,
    keyboard: kb,
  }
}

export function buildServiceDetail(
  card: ServiceCardRecord,
  position: { index: number; total: number },
  opts: { saved?: boolean } = {},
): BotReply {
  const lines = [
    `Title — EN: ${card.title.en || '(empty)'} / UA: ${card.title.uk || '(empty)'}`,
    `Text — EN: ${card.text.en || '(empty)'} / UA: ${card.text.uk || '(empty)'}`,
    `Icon: ${card.iconUrl ? 'set' : 'none'}`,
  ]
  const kb = new InlineKeyboard()
    .text('Title', 'cards:field:title')
    .row()
    .text('Text', 'cards:field:text')
    .row()
    .text('🖼 Replace image', 'cards:image:replace')
    .row()
  if (card.iconUrl) kb.text('🗑 Remove image', 'cards:image:remove').row()
  kb.text(publishedToggleLabel(card.published), 'cards:toggle:published').row()
  if (card.list === 'home') kb.text(featuredToggleLabel(card.featured), 'cards:toggle:featured').row()
  kb.text('▲ Move up', 'cards:move:up')
    .text('▼ Move down', 'cards:move:down')
    .row()
    .text('⬅ Back', 'cards:back:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return {
    text: `${prefix}${card.title.en || card.id}\nPosition ${position.index + 1} of ${position.total}\n${lines.join('\n')}`,
    keyboard: kb,
  }
}

export function buildCardFieldLangPrompt(label: string, backCallback: string): BotReply {
  const kb = new InlineKeyboard()
    .text('EN', 'cards:lang:en')
    .text('UA', 'cards:lang:uk')
    .row()
    .text('⬅ Back', backCallback)
  return { text: `Edit ${label} — choose a language:`, keyboard: kb }
}

export function buildCardValuePrompt(label: string, lang: 'en' | 'uk', currentText: string): BotReply {
  const langLabel = lang === 'en' ? 'EN' : 'UA'
  return {
    text: `Current ${label} (${langLabel}):\n${currentText || '(empty)'}\n\nSend the new ${langLabel} text.`,
  }
}

export function buildTagsPrompt(currentTags: string[]): BotReply {
  const current = currentTags.length ? currentTags.join(', ') : '(none)'
  return { text: `Current tags: ${current}\n\nSend comma-separated tags, e.g. WordPress, WooCommerce.` }
}

export function buildPhotoPrompt(backCallback: string): BotReply {
  const kb = new InlineKeyboard().text('⬅ Back', backCallback)
  return {
    text: 'Send a new photo for this card. For an icon with a transparent background, send it as a file (not a photo) to keep the transparency.',
    keyboard: kb,
  }
}

export function buildCardDeleteConfirm(title: string, kind: 'project' | 'service'): BotReply {
  const kb = new InlineKeyboard()
    .text('Yes, delete', 'cards:delete:confirm')
    .row()
    .text('Cancel', 'cards:delete:cancel')
  return {
    text: `Delete "${title}"? It will be removed from the list as a ${kind} card. This cannot be undone.`,
    keyboard: kb,
  }
}

export function buildCardSaveFailed(backCallback: string): BotReply {
  const kb = new InlineKeyboard().text('⬅ Back', backCallback)
  return { text: 'Could not save — please try again.', keyboard: kb }
}

// ---- Requests ----

export type RequestFilter = 'all' | 'new' | 'in_progress' | 'done' | 'archived'

export const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  in_progress: 'In Progress',
  done: 'Done',
  archived: 'Archived',
}

const clip = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max)}…` : s)

const FILTERS: { key: RequestFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'archived', label: 'Archived' },
]

export function buildRequestFilterMenu(): BotReply {
  const kb = new InlineKeyboard()
  FILTERS.forEach((f) => kb.text(f.label, `requests:filter:${f.key}`).row())
  kb.text('⬅ Back', 'menu:main')
  return { text: 'Requests — filter by status:', keyboard: kb }
}

export function buildRequestList(filter: RequestFilter, requests: EstimateRequestDTO[]): BotReply {
  const kb = new InlineKeyboard()
  requests.forEach((r) => {
    kb.text(`${STATUS_LABEL[r.status] ?? r.status} — ${r.name}`, `requests:card:${r.id}`).row()
  })
  kb.text('⬅ Back', 'requests:list')
  if (requests.length === 0) return { text: 'No requests match this filter.', keyboard: kb }
  return { text: `Requests — ${FILTERS.find((f) => f.key === filter)?.label ?? filter}:`, keyboard: kb }
}

const formatReceivedAt = (iso: string): string => `${iso.slice(0, 16).replace('T', ' ')} UTC`

// Telegram's sendMessage hard limit is 4096 chars. Every field below is
// individually clipped for readability, but interestedIn/name/email/company/
// sourcePage are all attacker-reachable via the public estimate endpoint
// (validateEstimate in estimate.ts bounds them by count/length, not content),
// so an overall safety clip on the fully assembled text is the actual
// guarantee — it alone must hold even if a future field is added or an
// individual clip above is miscalculated.
const TELEGRAM_TEXT_MAX = 4000

function formatNoteLine(n: RequestNoteDTO): string {
  return `• ${formatReceivedAt(n.createdAt)} — ${n.author}: ${clip(n.body, 150)}`
}

function buildNotesPreview(notes: RequestNoteDTO[]): string[] {
  if (notes.length === 0) return ['Notes: (none yet)']
  const shown = notes.slice(0, 3)
  const header = notes.length > 3 ? `Notes (showing 3 of ${notes.length}):` : 'Notes:'
  return [header, ...shown.map(formatNoteLine)]
}

export function buildRequestDetail(
  req: EstimateRequestDTO,
  notes: RequestNoteDTO[],
  opts: { saved?: boolean } = {},
): BotReply {
  const langLabel = req.locale === 'en' ? 'EN' : 'UA'
  const lines = [
    `Email: ${clip(req.email, 200)}`,
    `Company: ${req.company ? clip(req.company, 200) : '—'}`,
    `Budget: ${req.budget ? clip(req.budget, 200) : '—'}`,
    `Interested in: ${req.interestedIn.length ? clip(req.interestedIn.join(', '), 300) : '—'}`,
    `Language: ${langLabel}`,
    `From page: ${req.sourcePage ? clip(req.sourcePage, 200) : '—'}`,
    `Received: ${formatReceivedAt(req.createdAt)}`,
    '',
    clip(req.message, 1500),
    '',
    ...buildNotesPreview(notes),
  ]
  const kb = new InlineKeyboard()
    .text(`Status: ${STATUS_LABEL[req.status] ?? req.status}`, 'requests:status')
    .row()
    .text('➕ Add note', 'requests:note')
    .row()
  if (notes.length > 3) {
    kb.text('📝 Full history', `requests:notes:${req.id}`).row()
  }
  kb.text('🗑 Delete', 'requests:delete')
    .row()
    .text('⬅ Back', 'requests:back:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  const text = clip(`${prefix}${clip(req.name, 200)}\n${lines.join('\n')}`, TELEGRAM_TEXT_MAX)
  return { text, keyboard: kb }
}

const STATUS_ORDER: { key: string; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'archived', label: 'Archived' },
]

export function buildRequestStatusPrompt(current: string, backCallback: string): BotReply {
  const kb = new InlineKeyboard()
  STATUS_ORDER.forEach((s) => kb.text(s.label, `requests:status:${s.key}`).row())
  kb.text('⬅ Back', backCallback)
  return { text: `Current status: ${current}\n\nChoose a new status:`, keyboard: kb }
}

export function buildRequestNotePrompt(lastNote: RequestNoteDTO | undefined): BotReply {
  const preview = lastNote
    ? `Last note (${formatReceivedAt(lastNote.createdAt)} — ${lastNote.author}):\n${clip(lastNote.body, 300)}`
    : '(no notes yet)'
  return { text: clip(`${preview}\n\nSend the note text to add (up to 500 characters).`, TELEGRAM_TEXT_MAX) }
}

const NOTES_HISTORY_MAX = 4000

export function buildRequestNotesHistory(notes: RequestNoteDTO[], backCallback: string): BotReply {
  const kb = new InlineKeyboard().text('⬅ Back', backCallback)
  if (notes.length === 0) {
    return { text: 'No notes yet.', keyboard: kb }
  }
  const lines = notes.map((n) => `• ${formatReceivedAt(n.createdAt)} — ${n.author}: ${clip(n.body, 300)}`)
  let shown = notes.length
  const render = () =>
    shown === notes.length
      ? `Full history (${notes.length} total):\n\n${lines.slice(0, shown).join('\n')}`
      : `Full history (showing ${shown} most recent of ${notes.length} total):\n\n${lines.slice(0, shown).join('\n')}`
  let text = render()
  while (text.length > NOTES_HISTORY_MAX && shown > 0) {
    shown -= 1
    text = render()
  }
  return { text, keyboard: kb }
}

export function buildRequestDeleteConfirm(name: string): BotReply {
  const kb = new InlineKeyboard()
    .text('Yes, delete', 'requests:delete:confirm')
    .row()
    .text('Cancel', 'requests:delete:cancel')
  return { text: `Delete the request from "${name}"? It will be permanently removed.`, keyboard: kb }
}
