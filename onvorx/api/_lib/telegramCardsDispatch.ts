import type { AuthEnv, SupabaseAdminEnv, TelegramEnv } from './types'
import { adminCookieHeader, type BotCtx } from './telegramDispatch'
import {
  defaultTelegramCardsDeps,
  type TelegramCardsDeps,
  type ProjectCardRecord,
  type ServiceCardRecord,
  type ProjectField,
  type ServiceField,
} from './telegramCards'
import { handleAdminCards, defaultAdminCardsDeps, type AdminCardsDeps } from './adminCardsHandler'
import { defaultAdminUploadDeps, type AdminUploadDeps } from './adminUploadHandler'
import { defaultTelegramSessionsDeps, type TelegramSessionsDeps, type TelegramState } from './telegramSessions'
import * as menu from './telegramMenu'

type Env = TelegramEnv & SupabaseAdminEnv & AuthEnv
type CardType = 'projects' | 'services'
type CardList = 'home' | 'page'

export interface CardsDispatchDeps {
  cards: TelegramCardsDeps
  adminCards: AdminCardsDeps
  adminUpload: AdminUploadDeps
  sessions: TelegramSessionsDeps
}

export const defaultCardsDispatchDeps: CardsDispatchDeps = {
  cards: defaultTelegramCardsDeps,
  adminCards: defaultAdminCardsDeps,
  adminUpload: defaultAdminUploadDeps,
  sessions: defaultTelegramSessionsDeps,
}

const singularType = (type: CardType): 'project' | 'service' => (type === 'projects' ? 'project' : 'service')

async function loadState(ctx: BotCtx, env: Env, deps: CardsDispatchDeps): Promise<TelegramState> {
  return deps.sessions.load(ctx.chatId, env)
}

// ---- list / detail rendering ----

async function showTabs(ctx: BotCtx, type: CardType, env: Env, deps: CardsDispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'cards_tabs', data: { type } }, env)
  await ctx.reply(menu.buildCardTypeTabs(type))
}

async function showList(ctx: BotCtx, type: CardType, list: CardList, env: Env, deps: CardsDispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'cards_list', data: { type, list } }, env)
  if (type === 'projects') {
    const cards = await deps.cards.listProjects(list, env)
    await ctx.reply(menu.buildProjectList(list, cards))
  } else {
    const cards = await deps.cards.listServices(list, env)
    await ctx.reply(menu.buildServiceList(list, cards))
  }
}

async function showDetail(
  ctx: BotCtx, type: CardType, list: CardList, id: string, env: Env, deps: CardsDispatchDeps, saved = false,
): Promise<void> {
  if (type === 'projects') {
    const all = await deps.cards.listProjects(list, env)
    const index = all.findIndex((c) => c.id === id)
    if (index < 0) {
      await ctx.reply({ text: 'Could not load that card — please try again.' })
      await showList(ctx, type, list, env, deps)
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'cards_detail', data: { type, list, id } }, env)
    await ctx.reply(menu.buildProjectDetail(all[index], { index, total: all.length }, { saved }))
  } else {
    const all = await deps.cards.listServices(list, env)
    const index = all.findIndex((c) => c.id === id)
    if (index < 0) {
      await ctx.reply({ text: 'Could not load that card — please try again.' })
      await showList(ctx, type, list, env, deps)
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'cards_detail', data: { type, list, id } }, env)
    await ctx.reply(menu.buildServiceDetail(all[index], { index, total: all.length }, { saved }))
  }
}

// ---- field edit (L fields: title, description/text, imageAlt) ----

const PROJECT_FIELD_LABEL: Record<ProjectField, string> = {
  title: 'Title', description: 'Description', imageAlt: 'Image alt text', tags: 'Tags',
}
const SERVICE_FIELD_LABEL: Record<ServiceField, string> = { title: 'Title', text: 'Text' }

function fieldLabel(type: CardType, field: string): string {
  return type === 'projects'
    ? PROJECT_FIELD_LABEL[field as ProjectField]
    : SERVICE_FIELD_LABEL[field as ServiceField]
}

function fieldValue(
  type: CardType, card: ProjectCardRecord | ServiceCardRecord, field: string,
): { en: string; uk: string } {
  if (type === 'projects') {
    const p = card as ProjectCardRecord
    if (field === 'imageAlt') return p.imageAlt
    if (field === 'description') return p.description
    return p.title
  }
  const s = card as ServiceCardRecord
  if (field === 'text') return s.text
  return s.title
}

async function startFieldEdit(
  ctx: BotCtx, type: CardType, list: CardList, id: string, field: string, env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  if (field === 'tags') {
    const card = await deps.cards.getProject(list, id, env)
    if (!card) {
      await ctx.reply({ text: 'Could not load that card — please try again.' })
      await showList(ctx, type, list, env, deps)
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'cards_tags_value', data: { type, list, id } }, env)
    await ctx.reply(menu.buildTagsPrompt(card.tags))
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'cards_lang', data: { type, list, id, field } }, env)
  await ctx.reply(menu.buildCardFieldLangPrompt(fieldLabel(type, field), `cards:card:${id}`))
}

async function startValuePrompt(
  ctx: BotCtx, type: CardType, list: CardList, id: string, field: string, lang: 'en' | 'uk',
  env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const card = type === 'projects' ? await deps.cards.getProject(list, id, env) : await deps.cards.getService(list, id, env)
  if (!card) {
    await ctx.reply({ text: 'Could not load that card — please try again.' })
    await showList(ctx, type, list, env, deps)
    return
  }
  const current = fieldValue(type, card, field)
  await deps.sessions.save(ctx.chatId, { screen: 'cards_value', data: { type, list, id, field, lang } }, env)
  await ctx.reply(menu.buildCardValuePrompt(fieldLabel(type, field), lang, current[lang]))
}

async function saveFieldValue(
  ctx: BotCtx, type: CardType, list: CardList, id: string, field: string, lang: 'en' | 'uk', text: string,
  env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const card = type === 'projects' ? await deps.cards.getProject(list, id, env) : await deps.cards.getService(list, id, env)
  if (!card) {
    await ctx.reply({ text: 'Could not load that card — please try again.' })
    await showList(ctx, type, list, env, deps)
    return
  }
  const current = fieldValue(type, card, field)
  const nextValue = lang === 'en' ? { en: text, uk: current.uk } : { en: current.en, uk: text }
  const result = await handleAdminCards(
    {
      method: 'PUT',
      cookieHeader,
      query: { type: singularType(type) },
      body: { list, id, patch: { [field]: nextValue } },
    },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  await showDetail(ctx, type, list, id, env, deps, true)
}

async function saveTags(
  ctx: BotCtx, list: CardList, id: string, text: string, env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const tags = text.split(',').map((t) => t.trim()).filter(Boolean)
  const result = await handleAdminCards(
    { method: 'PUT', cookieHeader, query: { type: 'project' }, body: { list, id, patch: { tags } } },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  await showDetail(ctx, 'projects', list, id, env, deps, true)
}

// ---- toggles ----

async function toggleField(
  ctx: BotCtx, type: CardType, list: CardList, id: string, field: 'published' | 'featured',
  env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const card = type === 'projects' ? await deps.cards.getProject(list, id, env) : await deps.cards.getService(list, id, env)
  if (!card) {
    await ctx.reply({ text: 'Could not load that card — please try again.' })
    await showList(ctx, type, list, env, deps)
    return
  }
  const current = field === 'published' ? card.published : (card as ServiceCardRecord).featured
  const result = await handleAdminCards(
    { method: 'PUT', cookieHeader, query: { type: singularType(type) }, body: { list, id, patch: { [field]: !current } } },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  await showDetail(ctx, type, list, id, env, deps)
}

// ---- reorder ----

function orderedIdsAfterMove(cards: { id: string; sort: number }[], id: string, dir: 'up' | 'down'): string[] {
  const sorted = [...cards].sort((a, b) => a.sort - b.sort)
  const i = sorted.findIndex((c) => c.id === id)
  if (i < 0) return sorted.map((c) => c.id)
  const j = dir === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= sorted.length) return sorted.map((c) => c.id)
  ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
  return sorted.map((c) => c.id)
}

async function moveCard(
  ctx: BotCtx, type: CardType, list: CardList, id: string, dir: 'up' | 'down', env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const all = type === 'projects' ? await deps.cards.listProjects(list, env) : await deps.cards.listServices(list, env)
  const orderedIds = orderedIdsAfterMove(all, id, dir)
  const result = await handleAdminCards(
    { method: 'POST', cookieHeader, query: { type: singularType(type) }, body: { list, op: 'reorder', orderedIds } },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  await showDetail(ctx, type, list, id, env, deps)
}

// ---- delete ----

async function startDelete(
  ctx: BotCtx, type: CardType, list: CardList, id: string, env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const card = type === 'projects' ? await deps.cards.getProject(list, id, env) : await deps.cards.getService(list, id, env)
  if (!card) {
    await ctx.reply({ text: 'Could not load that card — please try again.' })
    await showList(ctx, type, list, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'cards_delete_confirm', data: { type, list, id } }, env)
  await ctx.reply(menu.buildCardDeleteConfirm(card.title.en || id, singularType(type)))
}

async function confirmDelete(
  ctx: BotCtx, type: CardType, list: CardList, id: string, env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const result = await handleAdminCards(
    { method: 'DELETE', cookieHeader, query: { type: singularType(type) }, body: { list, id } },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  await showList(ctx, type, list, env, deps)
}

// ---- callback entry point ----

export async function dispatchCardsCallback(
  ctx: BotCtx, data: string, env: Env, deps: CardsDispatchDeps = defaultCardsDispatchDeps,
): Promise<void> {
  if (data === 'cards:projects:list' || data === 'cards:services:list') {
    await showTabs(ctx, data.split(':')[1] as CardType, env, deps)
    return
  }
  if (data.startsWith('cards:projects:tab:') || data.startsWith('cards:services:tab:')) {
    const parts = data.split(':') // ['cards', type, 'tab', list]
    await showList(ctx, parts[1] as CardType, parts[3] as CardList, env, deps)
    return
  }

  const state = await loadState(ctx, env, deps)
  const type = state.data?.type as CardType | undefined
  const list = state.data?.list as CardList | undefined
  const id = state.data?.id as string | undefined

  if (data.startsWith('cards:card:')) {
    if (!type || !list) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showDetail(ctx, type, list, data.slice('cards:card:'.length), env, deps)
    return
  }
  if (data === 'cards:back:list') {
    if (!type || !list) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showList(ctx, type, list, env, deps)
    return
  }
  if (data.startsWith('cards:field:')) {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startFieldEdit(ctx, type, list, id, data.slice('cards:field:'.length), env, deps)
    return
  }
  if (data.startsWith('cards:lang:')) {
    const field = state.data?.field as string | undefined
    if (!type || !list || !id || !field) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startValuePrompt(ctx, type, list, id, field, data.slice('cards:lang:'.length) as 'en' | 'uk', env, deps)
    return
  }
  if (data === 'cards:toggle:published' || data === 'cards:toggle:featured') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await toggleField(ctx, type, list, id, data === 'cards:toggle:published' ? 'published' : 'featured', env, deps)
    return
  }
  if (data === 'cards:move:up' || data === 'cards:move:down') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await moveCard(ctx, type, list, id, data === 'cards:move:up' ? 'up' : 'down', env, deps)
    return
  }
  if (data === 'cards:delete') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startDelete(ctx, type, list, id, env, deps)
    return
  }
  if (data === 'cards:delete:confirm') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await confirmDelete(ctx, type, list, id, env, deps)
    return
  }
  if (data === 'cards:delete:cancel') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showDetail(ctx, type, list, id, env, deps)
    return
  }
  // cards:image:* is handled in Task 4 (photo capability) — this task does not
  // add those branches yet, so an image:* tap here would fall through to no
  // reply. That is fine: Task 4 lands in the same PR-series before this branch
  // ships to production, and its own tests cover cards:image:*.
}

// ---- text entry point (field values, tags) ----

export async function dispatchCardsText(
  ctx: BotCtx, text: string, env: Env, deps: CardsDispatchDeps = defaultCardsDispatchDeps,
): Promise<void> {
  const state = await loadState(ctx, env, deps)
  const type = state.data?.type as CardType | undefined
  const list = state.data?.list as CardList | undefined
  const id = state.data?.id as string | undefined

  if (state.screen === 'cards_value') {
    const field = state.data?.field as string | undefined
    const lang = state.data?.lang as 'en' | 'uk' | undefined
    if (!type || !list || !id || !field || !lang) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await saveFieldValue(ctx, type, list, id, field, lang, text, env, deps)
    return
  }
  if (state.screen === 'cards_tags_value') {
    if (!list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await saveTags(ctx, list, id, text, env, deps)
    return
  }
}
