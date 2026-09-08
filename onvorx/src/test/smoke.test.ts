import { describe, it, expect } from 'vitest'

describe('test tooling', () => {
  it('runs vitest with jsdom', () => {
    const el = document.createElement('div')
    el.textContent = 'ok'
    expect(el).toHaveTextContent('ok')
  })
})
