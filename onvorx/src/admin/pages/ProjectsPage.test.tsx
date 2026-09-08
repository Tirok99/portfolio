import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { ProjectsPage } from './ProjectsPage'

beforeEach(() => localStorage.clear())

function Probe() {
  const { data } = useSiteContentRaw()
  return <span data-testid="home-count">{data.projectsHome.length}</span>
}

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <ProjectsPage />
          <Probe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('ProjectsPage', () => {
  it('lists the seeded home projects and switches tabs', async () => {
    const user = userEvent.setup()
    wrap()
    expect(screen.getByText('Relax Ahill')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /projects page/i }))
    // the Projects-page list is seeded with the same 2 items
    expect(screen.getByText('Encryptia Cloud')).toBeInTheDocument()
  })

  it('clears the selection when switching tabs', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Relax Ahill'))
    expect(screen.getAllByLabelText('Title')[0]).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /projects page/i }))
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(screen.getByText(/no card selected/i)).toBeInTheDocument()
  })

  it('adds a new card (unpublished) via the list', async () => {
    const user = userEvent.setup()
    wrap()
    const before = Number(screen.getByTestId('home-count').textContent)
    await user.click(screen.getByRole('button', { name: /add project/i }))
    expect(Number(screen.getByTestId('home-count').textContent)).toBe(before + 1)
  })

  it('edits a card title and saves it to the store', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Relax Ahill'))
    const title = screen.getAllByLabelText('Title')[0]
    await user.clear(title)
    await user.type(title, 'Relax Ahill v2')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText('Relax Ahill v2')).toBeInTheDocument()
  })

  it('deletes a card after confirmation', async () => {
    const user = userEvent.setup()
    wrap()
    const before = Number(screen.getByTestId('home-count').textContent)
    await user.click(screen.getByText('Relax Ahill'))
    await user.click(screen.getByRole('button', { name: /delete card/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /delete/i }))
    expect(Number(screen.getByTestId('home-count').textContent)).toBe(before - 1)
  })
})
