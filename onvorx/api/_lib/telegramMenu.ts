import { InlineKeyboard } from 'grammy'
import type { ManagerRecord, ManagerRole, Role } from './telegramAdmins'

export interface BotReply {
  text: string
  keyboard?: InlineKeyboard
}

const MENU_ITEMS: { key: string; label: string; roles: Role[] }[] = [
  { key: 'content', label: 'Content', roles: ['owner', 'content_manager'] },
  { key: 'projects', label: 'Projects', roles: ['owner', 'content_manager'] },
  { key: 'services', label: 'Services', roles: ['owner', 'content_manager'] },
  { key: 'seo', label: 'SEO', roles: ['owner', 'content_manager'] },
  { key: 'requests', label: 'Requests', roles: ['owner', 'sales_manager'] },
  { key: 'admins', label: 'Administrators', roles: ['owner'] },
]

export function buildMainMenu(role: Role): BotReply {
  const items = MENU_ITEMS.filter((m) => m.roles.includes(role))
  const kb = new InlineKeyboard()
  items.forEach((m, i) => {
    kb.text(m.label, m.key === 'admins' ? 'menu:admins' : `stub:${m.key}`)
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
