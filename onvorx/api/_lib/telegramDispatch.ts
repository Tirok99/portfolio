import type { AuthEnv, SupabaseAdminEnv, TelegramEnv } from './types'
import {
  resolveRole,
  defaultTelegramAdminsDeps,
  MANAGER_ROLES,
  type TelegramAdminsDeps,
  type ManagerRole,
  type Role,
} from './telegramAdmins'
import {
  defaultTelegramSessionsDeps,
  MAIN_MENU_STATE,
  type TelegramSessionsDeps,
} from './telegramSessions'
import {
  defaultTelegramContentDeps,
  type TelegramContentDeps,
  type ContentField,
  type SeoField,
} from './telegramContent'
import { handleAdminContent, defaultAdminContentDeps, type AdminContentDeps } from './adminContentHandler'
import { signToken } from './session'
import * as menu from './telegramMenu'
import { dispatchCardsCallback, dispatchCardsText, defaultCardsDispatchDeps, type CardsDispatchDeps } from './telegramCardsDispatch'

export interface BotCtx {
  chatId: number
  fromId: number
  text?: string
  callbackData?: string
  reply: (r: menu.BotReply) => Promise<void>
  answerCallback: () => Promise<void>
}

export interface DispatchDeps {
  admins: TelegramAdminsDeps
  sessions: TelegramSessionsDeps
  content: TelegramContentDeps
  adminContent: AdminContentDeps
  cardsDispatch: CardsDispatchDeps
}

export const defaultDispatchDeps: DispatchDeps = {
  admins: defaultTelegramAdminsDeps,
  sessions: defaultTelegramSessionsDeps,
  content: defaultTelegramContentDeps,
  adminContent: defaultAdminContentDeps,
  cardsDispatch: defaultCardsDispatchDeps,
}

type Env = TelegramEnv & SupabaseAdminEnv & AuthEnv

export function adminCookieHeader(env: Env): string | null {
  if (!env.ADMIN_SESSION_SECRET) return null
  return `admin_session=${signToken(env.ADMIN_SESSION_SECRET)}`
}

export async function dispatch(
  ctx: BotCtx,
  env: Env,
  deps: DispatchDeps = defaultDispatchDeps,
): Promise<void> {
  const role = await resolveRole(ctx.fromId, env, deps.admins)
  if (!role) {
    if (ctx.callbackData) await ctx.answerCallback()
    await ctx.reply(menu.buildNoAccessReply())
    return
  }

  if (ctx.callbackData) {
    await ctx.answerCallback()
    await handleCallback(ctx, ctx.callbackData, role, env, deps)
    return
  }

  if (ctx.text === '/start') {
    await deps.sessions.save(ctx.chatId, MAIN_MENU_STATE, env)
    await ctx.reply(menu.buildMainMenu(role))
    return
  }

  if (typeof ctx.text === 'string') {
    await handleText(ctx, ctx.text, role, env, deps)
  }
}

async function showAdminsList(ctx: BotCtx, env: Env, deps: DispatchDeps): Promise<void> {
  const managers = await deps.admins.listManagers(env)
  await deps.sessions.save(ctx.chatId, { screen: 'admins_list' }, env)
  await ctx.reply(menu.buildAdminsList(managers))
}

async function handleCallback(
  ctx: BotCtx,
  data: string,
  role: Role,
  env: Env,
  deps: DispatchDeps,
): Promise<void> {
  if (data === 'menu:main') {
    await deps.sessions.save(ctx.chatId, MAIN_MENU_STATE, env)
    await ctx.reply(menu.buildMainMenu(role))
    return
  }

  if (data.startsWith('content:')) {
    if (!menu.canAccessSection(role, 'content')) {
      await ctx.reply(menu.buildNoAccessReply())
      return
    }
    await handleContentCallback(ctx, data, env, deps)
    return
  }

  if (data.startsWith('seo:')) {
    if (!menu.canAccessSection(role, 'seo')) {
      await ctx.reply(menu.buildNoAccessReply())
      return
    }
    await handleSeoCallback(ctx, data, env, deps)
    return
  }

  if (data.startsWith('cards:')) {
    // Projects and Services currently share the exact same role requirement
    // in MENU_ITEMS (['owner', 'content_manager']) — checking either key's
    // access is equivalent to checking both, so one gate covers this whole
    // prefix regardless of which type a deeper callback concerns. If a future
    // plan gives the two types different roles, this gate must be split.
    if (!menu.canAccessSection(role, 'projects')) {
      await ctx.reply(menu.buildNoAccessReply())
      return
    }
    await dispatchCardsCallback(ctx, data, env, deps.cardsDispatch)
    return
  }

  if (data.startsWith('stub:')) {
    const section = data.slice('stub:'.length)
    if (!menu.canAccessSection(role, section)) {
      await ctx.reply(menu.buildNoAccessReply())
      return
    }
    await ctx.reply(menu.buildStubReply(section))
    return
  }

  // Everything below is owner-only (Administrators).
  if (role !== 'owner') {
    await ctx.reply(menu.buildNoAccessReply())
    return
  }

  if (data === 'menu:admins') {
    await showAdminsList(ctx, env, deps)
    return
  }

  if (data === 'admins:add') {
    await deps.sessions.save(ctx.chatId, { screen: 'admins_add_id' }, env)
    await ctx.reply(menu.buildAddIdPrompt())
    return
  }

  if (data.startsWith('admins:add:role:')) {
    const roleChoice = data.slice('admins:add:role:'.length) as ManagerRole
    const state = await deps.sessions.load(ctx.chatId, env)
    const telegramId = Number(state.data?.telegramId)
    if (!Number.isInteger(telegramId) || telegramId <= 0) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await deps.sessions.save(
      ctx.chatId,
      { screen: 'admins_add_label', data: { telegramId, role: roleChoice } },
      env,
    )
    await ctx.reply(menu.buildLabelPrompt())
    return
  }

  if (data === 'admins:add:skip_label') {
    await finishAddManager(ctx, env, deps, null)
    return
  }

  if (data === 'admins:remove:cancel') {
    await showAdminsList(ctx, env, deps)
    return
  }

  if (data.startsWith('admins:remove:confirm:')) {
    const telegramId = Number(data.slice('admins:remove:confirm:'.length))
    const { error } = await deps.admins.removeManager(telegramId, env)
    if (error) {
      await ctx.reply({ text: 'Could not remove the manager — please try again.' })
      return
    }
    await showAdminsList(ctx, env, deps)
    return
  }

  if (data.startsWith('admins:remove:')) {
    const telegramId = Number(data.slice('admins:remove:'.length))
    const managers = await deps.admins.listManagers(env)
    const target = managers.find((m) => m.telegramId === telegramId)
    if (!target) {
      await showAdminsList(ctx, env, deps)
      return
    }
    await ctx.reply(menu.buildRemoveConfirm(target))
  }
}

async function showContentList(ctx: BotCtx, env: Env, deps: DispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'content_list' }, env)
  await ctx.reply(menu.buildContentList())
}

async function showSectionDetail(
  ctx: BotCtx, env: Env, deps: DispatchDeps, key: string, saved = false,
): Promise<void> {
  const record = await deps.content.getSection(key, env)
  if (!record) {
    await ctx.reply({ text: 'Could not load that section — please try again.' })
    await showContentList(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'content_detail', data: { key } }, env)
  await ctx.reply(menu.buildSectionDetail(record, { saved }))
}

async function handleContentCallback(ctx: BotCtx, data: string, env: Env, deps: DispatchDeps): Promise<void> {
  if (data === 'content:list') {
    await showContentList(ctx, env, deps)
    return
  }
  if (data.startsWith('content:section:')) {
    await showSectionDetail(ctx, env, deps, data.slice('content:section:'.length))
    return
  }
  if (data.startsWith('content:field:')) {
    const field = data.slice('content:field:'.length) as ContentField
    const state = await deps.sessions.load(ctx.chatId, env)
    const key = state.data?.key as string | undefined
    if (!key) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'content_lang', data: { key, field } }, env)
    await ctx.reply(menu.buildContentFieldLangPrompt(key, field))
    return
  }
  if (data.startsWith('content:lang:')) {
    const lang = data.slice('content:lang:'.length) as 'en' | 'uk'
    const state = await deps.sessions.load(ctx.chatId, env)
    const key = state.data?.key as string | undefined
    const field = state.data?.field as ContentField | undefined
    if (!key || !field) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    const record = await deps.content.getSection(key, env)
    if (!record) {
      await ctx.reply({ text: 'Could not load that section — please try again.' })
      await showContentList(ctx, env, deps)
      return
    }
    const current = menu.sectionFieldValue(record, field)
    await deps.sessions.save(ctx.chatId, { screen: 'content_value', data: { key, field, lang } }, env)
    await ctx.reply(menu.buildContentValuePrompt(field, lang, current[lang]))
  }
}

async function saveContentField(
  ctx: BotCtx, env: Env, deps: DispatchDeps, key: string, field: ContentField, lang: 'en' | 'uk', text: string,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const record = await deps.content.getSection(key, env)
  if (!record) {
    await ctx.reply({ text: 'Could not load that section — please try again.' })
    await showContentList(ctx, env, deps)
    return
  }
  const current = menu.sectionFieldValue(record, field)
  const nextValue = lang === 'en' ? { en: text, uk: current.uk } : { en: current.en, uk: text }
  const result = await handleAdminContent(
    { method: 'PUT', cookieHeader, body: { kind: 'section', key, patch: { [field]: nextValue } } },
    env,
    deps.adminContent,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildSaveFailed(`content:section:${key}`))
    return
  }
  await showSectionDetail(ctx, env, deps, key, true)
}

async function showSeoList(ctx: BotCtx, env: Env, deps: DispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'seo_list' }, env)
  await ctx.reply(menu.buildSeoList())
}

async function showSeoDetail(
  ctx: BotCtx, env: Env, deps: DispatchDeps, pageKey: string, saved = false,
): Promise<void> {
  const record = await deps.content.getSeo(pageKey, env)
  if (!record) {
    await ctx.reply({ text: 'Could not load that page — please try again.' })
    await showSeoList(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'seo_detail', data: { pageKey } }, env)
  await ctx.reply(menu.buildSeoDetail(record, { saved }))
}

async function handleSeoCallback(ctx: BotCtx, data: string, env: Env, deps: DispatchDeps): Promise<void> {
  if (data === 'seo:list') {
    await showSeoList(ctx, env, deps)
    return
  }
  if (data.startsWith('seo:page:')) {
    await showSeoDetail(ctx, env, deps, data.slice('seo:page:'.length))
    return
  }
  if (data.startsWith('seo:field:')) {
    const field = data.slice('seo:field:'.length) as SeoField
    const state = await deps.sessions.load(ctx.chatId, env)
    const pageKey = state.data?.pageKey as string | undefined
    if (!pageKey) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'seo_lang', data: { pageKey, field } }, env)
    await ctx.reply(menu.buildSeoFieldLangPrompt(pageKey, field))
    return
  }
  if (data.startsWith('seo:lang:')) {
    const lang = data.slice('seo:lang:'.length) as 'en' | 'uk'
    const state = await deps.sessions.load(ctx.chatId, env)
    const pageKey = state.data?.pageKey as string | undefined
    const field = state.data?.field as SeoField | undefined
    if (!pageKey || !field) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    const record = await deps.content.getSeo(pageKey, env)
    if (!record) {
      await ctx.reply({ text: 'Could not load that page — please try again.' })
      await showSeoList(ctx, env, deps)
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'seo_value', data: { pageKey, field, lang } }, env)
    await ctx.reply(menu.buildSeoValuePrompt(field, lang, record[field][lang]))
  }
}

async function saveSeoField(
  ctx: BotCtx, env: Env, deps: DispatchDeps, pageKey: string, field: SeoField, lang: 'en' | 'uk', text: string,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const record = await deps.content.getSeo(pageKey, env)
  if (!record) {
    await ctx.reply({ text: 'Could not load that page — please try again.' })
    await showSeoList(ctx, env, deps)
    return
  }
  const current = record[field]
  const nextValue = lang === 'en' ? { en: text, uk: current.uk } : { en: current.en, uk: text }
  const result = await handleAdminContent(
    { method: 'PUT', cookieHeader, body: { kind: 'seo', pageKey, patch: { [field]: nextValue } } },
    env,
    deps.adminContent,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildSaveFailed(`seo:page:${pageKey}`))
    return
  }
  await showSeoDetail(ctx, env, deps, pageKey, true)
}

const TEXT_FALLBACK_REPLY = { text: 'Use the menu buttons below, or /start to see them again.' }

async function handleText(
  ctx: BotCtx,
  text: string,
  role: Role,
  env: Env,
  deps: DispatchDeps,
): Promise<void> {
  const state = await deps.sessions.load(ctx.chatId, env)

  if (state.screen === 'content_value') {
    if (!menu.canAccessSection(role, 'content')) {
      await ctx.reply(TEXT_FALLBACK_REPLY)
      return
    }
    const { key, field, lang } = state.data as { key: string; field: ContentField; lang: 'en' | 'uk' }
    await saveContentField(ctx, env, deps, key, field, lang, text)
    return
  }

  if (state.screen === 'seo_value') {
    if (!menu.canAccessSection(role, 'seo')) {
      await ctx.reply(TEXT_FALLBACK_REPLY)
      return
    }
    const { pageKey, field, lang } = state.data as { pageKey: string; field: SeoField; lang: 'en' | 'uk' }
    await saveSeoField(ctx, env, deps, pageKey, field, lang, text)
    return
  }

  if (state.screen === 'cards_value' || state.screen === 'cards_tags_value') {
    if (!menu.canAccessSection(role, 'projects')) {
      await ctx.reply(TEXT_FALLBACK_REPLY)
      return
    }
    await dispatchCardsText(ctx, text, env, deps.cardsDispatch)
    return
  }

  if (role !== 'owner') {
    await ctx.reply(TEXT_FALLBACK_REPLY)
    return
  }

  if (state.screen === 'admins_add_id') {
    const telegramId = Number(text)
    if (!Number.isInteger(telegramId) || telegramId <= 0) {
      await ctx.reply({ text: 'That does not look like a valid Telegram ID. Try again, or /start to cancel.' })
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'admins_add_role', data: { telegramId } }, env)
    await ctx.reply(menu.buildRolePrompt())
    return
  }

  if (state.screen === 'admins_add_label') {
    await finishAddManager(ctx, env, deps, text)
    return
  }

  await ctx.reply(TEXT_FALLBACK_REPLY)
}

async function finishAddManager(
  ctx: BotCtx,
  env: Env,
  deps: DispatchDeps,
  label: string | null,
): Promise<void> {
  const state = await deps.sessions.load(ctx.chatId, env)
  const telegramId = Number(state.data?.telegramId)
  const role = state.data?.role as ManagerRole
  if (!MANAGER_ROLES.includes(role)) {
    await ctx.reply({ text: 'Something went wrong — /start to try again.' })
    return
  }
  const { error } = await deps.admins.addManager({ telegramId, role, label, addedBy: ctx.fromId }, env)
  if (error) {
    await ctx.reply({ text: 'Could not add the manager — please try again.' })
    return
  }
  await showAdminsList(ctx, env, deps)
}
