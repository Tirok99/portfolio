import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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

describe('image helpers', () => {
  // Mock image loading in jsdom for this test file only
  let originalSrcDescriptor: PropertyDescriptor | undefined

  beforeAll(() => {
    originalSrcDescriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'src',
    )
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set(src: string) {
        this._src = src
        this.naturalWidth = 800
        this.naturalHeight = 600
        this.width = 800
        this.height = 600
        // Trigger onload for data URLs (jsdom doesn't do this by default)
        if (src?.startsWith('data:')) {
          setTimeout(() => {
            if (this.onload) this.onload(new Event('load'))
          }, 0)
        }
      },
      get() {
        return this._src
      },
    })
  })

  afterAll(() => {
    if (originalSrcDescriptor) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', originalSrcDescriptor)
    } else {
      delete (HTMLImageElement.prototype as any).src
    }
  })

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

    it('rejects when resulting data URL exceeds MAX_IMAGE_BYTES', async () => {
      // Create a data URL larger than MAX_IMAGE_BYTES
      // Decoded size = floor((base64.length * 3) / 4)
      // To exceed 1.5MB, need base64 > 2MB
      const largeBase64 = 'A'.repeat(2_000_100)
      const oversizedDataUrl = `data:image/jpeg;base64,${largeBase64}`
      const file = new File(['dummy'], 'large.jpg', { type: 'image/jpeg' })

      // Mock FileReader to return our oversized data URL
      const originalFileReader = window.FileReader as any
      window.FileReader = class MockFileReader {
        readAsDataURL(_file: Blob) {
          setTimeout(() => {
            ;(this as any).result = oversizedDataUrl
            ;(this as any).onload?.()
          }, 0)
        }
      } as any

      try {
        await expect(fileToImageRef(file)).rejects.toThrow('too-large')
      } finally {
        window.FileReader = originalFileReader
      }
    })

    it('falls back to raw data URL when downscale fails', async () => {
      const file = dataUrlToFile(tinyPngDataUrl, 'pixel.png', 'image/png')
      // Mock img element to trigger onerror (simulating decode failure)
      const originalSrcDescriptor = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'src',
      )
      let imgCreated = false
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        set(src: string) {
          imgCreated = true
          this._src = src
          // Trigger onerror for any image (simulating failed decode)
          setTimeout(() => {
            if (this.onerror) this.onerror(new Event('error'))
          }, 0)
        },
        get() {
          return this._src
        },
        configurable: true,
      })

      try {
        const ref = await fileToImageRef(file)
        expect(ref.kind).toBe('upload')
        expect(ref.src).toBe(tinyPngDataUrl) // should be the raw data URL (fallback)
        expect(imgCreated).toBe(true)
      } finally {
        if (originalSrcDescriptor) {
          Object.defineProperty(HTMLImageElement.prototype, 'src', originalSrcDescriptor)
        }
      }
    })
  })
})
