import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleTelegramWebhook } from '../_lib/telegramHandler'
import { send } from '../_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const secretHeaderRaw = req.headers['x-telegram-bot-api-secret-token']
  const secretHeader = Array.isArray(secretHeaderRaw) ? secretHeaderRaw[0] : secretHeaderRaw
  const result = await handleTelegramWebhook(
    { secretHeader, body: req.body },
    {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_ADMIN_IDS: process.env.TELEGRAM_ADMIN_IDS,
      TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  )
  send(res, result)
}
