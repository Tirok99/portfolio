import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageUpload } from './ImageUpload'
import type { ImageRef } from '../types'

const EMPTY: ImageRef = { kind: 'asset', src: '' }

// jsdom never fires `img.onload`, so `fileToImageRef`'s downscale step would hang
// on a real image File. Stub HTMLImageElement's `src` setter to fire onload for
// data: URLs — file-scoped to this test file, mirroring src/admin/lib/image.test.ts.
let originalSrcDescriptor: PropertyDescriptor | undefined

beforeAll(() => {
  originalSrcDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    'src',
  )
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    set(src: string) {
      this._src = src
      this.width = 800
      this.height = 600
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
    Object.defineProperty(
      HTMLImageElement.prototype,
      'src',
      originalSrcDescriptor,
    )
  } else {
    delete (HTMLImageElement.prototype as { src?: unknown }).src
  }
})

describe('ImageUpload', () => {
  it('shows the empty placeholder and no Remove button when src is empty', () => {
    render(<ImageUpload label="Image" value={EMPTY} onChange={vi.fn()} onClear={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('rejects a non-image file with an inline message', async () => {
    // applyAccept:false so user-event lets the text file past the accept="image/*"
    // filter and into the component, where fileToImageRef does the real rejecting.
    const user = userEvent.setup({ applyAccept: false })
    render(<ImageUpload label="Image" value={EMPTY} onChange={vi.fn()} onClear={vi.fn()} />)
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText(/choose file/i), file)
    expect(await screen.findByText(/isn't an image/i)).toBeInTheDocument()
  })

  it('accepts an image file and calls onChange with an upload ImageRef', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ImageUpload label="Image" value={EMPTY} onChange={onChange} onClear={vi.fn()} />)
    const png = new File([Uint8Array.from([137, 80, 78, 71])], 'p.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/choose file/i), png)
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0].kind).toBe('upload')
  })

  it('shows Remove when there is an image and calls onClear', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <ImageUpload label="Image" value={{ kind: 'asset', src: '/assets/x.png' }} onChange={vi.fn()} onClear={onClear} />,
    )
    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(onClear).toHaveBeenCalled()
  })
})
