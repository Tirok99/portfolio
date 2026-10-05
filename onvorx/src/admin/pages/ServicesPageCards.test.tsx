import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { ToastProvider, ToastRegion } from '../components/Toast'
import { ServicesPageCards } from './ServicesPageCards'
import { adminApi } from '../../admin/api'
import type { SectionCard } from '../types'

vi.mock('../../admin/api', () => ({
  adminApi: {
    saveSection: vi.fn().mockResolvedValue(undefined),
    saveSeo: vi.fn().mockResolvedValue(undefined),
    resetContent: vi.fn().mockResolvedValue(undefined),
    createCard: vi.fn().mockResolvedValue(undefined),
    updateCard: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    reorderCards: vi.fn().mockResolvedValue(undefined),
    uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn/x.png', path: 'cards/x.png' }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
  },
}))

// skip the real FileReader/canvas pipeline — these tests are about the draft, not decoding
vi.mock('../lib/image', () => ({
  fileToImageRef: vi.fn(async (file: File) => ({ kind: 'upload', src: `data:${file.name}` })),
}))

/** uploadImage calls that stay pending until the test resolves them, in any order */
function deferUploads() {
  const pending: Record<string, (v: { url: string; path: string }) => void> = {}
  vi.mocked(adminApi.uploadImage).mockImplementation(
    (_folder, _data, fileName) => new Promise((resolve) => { pending[fileName] = resolve }),
  )
  return (fileName: string) => pending[fileName]({ url: `https://cdn/${fileName}`, path: `cards/${fileName}` })
}
const png = (name: string) => new File(['x'], name, { type: 'image/png' })
const fileInput = (label: string, nth = 0) =>
  screen.getAllByText(label)[nth].closest('.admin-imageupload')!.querySelector('input[type=file]') as HTMLInputElement

beforeEach(() => {
  localStorage.clear()
  vi.mocked(adminApi.saveSection).mockClear()
})

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <ServicesPageCards />
          <ToastRegion />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )
const lastPatch = () => vi.mocked(adminApi.saveSection).mock.calls.at(-1)!

describe('ServicesPageCards', () => {
  it('lists the 6 groups with nothing selected', () => {
    wrap()
    for (const g of ['Hero cards', 'Web Development', 'AI Build', 'Website Support', 'Business Analysis', 'Google Ads'])
      expect(screen.getByText(g)).toBeInTheDocument()
    expect(screen.getByText(/no group selected/i)).toBeInTheDocument()
  })

  it('Google Ads: badge and 4 feature items, no illustration', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Google Ads'))
    expect(screen.getByText('Badge')).toBeInTheDocument()
    expect(screen.queryByText('Illustration')).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Item \d$/)).toHaveLength(4)
  })

  it('Hero cards: exactly 4 cards, no add button', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Hero cards'))
    expect(screen.getAllByText(/^Card \d$/)).toHaveLength(4)
    expect(screen.queryByRole('button', { name: /^add item/i })).not.toBeInTheDocument()
  })

  it('adding a feature item saves cards only, with the block icon as placeholder', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Web Development'))
    await user.click(screen.getByRole('button', { name: 'Add item to Features' }))
    const titles = screen.getAllByLabelText('Title')
    await user.type(titles[titles.length - 1], 'SEO basics')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    const [key, patch] = lastPatch()
    expect(key).toBe('svcWebDevelopment')
    expect(Object.keys(patch)).toEqual(['cards'])
    const cards = patch.cards as SectionCard[]
    expect(cards).toHaveLength(7)
    expect(cards[6].title.en).toBe('SEO basics')
    expect(cards[6].icon.src).toBe('/assets/services-page/icons/code.svg')
  })

  it('removing a badge saves media only', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Google Ads'))
    const badge = screen.getByText('Badge').closest('.admin-imageupload')! as HTMLElement
    await user.click(within(badge).getByRole('button', { name: /remove/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    const [key, patch] = lastPatch()
    expect(key).toBe('svcGoogleAds')
    expect(Object.keys(patch)).toEqual(['media'])
    expect(patch.media).toEqual({ badge: { kind: 'asset', src: '' } })
    expect(adminApi.deleteImage).not.toHaveBeenCalled() // draft-only until Save
  })

  it('Business Analysis keeps Track 01 items before Track 02 after edits', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Business Analysis'))
    await user.click(screen.getByRole('button', { name: 'Remove: Track 01 features item 1' }))
    await user.click(screen.getByRole('button', { name: 'Add item to Track 02 features' }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    const cards = lastPatch()[1].cards as SectionCard[]
    expect(cards.map((c) => c.track)).toEqual([0, 0, 1, 1, 1, 1])
  })

  it('switching groups drops the unsaved draft', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Web Development'))
    await user.click(screen.getByRole('button', { name: 'Remove: Features item 1' }))
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    await user.click(screen.getByText('Google Ads'))
    await user.click(screen.getByText('Web Development'))
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })

  it('two uploads finishing out of order both land in the draft', async () => {
    const user = userEvent.setup()
    const finish = deferUploads()
    wrap()
    await user.click(screen.getByText('Web Development'))
    await user.upload(fileInput('Badge'), png('badge.png'))
    await user.upload(fileInput('Illustration'), png('picture.png'))
    finish('badge.png')
    await waitFor(() => expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument())
    finish('picture.png')
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/picture.png"]')).not.toBeNull())
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    const media = lastPatch()[1].media as { badge: { src: string }; picture: { src: string } }
    expect(media.badge.src).toBe('https://cdn/badge.png')
    expect(media.picture.src).toBe('https://cdn/picture.png')
  })

  it('typing in another item while an icon uploads is kept', async () => {
    const user = userEvent.setup()
    const finish = deferUploads()
    wrap()
    await user.click(screen.getByText('Google Ads'))
    await user.upload(fileInput('Icon', 0), png('icon.png'))
    const title2 = screen.getAllByLabelText('Title')[1]
    await user.clear(title2)
    await user.type(title2, 'Edited while uploading')
    finish('icon.png')
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/icon.png"]')).not.toBeNull())
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    const cards = lastPatch()[1].cards as SectionCard[]
    expect(cards[0].icon.src).toBe('https://cdn/icon.png')
    expect(cards[1].title.en).toBe('Edited while uploading')
  })
})
