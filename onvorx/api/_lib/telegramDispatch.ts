import type { SupabaseAdminEnv, TelegramEnv } from './types'
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
import * as menu from './telegramMenu'

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
}

export const defaultDispatchDeps: DispatchDeps = {
  admins: defaultTelegramAdminsDeps,
  sessions: defaultTelegramSessionsDeps,
}

type Env = TelegramEnv & SupabaseAdminEnv

export async function dispatch(
  ctx: BotCtx,
  env: Env,
  deps: DispatchDeps = defaultDispatchDeps,
): Promise<void> {
  const role = await resolveRole(ctx.fromId, env, deps.admins)
  if (!role) {
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

  if (data.startsWith('stub:')) {
    const section = data.slice('stub:'.length)
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
    await deps.admins.removeManager(telegramId, env)
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

async function handleText(
  ctx: BotCtx,
  text: string,
  role: Role,
  env: Env,
  deps: DispatchDeps,
): Promise<void> {
  if (role !== 'owner') return
  const state = await deps.sessions.load(ctx.chatId, env)

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
  }
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
  await deps.admins.addManager({ telegramId, role, label, addedBy: ctx.fromId }, env)
  await showAdminsList(ctx, env, deps)
}
