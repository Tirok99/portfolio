import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { ContentPage } from './ContentPage'

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
  })
})
