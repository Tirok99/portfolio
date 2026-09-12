import { Bot } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const domain = process.argv[2]

if (!token || !secret || !domain) {
  console.error(
    'Usage: node --env-file=.env.local scripts/telegram-set-webhook.mjs <https-domain>\n' +
      'Example: node --env-file=.env.local scripts/telegram-set-webhook.mjs portfolio-three-rho-45ofj86fdk.vercel.app',
  )
  process.exit(1)
}

const url = `https://${domain}/api/telegram/webhook`
const bot = new Bot(token)
await bot.api.setWebhook(url, { secret_token: secret })
console.log('Webhook set to', url)

const info = await bot.api.getWebhookInfo()
console.log(JSON.stringify(info, null, 2))
