import { Bot } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const bypassSecret = process.env.VERCEL_PROTECTION_BYPASS_SECRET
const domain = process.argv[2]

if (!token || !secret || !domain) {
  console.error(
    'Usage: node --env-file=.env.local scripts/telegram-set-webhook.mjs <https-domain>\n' +
      'Example: node --env-file=.env.local scripts/telegram-set-webhook.mjs portfolio-three-rho-45ofj86fdk.vercel.app\n' +
      '(if VERCEL_PROTECTION_BYPASS_SECRET is set, it is appended to the URL so Telegram can reach a\n' +
      ' Deployment-Protection-guarded Preview deployment)',
  )
  process.exit(1)
}

const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
const url = bypassSecret
  ? `https://${cleanDomain}/api/telegram/webhook?x-vercel-protection-bypass=${bypassSecret}`
  : `https://${cleanDomain}/api/telegram/webhook`
const bot = new Bot(token)
await bot.api.setWebhook(url, { secret_token: secret })
console.log('Webhook set to', url)

const info = await bot.api.getWebhookInfo()
console.log(JSON.stringify(info, null, 2))
