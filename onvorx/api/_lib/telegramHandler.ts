import type { Update } from 'grammy/types'
import type { HandlerResult, SupabaseAdminEnv, TelegramEnv } from './types'
import { getBot } from './telegramBot'
import type { DispatchDeps } from './telegramDispatch'
import { safeEqual } from './session'

type Env = TelegramEnv & SupabaseAdminEnv

export async function handleTelegramWebhook(
  input: { secretHeader: string | undefined; body: unknown },
  env: Env,
  deps?: DispatchDeps,
): Promise<HandlerResult> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    return { status: 500, body: { error: 'not_configured' } }
  }
  if (typeof input.secretHeader !== 'string' || !safeEqual(input.secretHeader, env.TELEGRAM_WEBHOOK_SECRET)) {
    return { status: 401, body: { error: 'unauthorized' } }
  }
  try {
    const bot = await getBot(env, deps)
    await bot.handleUpdate(input.body as Update)
  } catch (err) {
    console.error('telegram webhook handling failed', err)
  }
  return { status: 200, body: { ok: true } }
}
