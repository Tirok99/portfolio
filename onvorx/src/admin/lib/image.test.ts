import { describe, it, expect } from 'vitest'
import { fileToImageRef, dataUrlBytes } from './image'

const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type })
}

describe('dataUrlBytes', () => {
  it('estimates decoded size', () => {
    expect(dataUrlBytes('data:text/plain;base64,QUJD')).toBe(3) // "ABC"
  })
})

describe('fileToImageRef', () => {
  it('rejects a non-image file', async () => {
    const file = new File(['hi'], 'notes.txt', { type: 'text/plain' })
    await expect(fileToImageRef(file)).rejects.toThrow('unsupported-type')
  })

  it('returns an upload ImageRef for an image file', async () => {
    const file = dataUrlToFile(tinyPngDataUrl, 'pixel.png', 'image/png')
    const ref = await fileToImageRef(file)
    expect(ref.kind).toBe('upload')
    expect(ref.fileName).toBe('pixel.png')
    expect(ref.src.startsWith('data:image/')).toBe(true)
  })
})
