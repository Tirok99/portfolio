import { InlineKeyboard } from 'grammy'
import type { ManagerRecord, ManagerRole, Role } from './telegramAdmins'
import type { ContentField, SeoField, SectionRecord, SeoRecord } from './telegramContent'

export interface BotReply {
  text: string
  keyboard?: InlineKeyboard
}

const MENU_ITEMS: { key: string; label: string; roles: Role[]; callback: string }[] = [
  { key: 'content', label: 'Content', roles: ['owner', 'content_manager'], callback: 'content:list' },
  { key: 'projects', label: 'Projects', roles: ['owner', 'content_manager'], callback: 'stub:projects' },
  { key: 'services', label: 'Services', roles: ['owner', 'content_manager'], callback: 'stub:services' },
  { key: 'seo', label: 'SEO', roles: ['owner', 'content_manager'], callback: 'seo:list' },
  { key: 'requests', label: 'Requests', roles: ['owner', 'sales_manager'], callback: 'stub:requests' },
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
