import '@testing-library/jest-dom/vitest'

// Mock image loading in jsdom to fire onload for data URLs
Object.defineProperty(HTMLImageElement.prototype, 'src', {
  set(src: string) {
    this._src = src
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
