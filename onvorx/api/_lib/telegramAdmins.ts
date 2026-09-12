import type { SupabaseAdminEnv, TelegramEnv } from './types'
import { getSupabaseAdmin } from './supabaseAdmin'

export type ManagerRole = 'content_manager' | 'sales_manager'
export type Role = 'owner' | ManagerRole
export const MANAGER_ROLES: ManagerRole[] = ['content_manager', 'sales_manager']

export interface ManagerRecord {
  telegramId: number
  role: ManagerRole
  label: string | null
  addedBy: number
  createdAt: string
}

type Env = TelegramEnv & SupabaseAdminEnv

export interface TelegramAdminsDeps {
  findManager: (telegramId: number, env: Env) => Promise<ManagerRecord | null>
  listManagers: (env: Env) => Promise<ManagerRecord[]>
  addManager: (
    record: { telegramId: number; role: ManagerRole; label: string | null; addedBy: number },
    env: Env,
  ) => Promise<{ error: string | null }>
  removeManager: (telegramId: number, env: Env) => Promise<{ error: string | null }>
}

const fromRow = (row: Record<string, unknown>): ManagerRecord => ({
  telegramId: Number(row.telegram_id),
  role: row.role as ManagerRole,
  label: (row.label as string | null) ?? null,
  addedBy: Number(row.added_by),
  createdAt: String(row.created_at),
})

export const defaultTelegramAdminsDeps: TelegramAdminsDeps = {
  findManager: async (telegramId, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return null
    const { data, error } = await c
      .from('telegram_admins')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle()
    if (error || !data) return null
    return fromRow(data)
  },
  listManagers: async (env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return []
    const { data, error } = await c
      .from('telegram_admins')
      .select('*')
      .order('created_at', { ascending: true })
    if (error || !data) return []
    return data.map(fromRow)
  },
  addManager: async (record, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from('telegram_admins').insert({
      telegram_id: record.telegramId,
      role: record.role,
      label: record.label,
      added_by: record.addedBy,
    })
    return { error: error ? error.message : null }
  },
  removeManager: async (telegramId, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from('telegram_admins').delete().eq('telegram_id', telegramId)
    return { error: error ? error.message : null }
  },
}

/** Owners are a hardcoded env-var whitelist, never rows in a table — see
 * spec §1 "Роли и доступ": this guarantees a bug in manager-management code
 * can never demote or delete the site owner. */
export function parseOwnerIds(env: TelegramEnv): number[] {
  return (env.TELEGRAM_ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
}

export function isOwner(telegramId: number, env: TelegramEnv): boolean {
  return parseOwnerIds(env).includes(telegramId)
}

export async function resolveRole(
  telegramId: number,
  env: Env,
  deps: TelegramAdminsDeps = defaultTelegramAdminsDeps,
): Promise<Role | null> {
  if (isOwner(telegramId, env)) return 'owner'
  const manager = await deps.findManager(telegramId, env)
  return manager ? manager.role : null
}
