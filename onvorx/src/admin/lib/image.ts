import type { ImageRef } from '../types'

export const MAX_IMAGE_BYTES = 1_500_000

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('read-failed'))
    fr.readAsDataURL(file)
  })

/** approximate decoded byte size of a base64 data URL */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

async function downscale(
  dataUrl: string,
  maxDimension: number,
): Promise<string> {
  if (typeof document === 'undefined') return dataUrl
  const img = document.createElement('img')
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('decode-failed'))
    img.src = dataUrl
  })
  const { width, height } = img
  const scale = Math.min(1, maxDimension / Math.max(width, height || 1))
  if (scale >= 1) return dataUrl
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export async function fileToImageRef(
  file: File,
  opts: { maxDimension?: number } = {},
): Promise<ImageRef> {
  if (!file.type.startsWith('image/')) throw new Error('unsupported-type')
  const raw = await readAsDataUrl(file)
  let out = raw
  try {
    out = await downscale(raw, opts.maxDimension ?? 1600)
  } catch {
    out = raw
  }
  if (dataUrlBytes(out) > MAX_IMAGE_BYTES) throw new Error('too-large')
  return { kind: 'upload', src: out, fileName: file.name }
}
