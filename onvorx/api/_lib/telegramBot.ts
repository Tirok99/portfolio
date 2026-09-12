import { Bot, InlineKeyboard, type ApiClientOptions, type Context } from 'grammy'
import type { SupabaseAdminEnv, TelegramEnv } from './types'
import { dispatch, defaultDispatchDeps, type BotCtx, type DispatchDeps } from './telegramDispatch'
import type { BotReply } from './telegramMenu'

type Env = TelegramEnv & SupabaseAdminEnv

let cached: { token: string; botPromise: Promise<Bot> } | null = null

function toBotCtx(ctx: Context): BotCtx | null {
  const chatId = ctx.chatId
  const fromId = ctx.from?.id
  if (chatId == null || fromId == null) return null
  return {
    chatId,
    fromId,
    text: ctx.message?.text,
    callbackData: ctx.callbackQuery?.data,
    reply: async (r: BotReply) => {
      await ctx.reply(r.text, r.keyboard ? { reply_markup: r.keyboard as InlineKeyboard } : undefined)
    },
    answerCallback: async () => {
      await ctx.answerCallbackQuery()
    },
  }
}

function registerHandlers(bot: Bot, env: Env, deps: DispatchDeps): void {
  bot.on(['message:text', 'callback_query:data'], async (ctx) => {
    const botCtx = toBotCtx(ctx)
    if (botCtx) await dispatch(botCtx, env, deps)
  })
}

/**
 * `client` is a test-only seam: passing a fake `fetch` lets a test drive a
 * real `Bot` (real `getMe`, real Update parsing, real `ctx.reply`) without
 * making a real network call. Production code never passes it.
 */
export function getBot(
  env: Env,
  deps: DispatchDeps = defaultDispatchDeps,
  client?: ApiClientOptions,
): Promise<Bot> {
  const token = env.TELEGRAM_BOT_TOKEN ?? ''
  if (cached && cached.token === token) return cached.botPromise
  const botPromise = (async () => {
    const bot = new Bot(token, { client })
    registerHandlers(bot, env, deps)
    await bot.init()
    return bot
  })()
  cached = { token, botPromise }
  return botPromise
}
