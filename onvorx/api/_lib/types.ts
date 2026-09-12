export interface AuthEnv {
  ADMIN_PASSWORD?: string
  ADMIN_SESSION_SECRET?: string
}

export interface HandlerResult {
  status: number
  body: unknown
  setCookie?: string
}

export interface SupabaseAdminEnv {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  SUPABASE_MEDIA_BUCKET?: string
}

export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_ADMIN_IDS?: string
  TELEGRAM_WEBHOOK_SECRET?: string
}
