import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
} from '../content/SiteContentProvider'
import { Services } from './Services/Services'
import { Projects } from './Projects/Projects'

vi.mock('../admin/api', () => ({
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

function HideFirstService() {
  const { data, actions } = useSiteContentRaw()
  return (
    <button
      onClick={() =>
        actions.updateCard('servicesHome', data.servicesHome[0].id, {
          published: false,
        })
      }
    >
      hide
    </button>
  )
}

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <MemoryRouter>{ui}</MemoryRouter>
        <HideFirstService />
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('Services cards from store', () => {
  it('renders seeded service titles', () => {
    wrap(<Services />)
    expect(screen.getByText('Web Development')).toBeInTheDocument()
    expect(screen.getByText('Business Analysis')).toBeInTheDocument()
  })

  it('hides a card when it is unpublished', () => {
    wrap(<Services />)
    expect(screen.getByText('Web Development')).toBeInTheDocument()
    act(() => screen.getByText('hide').click())
    expect(screen.queryByText('Web Development')).not.toBeInTheDocument()
  })
})

describe('Projects cards from store', () => {
  it('renders seeded project titles and a 01/02 index', () => {
    wrap(<Projects />)
    expect(screen.getByText('Relax Ahill')).toBeInTheDocument()
    expect(screen.getByText('Encryptia Cloud')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
  })
})
