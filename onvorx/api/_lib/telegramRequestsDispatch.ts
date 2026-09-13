import type { AuthEnv, SupabaseAdminEnv, TelegramEnv } from './types'
import { adminCookieHeader, type BotCtx } from './telegramDispatch'
import { handleAdminRequests, defaultAdminRequestsDeps, type AdminRequestsDeps } from './adminRequestsHandler'
import type { EstimateRequestDTO } from './adminRows'
import { defaultTelegramSessionsDeps, type TelegramSessionsDeps } from './telegramSessions'
import * as menu from './telegramMenu'
import type { RequestFilter } from './telegramMenu'

type Env = TelegramEnv & SupabaseAdminEnv & AuthEnv

export interface RequestsDispatchDeps {
  adminRequests: AdminRequestsDeps
  sessions: TelegramSessionsDeps
}

export const defaultRequestsDispatchDeps: RequestsDispatchDeps = {
  adminRequests: defaultAdminRequestsDeps,
  sessions: defaultTelegramSessionsDeps,
}

async function fetchRequests(env: Env, deps: RequestsDispatchDeps): Promise<EstimateRequestDTO[]> {
  const cookieHeader = adminCookieHeader(env)
  const result = await handleAdminRequests(
    { method: 'GET', cookieHeader: cookieHeader ?? undefined, body: undefined },
    env,
    deps.adminRequests,
  )
  if (result.status !== 200) return []
  const body = result.body as { requests: EstimateRequestDTO[] }
  return body.requests
}

function sortNewestFirst(requests: EstimateRequestDTO[]): EstimateRequestDTO[] {
  return [...requests].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

function filterByStatus(requests: EstimateRequestDTO[], filter: RequestFilter): EstimateRequestDTO[] {
  if (filter === 'all') return requests
  return requests.filter((r) => r.status === filter)
}

async function showFilterMenu(ctx: BotCtx, env: Env, deps: RequestsDispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'requests_filter' }, env)
  await ctx.reply(menu.buildRequestFilterMenu())
}

async function showList(ctx: BotCtx, filter: RequestFilter, env: Env, deps: RequestsDispatchDeps): Promise<void> {
  // Same reasoning as startStatusChange's gate: fetchRequests below is itself
  // auth-gated (it goes through handleAdminRequests's own requireSession/config
  // check), so a missing secret must not be misreported as "no requests match
  // this filter" — check config up front, before touching session state.
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'requests_list', data: { filter } }, env)
  const all = sortNewestFirst(await fetchRequests(env, deps))
  await ctx.reply(menu.buildRequestList(filter, filterByStatus(all, filter)))
}

async function showDetail(
  ctx: BotCtx, filter: RequestFilter, id: string, env: Env, deps: RequestsDispatchDeps, saved = false,
): Promise<void> {
  // Same reasoning as startStatusChange's gate: a missing secret would otherwise
  // make fetchRequests return [], which reads here as "no such request" and
  // resets the session to the filter menu — destroying the current
  // filter/id instead of failing fast and non-destructively.
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const all = await fetchRequests(env, deps)
  const req = all.find((r) => r.id === id)
  if (!req) {
    await ctx.reply({ text: 'Could not load that request — please try again.' })
    await showFilterMenu(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'requests_detail', data: { filter, id } }, env)
  await ctx.reply(menu.buildRequestDetail(req, { saved }))
}

async function startStatusChange(
  ctx: BotCtx, filter: RequestFilter, id: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  // Every Requests read AND write goes through handleAdminRequests, which itself
  // enforces requireSession — so a missing ADMIN_SESSION_SECRET makes even the
  // lookup below fail. Gate on the cookie header up front (matching saveStatus's
  // own gate) so a config error reports "not fully configured" instead of being
  // misread as "no such request", and so it does NOT reset the session away from
  // the current detail view before the user's next tap.
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const all = await fetchRequests(env, deps)
  const req = all.find((r) => r.id === id)
  if (!req) {
    await ctx.reply({ text: 'Could not load that request — please try again.' })
    await showFilterMenu(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'requests_status_choice', data: { filter, id } }, env)
  const current = menu.STATUS_LABEL[req.status] ?? req.status
  await ctx.reply(menu.buildRequestStatusPrompt(current, `requests:card:${id}`))
}

async function saveStatus(
  ctx: BotCtx, filter: RequestFilter, id: string, newStatus: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const result = await handleAdminRequests(
    { method: 'PATCH', cookieHeader, body: { id, status: newStatus } },
    env,
    deps.adminRequests,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`requests:card:${id}`))
    return
  }
  await showDetail(ctx, filter, id, env, deps, true)
}

async function startNoteEdit(
  ctx: BotCtx, filter: RequestFilter, id: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  // Same reasoning as startStatusChange's gate: fetchRequests below is itself
  // auth-gated, so check config up front rather than let a missing secret look
  // like "request not found" and reset the session out from under the user.
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const all = await fetchRequests(env, deps)
  const req = all.find((r) => r.id === id)
  if (!req) {
    await ctx.reply({ text: 'Could not load that request — please try again.' })
    await showFilterMenu(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'requests_note_value', data: { filter, id } }, env)
  await ctx.reply(menu.buildRequestNotePrompt(req.note))
}

async function saveNote(
  ctx: BotCtx, filter: RequestFilter, id: string, text: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const result = await handleAdminRequests(
    { method: 'PATCH', cookieHeader, body: { id, note: text } },
    env,
    deps.adminRequests,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`requests:card:${id}`))
    return
  }
  await showDetail(ctx, filter, id, env, deps, true)
}

async function startDelete(
  ctx: BotCtx, filter: RequestFilter, id: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  // Same reasoning as startStatusChange's gate.
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const all = await fetchRequests(env, deps)
  const req = all.find((r) => r.id === id)
  if (!req) {
    await ctx.reply({ text: 'Could not load that request — please try again.' })
    await showFilterMenu(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'requests_delete_confirm', data: { filter, id } }, env)
  await ctx.reply(menu.buildRequestDeleteConfirm(req.name))
}

async function confirmDelete(
  ctx: BotCtx, filter: RequestFilter, id: string, env: Env, deps: RequestsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const result = await handleAdminRequests(
    { method: 'DELETE', cookieHeader, body: { id } },
    env,
    deps.adminRequests,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`requests:card:${id}`))
    return
  }
  await showList(ctx, filter, env, deps)
}

export async function dispatchRequestsCallback(
  ctx: BotCtx, data: string, env: Env, deps: RequestsDispatchDeps = defaultRequestsDispatchDeps,
): Promise<void> {
  if (data === 'requests:list') {
    await showFilterMenu(ctx, env, deps)
    return
  }
  if (data.startsWith('requests:filter:')) {
    await showList(ctx, data.slice('requests:filter:'.length) as RequestFilter, env, deps)
    return
  }

  const state = await deps.sessions.load(ctx.chatId, env)
  const filter = state.data?.filter as RequestFilter | undefined
  const id = state.data?.id as string | undefined

  if (data.startsWith('requests:card:')) {
    if (!filter) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showDetail(ctx, filter, data.slice('requests:card:'.length), env, deps)
    return
  }
  if (data === 'requests:back:list') {
    if (!filter) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showList(ctx, filter, env, deps)
    return
  }
  if (data === 'requests:status') {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startStatusChange(ctx, filter, id, env, deps)
    return
  }
  if (data.startsWith('requests:status:')) {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await saveStatus(ctx, filter, id, data.slice('requests:status:'.length), env, deps)
    return
  }
  if (data === 'requests:note') {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startNoteEdit(ctx, filter, id, env, deps)
    return
  }
  if (data === 'requests:delete') {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startDelete(ctx, filter, id, env, deps)
    return
  }
  if (data === 'requests:delete:confirm') {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await confirmDelete(ctx, filter, id, env, deps)
    return
  }
  if (data === 'requests:delete:cancel') {
    if (!filter || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showDetail(ctx, filter, id, env, deps)
  }
}

export async function dispatchRequestsText(
  ctx: BotCtx, text: string, env: Env, deps: RequestsDispatchDeps = defaultRequestsDispatchDeps,
): Promise<void> {
  const state = await deps.sessions.load(ctx.chatId, env)
  if (state.screen !== 'requests_note_value') return
  const filter = state.data?.filter as RequestFilter | undefined
  const id = state.data?.id as string | undefined
  if (!filter || !id) {
    await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
    return
  }
  await saveNote(ctx, filter, id, text, env, deps)
}
