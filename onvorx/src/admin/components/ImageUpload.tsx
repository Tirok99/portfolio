import { useId, useState } from 'react'
import type { ImageRef } from '../types'
import { fileToImageRef } from '../lib/image'
import { adminApi } from '../api'

const MESSAGES: Record<string, string> = {
  'unsupported-type': "That file isn't an image. Choose a JPG, PNG, or WebP.",
  'too-large': 'That image is too large (max ~1.5 MB) — try a smaller one.',
  'upload-failed': 'Upload failed — check your connection and try again.',
  'save-failed': 'Could not save the image. Please try again.',
  'clear-failed': 'Could not clear the image. Please try again.',
}

export function ImageUpload({
  label,
  folder,
  value,
  onChange,
  onClear,
}: {
  label: string
  folder: 'projects' | 'services'
  value: ImageRef
  onChange: (ref: ImageRef) => Promise<void>
  onClear: () => Promise<void>
}) {
  const id = useId()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const old = value.kind === 'upload' && value.path ? value.path : undefined
      const ref = await fileToImageRef(file)
      let uploaded: { url: string; path: string }
      try {
        uploaded = await adminApi.uploadImage(folder, ref.src, file.name)
      } catch {
        setError(MESSAGES['upload-failed'])
        return
      }
      try {
        await onChange({ kind: 'upload', src: uploaded.url, path: uploaded.path })
      } catch {
        setError(MESSAGES['save-failed'])
        return
      }
      if (old && old !== uploaded.path) void adminApi.deleteImage(old).catch(() => {})
    } catch (e) {
      const key = e instanceof Error ? e.message : ''
      setError(MESSAGES[key] ?? 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    setError('')
    setBusy(true)
    try {
      const old = value.kind === 'upload' && value.path ? value.path : undefined
      try {
        await onClear()
      } catch {
        setError(MESSAGES['clear-failed'])
        return
      }
      if (old) void adminApi.deleteImage(old).catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-field admin-imageupload">
      <span className="admin-field__label">{label}</span>
      {value.src ? (
        <img className="admin-imageupload__preview" src={value.src} alt="" />
      ) : (
        <span className="admin-imageupload__preview admin-imageupload__preview--empty">
          No image
        </span>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <label className="admin-btn" htmlFor={id}>
          {busy ? 'Reading…' : 'Choose file'}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          className="admin-imageupload__input"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {value.src && (
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            disabled={busy}
            onClick={() => void handleClear()}
          >
            Remove
          </button>
        )}
      </div>
      {error && <span className="admin-imageupload__error">{error}</span>}
    </div>
  )
}
