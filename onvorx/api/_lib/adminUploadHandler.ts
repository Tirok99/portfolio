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
const svgWindow = new JSDOM('').window
const svgSanitizer = createDOMPurify(svgWindow)
// DOMPurify returns its input UNCHANGED if it decides it can't run in this
// environment (e.g. the window it's given doesn't look like a real
// document) — for every other caller that's a graceful no-op, but here it
// would silently turn this function into a pass-through for hostile SVGs.
// Fail loudly at module load instead of failing open on every request.
if (!svgSanitizer.isSupported) {
  throw new Error('svg sanitizer unavailable: DOMPurify.isSupported is false for this jsdom window')
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Strips scripts, event-handler attributes, and other executable content
 * from an uploaded SVG before it's stored — an SVG is XML, and browsers will
 * run a <script> or an onload="" attribute inside one rendered via <img> in
 * some contexts, so this can't be treated as inert image data like a PNG.
 * Also validates the SANITIZED output is well-formed, namespaced SVG with
 * actual content — DOMPurify's job is to remove dangerous nodes, not to
 * guarantee what's left still parses or renders, and a regex check on a
 * substring can't tell a real icon from a blank or browser-rejected one.
 * Returns null if the result isn't a usable icon.
 */
function sanitizeSvg(bytes: Buffer): Buffer | null {
  const clean = svgSanitizer.sanitize(bytes.toString('utf8'), {
    USE_PROFILES: { svg: true, svgFilters: true },
    // No legitimate icon needs an external image, a link, or a <style>
    // block — dropping them closes off tracking-pixel-style requests that
    // survive the svg profile untouched (they can't run script, but they
    // can phone home the moment the file is opened directly).
    FORBID_TAGS: ['style', 'image', 'a', 'title', 'metadata'],
    FORBID_ATTR: ['style'],
  })
  const doc = new svgWindow.DOMParser().parseFromString(clean, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return null
  const root = doc.documentElement
  if (!root || root.localName !== 'svg' || !root.firstElementChild) return null
  if (root.namespaceURI !== SVG_NS) {
    // Common with icons copy-pasted from an inline <svg> in someone else's
    // markup: valid XML, but with no xmlns, so it parses into no namespace
    // at all rather than the SVG one. Browsers require the namespace to
    // render it — reject anything already namespaced to something ELSE,
    // but repair the common no-namespace case by declaring it explicitly.
    if (root.namespaceURI) return null
    root.setAttribute('xmlns', SVG_NS)
  }
  const serialized = new svgWindow.XMLSerializer().serializeToString(doc)
  return Buffer.from(serialized, 'utf8')
}

const MIME_SIGNATURE: Record<string, (bytes: Buffer) => boolean> = {
  'image/png': (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) => b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  // Sniffed loosely on purpose: the real gatekeeper for SVG is sanitizeSvg's
  // own DOMParser validation below, not this — this check only exists to
  // stop a payload of one type being smuggled in under another type's label.
  'image/svg+xml': (b) => /^\s*(<\?xml|<!doctype\s+svg|<svg[\s>])/i.test(b.subarray(0, 500).toString('utf8')),
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
    if (!MIME_SIGNATURE[mime](bytes)) return bad()
    if (mime === 'image/svg+xml') {
      const clean = sanitizeSvg(bytes)
      // Sanitizing can only shrink or leave the byte count unchanged for
      // the raw kinds of content it strips — EXCEPT that XML serialization
      // re-encodes bare `&`/`<`/`>` as multi-byte entities, so a small,
      // entity-heavy input can expand several-fold. Re-check the limit
      // against what will actually be stored, not just what was uploaded.
      if (!clean || clean.length > MAX_BYTES) return bad()
      bytes = clean
    }
    const key = `${folder as string}/${slugify(fileName)}-${randomBytes(4).toString('hex')}.${ext}`
    const { url, error } = await deps.put(folder as string, key, bytes, mime, env)
    if (error) return { status: 500, body: { error: 'upload_failed' } }
    return { status: 200, body: { url, path: key } }
  }
  return { status: 405, body: { error: 'method_not_allowed' } }
}
