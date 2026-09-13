import { Bot, type ApiClientOptions, type Context } from 'grammy'
import type { AuthEnv, SupabaseAdminEnv, TelegramEnv } from './types'
import { dispatch, defaultDispatchDeps, type BotCtx, type DispatchDeps } from './telegramDispatch'
import type { BotReply } from './telegramMenu'

type Env = TelegramEnv & SupabaseAdminEnv & AuthEnv

let cached: { token: string; botPromise: Promise<Bot> } | null = null

async function toBotCtx(ctx: Context): Promise<BotCtx | null> {
  const chatId = ctx.chatId
  const fromId = ctx.from?.id
  if (chatId == null || fromId == null) return null

  let photoDataUrl: string | undefined
  const photoSizes = ctx.message?.photo
  if (photoSizes && photoSizes.length > 0) {
    try {
      const largest = photoSizes[photoSizes.length - 1]
      const file = await ctx.api.getFile(largest.file_id)
      if (file.file_path) {
        const token = ctx.api.token
        const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`)
        if (res.ok) {
          const bytes = Buffer.from(await res.arrayBuffer())
          photoDataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`
        }
      }
    } catch {
      // Leave photoDataUrl undefined — dispatch replies "please send a photo
      // again" for any cards_photo_wait step that never got one, so a flaky
      // download degrades gracefully instead of crashing the update.
    }
  }

  return {
    chatId,
    fromId,
    text: ctx.message?.text,
    callbackData: ctx.callbackQuery?.data,
    photoDataUrl,
    reply: async (r: BotReply) => {
      await ctx.reply(r.text, r.keyboard ? { reply_markup: r.keyboard } : undefined)
    },
    answerCallback: async () => {
      try {
        await ctx.answerCallbackQuery()
      } catch {
        // best-effort: an expired/already-answered query shouldn't abort the reply
      }
    },
  }
}

function registerHandlers(bot: Bot, env: Env, deps: DispatchDeps): void {
  bot.on(['message:text', 'message:photo', 'callback_query:data'], async (ctx) => {
    const botCtx = await toBotCtx(ctx)
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
  botPromise.catch(() => {
    if (cached?.botPromise === botPromise) cached = null
  })
  return botPromise
}
