import type { SupabaseAdminEnv } from './types'
import { getSupabaseAdmin } from './supabaseAdmin'

export interface TelegramState {
  screen: string
  data?: Record<string, unknown>
}

export const MAIN_MENU_STATE: TelegramState = { screen: 'main_menu' }

export interface TelegramSessionsDeps {
  load: (chatId: number, env: SupabaseAdminEnv) => Promise<TelegramState>
  save: (chatId: number, state: TelegramState, env: SupabaseAdminEnv) => Promise<void>
}

const isState = (v: unknown): v is TelegramState =>
  typeof v === 'object' && v !== null && typeof (v as { screen?: unknown }).screen === 'string'

export const defaultTelegramSessionsDeps: TelegramSessionsDeps = {
  load: async (chatId, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return MAIN_MENU_STATE
    const { data, error } = await c
      .from('telegram_sessions')
      .select('state')
      .eq('chat_id', chatId)
      .maybeSingle()
    if (error || !data || !isState(data.state)) return MAIN_MENU_STATE
    return data.state
  },
  save: async (chatId, state, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return
    await c.from('telegram_sessions').upsert({ chat_id: chatId, state })
  },
}
