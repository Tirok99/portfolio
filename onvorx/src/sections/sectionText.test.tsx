import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
} from '../content/SiteContentProvider'
import { EstimateFormProvider } from '../components/EstimateForm/useEstimateForm'
import { Hero } from './Hero/Hero'
import { Cta } from './Cta/Cta'
import { About } from './About/About'

beforeEach(() => localStorage.clear())

function Editor() {
  const { actions } = useSiteContentRaw()
  return (
    <button
      onClick={() =>
        actions.updateSection('hero', {
          title: { en: 'STORE HERO TITLE', uk: 'STORE HERO TITLE' },
        })
      }
    >
      set hero
    </button>
  )
}

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <EstimateFormProvider>
          <MemoryRouter>{ui}</MemoryRouter>
          <Editor />
        </EstimateFormProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('section header text comes from the store', () => {
  it('Hero title reflects a store edit', () => {
    wrap(<Hero />)
    act(() => screen.getByText('set hero').click())
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'STORE HERO TITLE',
    )
  })

  it('Cta renders its seeded title and button label from the store', () => {
    wrap(<Cta />)
    // seeded from en.json cta.title / cta.button
    expect(
      screen.getByRole('heading', { name: /turn your requirements/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /request a project estimate/i }),
    ).toBeInTheDocument()
  })

  it('About renders its seeded header from the store', () => {
    wrap(<About />)
    expect(
      screen.getByRole('heading', {
        name: /Practical experience behind every project/i,
      }),
    ).toBeInTheDocument()
  })
})
