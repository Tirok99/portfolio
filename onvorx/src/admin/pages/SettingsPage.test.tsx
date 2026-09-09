import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
} from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { SettingsPage } from './SettingsPage'
import * as authModule from '../auth/useAuth'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.spyOn(authModule, 'useAuth').mockReturnValue({
    status: 'authed',
    login: vi.fn(),
    logout: vi.fn(async () => {}),
    recheck: vi.fn(),
  } as never)
})

function Probe() {
  const { data, actions } = useSiteContentRaw()
  const hero = data.sections.find((s) => s.key === 'hero')!
  return (
    <>
      <span data-testid="hero">{hero.title.en}</span>
      <button
        type="button"
        data-testid="probe-edit"
        onClick={() =>
          actions.updateSection('hero', { title: { en: 'EDITED', uk: 'EDITED' } })
        }
      >
        edit
      </button>
    </>
  )
}

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <MemoryRouter>
            <SettingsPage />
          </MemoryRouter>
          <Probe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('SettingsPage', () => {
  it('resets content to defaults after confirmation', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByTestId('probe-edit'))
    expect(screen.getByTestId('hero')).toHaveTextContent('EDITED')
    await user.click(screen.getByRole('button', { name: /reset all content/i }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /reset everything/i,
      }),
    )
    expect(screen.getByTestId('hero')).not.toHaveTextContent('EDITED')
  })

  it('does not reset when the confirm dialog is cancelled', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByTestId('probe-edit'))
    await user.click(screen.getByRole('button', { name: /reset all content/i }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }),
    )
    expect(screen.getByTestId('hero')).toHaveTextContent('EDITED')
  })

  it('logs out via the auth hook', async () => {
    const logout = vi.fn(async () => {})
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      status: 'authed',
      login: vi.fn(),
      logout,
      recheck: vi.fn(),
    } as never)
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('button', { name: /log out/i }))
    expect(logout).toHaveBeenCalled()
  })
})
