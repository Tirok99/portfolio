import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider, ToastRegion } from '../components/Toast'
import { ContentPage } from './ContentPage'
import { adminApi } from '../../admin/api'

vi.mock('../../admin/api', () => ({
  adminApi: {
    saveSection: vi.fn().mockResolvedValue(undefined),
    saveSeo: vi.fn().mockResolvedValue(undefined),
    resetContent: vi.fn().mockResolvedValue(undefined),
    createCard: vi.fn().mockResolvedValue(undefined),
    updateCard: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    reorderCards: vi.fn().mockResolvedValue(undefined),
  },
}))

beforeEach(() => localStorage.clear())

function StoreProbe() {
  const { data } = useSiteContentRaw()
  const hero = data.sections.find((s) => s.key === 'hero')!
  return <span data-testid="hero-title-en">{hero.title.en}</span>
}

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <ContentPage />
          <StoreProbe />
          <ToastRegion />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('ContentPage', () => {
  it('renders all six section blocks', () => {
    wrap()
    for (const label of [
      'Hero',
      'Services block',
      'Projects block',
      'How we work block',
      'About block',
      'Call-to-action block',
    ]) {
      expect(
        screen.getByRole('heading', { name: new RegExp(label, 'i') }),
      ).toBeInTheDocument()
    }
  })

  it('only Hero and CTA expose a Button label field', () => {
    wrap()
    expect(screen.getAllByText(/button label/i).length).toBe(2)
  })

  it('editing a title and saving updates the store', async () => {
    const user = userEvent.setup()
    wrap()
    const heroTitle = screen.getAllByLabelText('Title')[0]
    await user.clear(heroTitle)
    await user.type(heroTitle, 'Brand new hero title')
    const saveButtons = screen.getAllByRole('button', { name: /^save$/i })
    await user.click(saveButtons[0])
    expect(screen.getByTestId('hero-title-en')).toHaveTextContent('Brand new hero title')
    expect(await screen.findByText(/^saved$/i)).toBeInTheDocument()
  })

  it('shows a "Save failed" toast when the api rejects', async () => {
    vi.mocked(adminApi.saveSection).mockRejectedValueOnce(new Error('x'))
    const user = userEvent.setup()
    wrap()
    const heroTitle = screen.getAllByLabelText('Title')[0]
    await user.clear(heroTitle)
    await user.type(heroTitle, 'Will not stick')
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[0])
    expect(await screen.findByText(/save failed/i)).toBeInTheDocument()
  })

  it('has Home and Services tabs; Home is the default', async () => {
    const user = userEvent.setup()
    wrap()
    expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    for (const label of ['Hero', 'Web Development', 'AI Build', 'Website Support & Development',
      'Business Analysis', 'Google Ads', 'Call-to-action']) {
      expect(screen.getByRole('heading', { level: 2, name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('heading', { name: /footer tagline/i })).not.toBeInTheDocument()
  })

  it('shows only the fields each /services section uses', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    const box = (name: string) => screen.getByRole('heading', { level: 2, name }).closest('details')!
    expect(within(box('AI Build')).getByLabelText('Badge')).toBeInTheDocument()
    expect(within(box('AI Build')).getByLabelText('Link text')).toBeInTheDocument()
    expect(within(box('AI Build')).getByLabelText('Stack 1 EN')).toBeInTheDocument()
    expect(within(box('Web Development')).queryByLabelText('Eyebrow')).not.toBeInTheDocument()
    expect(within(box('Web Development')).getByLabelText('Button label')).toBeInTheDocument()
    expect(within(box('Business Analysis')).getByLabelText('Track 02 — title')).toBeInTheDocument()
    expect(within(box('Google Ads')).queryByLabelText('What you get — title')).not.toBeInTheDocument()
    expect(within(box('Hero')).queryByLabelText('Button label')).not.toBeInTheDocument()
  })

  it('saving tags sends only texts — never cards or media', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    const wd = screen.getByRole('heading', { level: 2, name: 'Web Development' }).closest('details')!
    await user.click(within(wd).getByRole('button', { name: 'Add tag' }))
    await user.type(within(wd).getByLabelText('Tags 4 EN'), 'Astro')
    await user.click(within(wd).getByRole('button', { name: /^save$/i }))
    const [key, patch] = vi.mocked(adminApi.saveSection).mock.calls.at(-1)!
    expect(key).toBe('svcWebDevelopment')
    expect(Object.keys(patch)).toEqual(['texts'])
    expect((patch.texts as { tags: { en: string }[] }).tags.map((t) => t.en))
      .toEqual(['WordPress', 'Webflow', 'Framer', 'Astro'])
  })

  it('Discard restores the stored texts', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    const ai = screen.getByRole('heading', { level: 2, name: 'AI Build' }).closest('details')!
    await user.click(within(ai).getByRole('button', { name: 'Remove: Stack 1' }))
    await user.click(within(ai).getByRole('button', { name: /discard/i }))
    expect(within(ai).getByLabelText('Stack 1 EN')).toHaveValue('Design')
  })

  it('footer only shows a Tagline field, no Eyebrow/Title/Button label', () => {
    wrap()
    const footerHeading = screen.getByRole('heading', { name: /footer tagline/i })
    const footerSection = footerHeading.closest('details')!
    expect(within(footerSection).getByLabelText(/^tagline$/i)).toBeInTheDocument()
    expect(within(footerSection).queryByLabelText(/^eyebrow$/i)).not.toBeInTheDocument()
    expect(within(footerSection).queryByLabelText(/^title$/i)).not.toBeInTheDocument()
  })
})
