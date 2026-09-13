import { InlineKeyboard } from 'grammy'
import type { ManagerRecord, ManagerRole, Role } from './telegramAdmins'
import type { ContentField, SeoField, SectionRecord, SeoRecord } from './telegramContent'
import type { ProjectCardRecord, ServiceCardRecord } from './telegramCards'
import type { EstimateRequestDTO } from './adminRows'

export interface BotReply {
  text: string
  keyboard?: InlineKeyboard
}

const MENU_ITEMS: { key: string; label: string; roles: Role[]; callback: string }[] = [
  { key: 'content', label: 'Content', roles: ['owner', 'content_manager'], callback: 'content:list' },
  { key: 'projects', label: 'Projects', roles: ['owner', 'content_manager'], callback: 'cards:projects:list' },
  { key: 'services', label: 'Services', roles: ['owner', 'content_manager'], callback: 'cards:services:list' },
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

const CONTENT_SECTIONS: { key: string; label: string }[] = [
  { key: 'hero', label: 'Hero' },
  { key: 'services', label: 'Services' },
  { key: 'projects', label: 'Projects' },
  { key: 'howWork', label: 'How We Work' },
  { key: 'about', label: 'About' },
  { key: 'cta', label: 'CTA' },
]

const CTA_SECTIONS = ['hero', 'cta']

const CONTENT_FIELD_LABEL: Record<ContentField, string> = {
  eyebrow: 'Eyebrow',
  title: 'Title',
  body: 'Body',
  ctaLabel: 'CTA label',
}

function sectionFieldsFor(key: string): ContentField[] {
  return CTA_SECTIONS.includes(key) ? ['eyebrow', 'title', 'body', 'ctaLabel'] : ['eyebrow', 'title', 'body']
}

export function sectionFieldValue(record: SectionRecord, field: ContentField): { en: string; uk: string } {
  return field === 'ctaLabel' ? (record.ctaLabel ?? { en: '', uk: '' }) : record[field]
}

export function buildContentList(): BotReply {
  const kb = new InlineKeyboard()
  CONTENT_SECTIONS.forEach((s) => kb.text(s.label, `content:section:${s.key}`).row())
  kb.text('⬅ Back', 'menu:main')
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
  kb.text('⬅ Back', 'content:list')
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

const SEO_PAGES: { key: string; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'services', label: 'Services' },
  { key: 'projects', label: 'Projects' },
  { key: 'about', label: 'About' },
  { key: 'web-development', label: 'Web Development' },
  { key: 'support', label: 'Support' },
  { key: 'business-analysis', label: 'Business Analysis' },
  { key: 'google-ads', label: 'Google Ads' },
]

const SEO_FIELD_LABEL: Record<SeoField, string> = { title: 'Title', description: 'Description' }
const SEO_FIELDS: SeoField[] = ['title', 'description']

export function buildSeoList(): BotReply {
  const kb = new InlineKeyboard()
  SEO_PAGES.forEach((p) => kb.text(p.label, `seo:page:${p.key}`).row())
  kb.text('⬅ Back', 'menu:main')
  return { text: 'SEO — choose a page:', keyboard: kb }
}

export function buildSeoDetail(record: SeoRecord, opts: { saved?: boolean } = {}): BotReply {
  const lines = SEO_FIELDS.map(
    (f) => `${SEO_FIELD_LABEL[f]} — EN: ${record[f].en || '(empty)'} / UA: ${record[f].uk || '(empty)'}`,
  )
  const kb = new InlineKeyboard()
  SEO_FIELDS.forEach((f) => kb.text(SEO_FIELD_LABEL[f], `seo:field:${f}`).row())
  kb.text('⬅ Back', 'seo:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return { text: `${prefix}${record.pageKey}\n${lines.join('\n')}`, keyboard: kb }
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

export function buildCardTypeTabs(type: 'projects' | 'services'): BotReply {
  const pageLabel = type === 'projects' ? 'Projects page' : 'Services page'
  const kb = new InlineKeyboard()
    .text('On the home page', `cards:${type}:tab:home`)
    .row()
    .text(pageLabel, `cards:${type}:tab:page`)
    .row()
    .text('⬅ Back', 'menu:main')
  return { text: type === 'projects' ? 'Projects — choose a list:' : 'Services — choose a list:', keyboard: kb }
}

export function buildProjectList(list: 'home' | 'page', cards: ProjectCardRecord[]): BotReply {
  const kb = new InlineKeyboard()
  cards.forEach((c) => {
    kb.text(`${c.published ? '✅' : '🚫'} ${c.title.en || c.id}`, `cards:card:${c.id}`).row()
  })
  kb.text('⬅ Back', 'cards:projects:list')
  if (cards.length === 0) return { text: 'No cards in this list yet.', keyboard: kb }
  return { text: `Projects — ${list === 'home' ? 'home page' : 'Projects page'}:`, keyboard: kb }
}

export function buildServiceList(list: 'home' | 'page', cards: ServiceCardRecord[]): BotReply {
  const kb = new InlineKeyboard()
  cards.forEach((c) => {
    kb.text(`${c.published ? '✅' : '🚫'} ${c.title.en || c.id}`, `cards:card:${c.id}`).row()
  })
  kb.text('⬅ Back', 'cards:services:list')
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

const STATUS_LABEL: Record<string, string> = {
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

const formatReceivedAt = (iso: string): string => iso.slice(0, 16).replace('T', ' ')

export function buildRequestDetail(req: EstimateRequestDTO, opts: { saved?: boolean } = {}): BotReply {
  const langLabel = req.locale === 'en' ? 'EN' : 'UA'
  const lines = [
    `Email: ${req.email}`,
    `Company: ${req.company || '—'}`,
    `Budget: ${req.budget || '—'}`,
    `Interested in: ${req.interestedIn.length ? req.interestedIn.join(', ') : '—'}`,
    `Language: ${langLabel}`,
    `From page: ${req.sourcePage || '—'}`,
    `Received: ${formatReceivedAt(req.createdAt)}`,
    '',
    clip(req.message, 1500),
    '',
    `Note: ${req.note ? clip(req.note, 800) : '(none)'}`,
  ]
  const kb = new InlineKeyboard()
    .text(`Status: ${STATUS_LABEL[req.status] ?? req.status}`, 'requests:status')
    .row()
    .text('✏️ Edit note', 'requests:note')
    .row()
    .text('🗑 Delete', 'requests:delete')
    .row()
    .text('⬅ Back', 'requests:back:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return { text: `${prefix}${req.name}\n${lines.join('\n')}`, keyboard: kb }
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

export function buildRequestNotePrompt(currentNote: string | undefined): BotReply {
  return {
    text: `Current note:\n${currentNote ? clip(currentNote, 800) : '(none)'}\n\nSend the new note text.`,
  }
}

export function buildRequestDeleteConfirm(name: string): BotReply {
  const kb = new InlineKeyboard()
    .text('Yes, delete', 'requests:delete:confirm')
    .row()
    .text('Cancel', 'requests:delete:cancel')
  return { text: `Delete the request from "${name}"? It will be permanently removed.`, keyboard: kb }
}
