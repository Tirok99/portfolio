import { randomBytes } from 'node:crypto'
import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'
import type { HandlerResult, AuthEnv, SupabaseAdminEnv } from './types'
import { requireSession } from './handlers'
import { getSupabaseAdmin } from './supabaseAdmin'

type Env = AuthEnv & SupabaseAdminEnv
const FOLDERS = ['projects', 'services', 'cards'] as const
const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}
const MAX_BYTES = 2_000_000

// A single DOMPurify instance backed by a blank jsdom window, reused across
// requests (Fluid Compute keeps the module warm) rather than rebuilt per call.
const svgSanitizer = createDOMPurify(new JSDOM('').window)

/**
 * Strips scripts, event-handler attributes, and other executable content
 * from an uploaded SVG before it's stored — an SVG is XML, and browsers will
 * run a <script> or an onload="" attribute inside one rendered via <img> in
 * some contexts, so this can't be treated as inert image data like a PNG.
 * Returns null if sanitizing destroyed the document entirely (garbage input,
 * or nothing survived that could plausibly be a real icon).
 */
function sanitizeSvg(bytes: Buffer): Buffer | null {
  const clean = svgSanitizer.sanitize(bytes.toString('utf8'), {
    USE_PROFILES: { svg: true, svgFilters: true },
  })
  if (!/<svg[\s>]/i.test(clean)) return null
  return Buffer.from(clean, 'utf8')
}

export interface AdminUploadDeps {
  put: (
    folder: string,
    key: string,
    bytes: Buffer,
    contentType: string,
    env: Env,
  ) => Promise<{ url: string; path: string; error: string | null }>
  del: (path: string, env: Env) => Promise<{ error: string | null }>
}

const bucket = (env: Env): string => env.SUPABASE_MEDIA_BUCKET ?? 'public-media'

export const defaultAdminUploadDeps: AdminUploadDeps = {
  put: async (_folder, key, bytes, contentType, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { url: '', path: '', error: 'not_configured' }
    const { error } = await c.storage.from(bucket(env)).upload(key, bytes, { contentType, upsert: false })
    if (error) return { url: '', path: '', error: error.message }
    const { data } = c.storage.from(bucket(env)).getPublicUrl(key)
    return { url: data.publicUrl, path: key, error: null }
  },
  del: async (path, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.storage.from(bucket(env)).remove([path])
    return { error: error ? error.message : null }
  },
}

const bad = (): HandlerResult => ({ status: 400, body: { error: 'invalid_request' } })
const slugify = (name: string): string =>
  name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'image'

export async function handleAdminUpload(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: Env,
  deps: AdminUploadDeps = defaultAdminUploadDeps,
): Promise<HandlerResult> {
  if (!requireSession(input.cookieHeader, env)) return { status: 401, body: { error: 'unauthorized' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 500, body: { error: 'not_configured' } }
  const body = (input.body ?? {}) as Record<string, unknown>

  if (input.method === 'DELETE') {
    const path = body.path
    if (typeof path !== 'string' || !FOLDERS.some((f) => path.startsWith(`${f}/`)) || path.includes('..')) return bad()
    const { error } = await deps.del(path, env)
    return error ? { status: 500, body: { error: 'delete_failed' } } : { status: 200, body: { ok: true } }
  }
  if (input.method === 'POST') {
    const { dataUrl, fileName, folder } = body as { dataUrl?: unknown; fileName?: unknown; folder?: unknown }
    if (typeof dataUrl !== 'string' || typeof fileName !== 'string') return bad()
    if (!(FOLDERS as readonly string[]).includes(folder as string)) return bad()
    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl)
    if (!m) return bad()
    const mime = m[1]
    const ext = MIME_EXT[mime]
    if (!ext) return bad()
    let bytes: Buffer = Buffer.from(m[2], 'base64')
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return bad()
    if (mime === 'image/svg+xml') {
      const clean = sanitizeSvg(bytes)
      if (!clean) return bad()
      bytes = clean
    }
    const key = `${folder as string}/${slugify(fileName)}-${randomBytes(4).toString('hex')}.${ext}`
    const { url, error } = await deps.put(folder as string, key, bytes, mime, env)
    if (error) return { status: 500, body: { error: 'upload_failed' } }
    return { status: 200, body: { url, path: key } }
  }
  return { status: 405, body: { error: 'method_not_allowed' } }
}
