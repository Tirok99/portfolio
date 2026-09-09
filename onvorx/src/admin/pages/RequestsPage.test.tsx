import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { ToastProvider } from '../components/Toast'
import { mockRequests } from '../mock/requests'
import { RequestsPage } from './RequestsPage'

vi.mock('../api', () => ({
  adminApi: {
    listRequests: vi.fn(),
    setRequestStatus: vi.fn().mockResolvedValue(undefined),
    setRequestNote: vi.fn().mockResolvedValue(undefined),
    deleteRequest: vi.fn().mockResolvedValue(undefined),
  },
}))
import { adminApi } from '../api'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(adminApi.listRequests).mockResolvedValue(
    mockRequests.map((r) => ({ ...r })),
  )
  vi.mocked(adminApi.setRequestStatus).mockResolvedValue(undefined)
  vi.mocked(adminApi.setRequestNote).mockResolvedValue(undefined)
  vi.mocked(adminApi.deleteRequest).mockResolvedValue(undefined)
})

const wrap = () =>
  render(
    <I18nProvider>
      <ToastProvider>
        <RequestsPage />
      </ToastProvider>
    </I18nProvider>,
  )

describe('RequestsPage', () => {
  it('lists requests from the server and filters by status', async () => {
    const user = userEvent.setup()
    wrap()
    expect(await screen.findByText('Olena Kravets')).toBeInTheDocument()
    expect(screen.getByText('Tomasz Nowak')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/status/i), 'archived')
    expect(screen.queryByText('Olena Kravets')).not.toBeInTheDocument()
    expect(screen.getByText('Anna Schmidt')).toBeInTheDocument()
  })

  it('filters by free text (name/email/message)', async () => {
    const user = userEvent.setup()
    wrap()
    await screen.findByText('Olena Kravets')
    await user.type(screen.getByLabelText(/search/i), 'encryptia')
    expect(screen.getByText('Markus Feld')).toBeInTheDocument()
    expect(screen.queryByText('Olena Kravets')).not.toBeInTheDocument()
  })

  it('opens a row, changes status, and calls the api', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(await screen.findByRole('button', { name: /Olena Kravets/i }))
    const detail = screen.getByRole('region', { name: /request detail/i })
    await user.selectOptions(within(detail).getByLabelText(/status/i), 'done')
    expect(adminApi.setRequestStatus).toHaveBeenCalledWith('req_0001', 'done')
    expect(
      within(screen.getByRole('table')).getAllByText(/done/i).length,
    ).toBeGreaterThan(0)
  })

  it('opens a row via the keyboard-focusable row button', async () => {
    const user = userEvent.setup()
    wrap()
    ;(await screen.findByRole('button', { name: /Olena Kravets/i })).focus()
    await user.keyboard('{Enter}')
    expect(
      screen.getByRole('region', { name: /request detail/i }),
    ).toBeInTheDocument()
  })

  it('deletes a request after confirmation', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(await screen.findByRole('button', { name: /Olena Kravets/i }))
    const detail = screen.getByRole('region', { name: /request detail/i })
    await user.click(within(detail).getByRole('button', { name: /^delete$/i }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /delete request/i }),
    )
    expect(adminApi.deleteRequest).toHaveBeenCalledWith('req_0001')
    expect(screen.queryByText('Olena Kravets')).not.toBeInTheDocument()
  })
})
