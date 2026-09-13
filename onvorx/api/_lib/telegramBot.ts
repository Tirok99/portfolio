import { Bot, type ApiClientOptions, type Context } from 'grammy'
import type { AuthEnv, SupabaseAdminEnv, TelegramEnv } from './types'
import { dispatch, defaultDispatchDeps, type BotCtx, type DispatchDeps } from './telegramDispatch'
import type { BotReply } from './telegramMenu'

type Env = TelegramEnv & SupabaseAdminEnv & AuthEnv

let cached: { token: string; botPromise: Promise<Bot> } | null = null

// Telegram photo messages are always re-compressed to JPEG server-side, which
// has no alpha channel — uploading a transparent-background PNG icon that way
// bakes in a solid-color box where the transparency used to be. A "document"
// (file) message is NOT recompressed — the original bytes and MIME type
// survive untouched — so accepting `message:document` alongside
// `message:photo` for the same "Replace image" flow lets a PNG icon keep its
// transparency, as long as its MIME type is one adminUploadHandler accepts.
const ACCEPTED_DOCUMENT_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

async function downloadTelegramFileBytes(ctx: Context, fileId: string): Promise<Buffer | null> {
  try {
    const file = await ctx.api.getFile(fileId)
    if (!file.file_path) return null
    const token = ctx.api.token
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function toBotCtx(ctx: Context): Promise<BotCtx | null> {
  const chatId = ctx.chatId
  const fromId = ctx.from?.id
  if (chatId == null || fromId == null) return null

  let photoDataUrl: string | undefined
  let isPhotoMessage = false

  const photoSizes = ctx.message?.photo
  const document = ctx.message?.document

  if (photoSizes && photoSizes.length > 0) {
    isPhotoMessage = true
    const largest = photoSizes[photoSizes.length - 1]
    const bytes = await downloadTelegramFileBytes(ctx, largest.file_id)
    // Leave photoDataUrl undefined on a failed download — isPhotoMessage
    // stays true (already set above, independent of download success), so
    // dispatch() can tell "a photo that failed to download" apart from "not
    // a photo at all" and reply with a clear message instead of going silent.
    if (bytes) photoDataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`
  } else if (document?.mime_type && ACCEPTED_DOCUMENT_MIME.has(document.mime_type)) {
    isPhotoMessage = true
    const bytes = await downloadTelegramFileBytes(ctx, document.file_id)
    if (bytes) photoDataUrl = `data:${document.mime_type};base64,${bytes.toString('base64')}`
  } else if (document) {
    // A document was sent, but its MIME type isn't an accepted image type (or
    // is missing) — treat it as a failed upload attempt so the user gets the
    // same clear "could not process" reply instead of the update being
    // silently ignored.
    isPhotoMessage = true
  }

  return {
    chatId,
    fromId,
    text: ctx.message?.text,
    callbackData: ctx.callbackQuery?.data,
    photoDataUrl,
    isPhotoMessage,
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
  bot.on(['message:text', 'message:photo', 'message:document', 'callback_query:data'], async (ctx) => {
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
