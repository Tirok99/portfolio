import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageUpload } from './ImageUpload'
import { adminApi } from '../api'
import type { ImageRef } from '../types'

vi.mock('../api', () => ({
  adminApi: {
    uploadImage: vi.fn().mockResolvedValue({ url: 'U', path: 'P' }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
  },
}))

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

beforeEach(() => {
  vi.mocked(adminApi.uploadImage).mockResolvedValue({ url: 'U', path: 'P' })
  vi.mocked(adminApi.deleteImage).mockResolvedValue(undefined)
})

describe('ImageUpload', () => {
  it('shows the empty placeholder and no Remove button when src is empty', () => {
    render(<ImageUpload label="Image" folder="projects" value={EMPTY} onChange={vi.fn()} onClear={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('rejects a non-image file with an inline message', async () => {
    // applyAccept:false so user-event lets the text file past the accept="image/*"
    // filter and into the component, where fileToImageRef does the real rejecting.
    const user = userEvent.setup({ applyAccept: false })
    render(<ImageUpload label="Image" folder="projects" value={EMPTY} onChange={vi.fn()} onClear={vi.fn()} />)
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText(/choose file/i), file)
    expect(await screen.findByText(/isn't an image/i)).toBeInTheDocument()
  })

  it('uploads the picked file and calls onChange with the returned url + path', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ImageUpload label="Image" folder="projects" value={EMPTY} onChange={onChange} onClear={vi.fn().mockResolvedValue(undefined)} />)
    const png = new File([Uint8Array.from([137, 80, 78, 71])], 'x.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/choose file/i), png)
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(adminApi.uploadImage).toHaveBeenCalledWith(
      'projects',
      expect.stringContaining('data:'),
      'x.png',
    )
    expect(onChange).toHaveBeenCalledWith({ kind: 'upload', src: 'U', path: 'P' })
    // fresh value had no stored path → nothing to clean up
    expect(adminApi.deleteImage).not.toHaveBeenCalled()
  })

  it('on replace: awaits onChange, then deletes the superseded object', async () => {
    vi.mocked(adminApi.uploadImage).mockResolvedValueOnce({ url: 'U2', path: 'projects/new-x.png' })
    const user = userEvent.setup()
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(
      <ImageUpload
        label="Image"
        folder="projects"
        value={{ kind: 'upload', src: 'U', path: 'projects/old-x.png' }}
        onChange={onChange}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const png = new File([Uint8Array.from([137, 80, 78, 71])], 'x.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/choose file/i), png)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ kind: 'upload', src: 'U2', path: 'projects/new-x.png' }))
    await waitFor(() => expect(adminApi.deleteImage).toHaveBeenCalledWith('projects/old-x.png'))
  })

  it('shows the error slot and does not call onChange when the upload fails', async () => {
    vi.mocked(adminApi.uploadImage).mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ImageUpload label="Image" folder="services" value={EMPTY} onChange={onChange} onClear={vi.fn().mockResolvedValue(undefined)} />)
    const png = new File([Uint8Array.from([137, 80, 78, 71])], 'x.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/choose file/i), png)
    expect(await screen.findByText(/upload failed/i)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('when the row write (onChange) rejects: shows the error and keeps the old object', async () => {
    vi.mocked(adminApi.uploadImage).mockResolvedValueOnce({ url: 'U2', path: 'projects/new-x.png' })
    const user = userEvent.setup()
    const onChange = vi.fn().mockRejectedValue(new Error('save boom'))
    render(
      <ImageUpload
        label="Image"
        folder="projects"
        value={{ kind: 'upload', src: 'U', path: 'projects/old-x.png' }}
        onChange={onChange}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const png = new File([Uint8Array.from([137, 80, 78, 71])], 'x.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/choose file/i), png)
    expect(await screen.findByText(/could not save the image/i)).toBeInTheDocument()
    // the row write didn't take → the old object must NOT be deleted
    expect(adminApi.deleteImage).not.toHaveBeenCalledWith('projects/old-x.png')
  })

  it('on Remove with a stored path: awaits onClear, THEN deletes the old object', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn().mockResolvedValue(undefined)
    render(
      <ImageUpload
        label="Image"
        folder="projects"
        value={{ kind: 'upload', src: 'U', path: 'P' }}
        onChange={vi.fn().mockResolvedValue(undefined)}
        onClear={onClear}
      />,
    )
    await user.click(screen.getByRole('button', { name: /remove/i }))
    await waitFor(() => expect(onClear).toHaveBeenCalled())
    await waitFor(() => expect(adminApi.deleteImage).toHaveBeenCalledWith('P'))
  })

  it('when onClear rejects: shows the error and does not delete the object', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn().mockRejectedValue(new Error('clear boom'))
    render(
      <ImageUpload
        label="Image"
        folder="projects"
        value={{ kind: 'upload', src: 'U', path: 'P' }}
        onChange={vi.fn().mockResolvedValue(undefined)}
        onClear={onClear}
      />,
    )
    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(await screen.findByText(/could not clear the image/i)).toBeInTheDocument()
    expect(adminApi.deleteImage).not.toHaveBeenCalled()
  })

  it('on Remove without a stored path: calls onClear only', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn().mockResolvedValue(undefined)
    render(
      <ImageUpload
        label="Image"
        folder="projects"
        value={{ kind: 'asset', src: '/assets/x.png' }}
        onChange={vi.fn().mockResolvedValue(undefined)}
        onClear={onClear}
      />,
    )
    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(onClear).toHaveBeenCalled()
    expect(adminApi.deleteImage).not.toHaveBeenCalled()
  })
})
