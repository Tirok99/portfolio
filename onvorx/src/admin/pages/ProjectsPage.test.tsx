import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider, ToastRegion } from '../components/Toast'
import { ProjectsPage } from './ProjectsPage'
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
          <ToastRegion />
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
    expect(await screen.findByText(/^saved$/i)).toBeInTheDocument()
  })

  it('shows a "Save failed" toast when the api rejects', async () => {
    vi.mocked(adminApi.updateCard).mockRejectedValueOnce(new Error('x'))
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Relax Ahill'))
    const title = screen.getAllByLabelText('Title')[0]
    await user.clear(title)
    await user.type(title, 'Rejected edit')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText(/save failed/i)).toBeInTheDocument()
  })

  it('clears the SaveBar after a successful save (not stuck dirty)', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Relax Ahill'))
    // non-canonical tag input: no space after the comma
    const tags = screen.getByLabelText('Tags')
    await user.clear(tags)
    await user.type(tags, 'Alpha,Beta')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
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
