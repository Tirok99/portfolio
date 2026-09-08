import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { I18nProvider, useI18n } from '../i18n/i18n'
import { SiteContentProvider } from './SiteContentProvider'
import { useSiteContent } from './useSiteContent'
import { STORAGE_KEY } from './persistence'

beforeEach(() => localStorage.clear())

function Probe() {
  const { section, servicesHome, actions } = useSiteContent()
  const { setLang } = useI18n()
  return (
    <div>
      <p data-testid="hero-title">{section('hero').title}</p>
      <p data-testid="svc-count">{servicesHome().length}</p>
      <button onClick={() => actions.updateSection('hero', { title: { en: 'Edited EN', uk: 'Edited UK' } })}>
        edit
      </button>
      <button onClick={() => setLang('uk')}>uk</button>
      <button onClick={() => actions.updateCard('servicesHome', servicesHome()[0].id, { published: false })}>
        hide first service
      </button>
    </div>
  )
}

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <Probe />
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('SiteContentProvider', () => {
  it('exposes seeded content resolved to the active language', () => {
    wrap()
    expect(screen.getByTestId('hero-title').textContent).toBeTruthy()
  })

  it('applies an edit and persists it to localStorage', () => {
    wrap()
    act(() => {
      screen.getByText('edit').click()
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Edited EN')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.sections.find((s: { key: string }) => s.key === 'hero').title.en).toBe('Edited EN')
  })

  it('falls back to EN when the active language value is empty', () => {
    wrap()
    act(() => {
      screen.getByText('edit').click() // sets uk: 'Edited UK'
      screen.getByText('uk').click()
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Edited UK')
  })

  it('filters unpublished cards out of the resolved list', () => {
    wrap()
    const before = Number(screen.getByTestId('svc-count').textContent)
    act(() => {
      screen.getByText('hide first service').click()
    })
    expect(Number(screen.getByTestId('svc-count').textContent)).toBe(before - 1)
  })
})
