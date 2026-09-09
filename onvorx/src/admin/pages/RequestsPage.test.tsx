import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { RequestsPage } from './RequestsPage'

beforeEach(() => localStorage.clear())

function Probe() {
  const { data } = useSiteContentRaw()
  return <span data-testid="count">{data.requests.length}</span>
}
const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <RequestsPage />
          <Probe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('RequestsPage', () => {
  it('lists seeded requests and filters by status', async () => {
    const user = userEvent.setup()
    wrap()
    expect(screen.getByText('Olena Kravets')).toBeInTheDocument()
    expect(screen.getByText('Tomasz Nowak')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/status/i), 'archived')
    expect(screen.queryByText('Olena Kravets')).not.toBeInTheDocument()
    expect(screen.getByText('Anna Schmidt')).toBeInTheDocument()
  })

  it('filters by free text (name/email/message)', async () => {
    const user = userEvent.setup()
    wrap()
    await user.type(screen.getByLabelText(/search/i), 'encryptia')
    expect(screen.getByText('Markus Feld')).toBeInTheDocument()
    expect(screen.queryByText('Olena Kravets')).not.toBeInTheDocument()
  })

  it('opens a row, changes status, and it persists', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('button', { name: /Olena Kravets/i }))
    const detail = screen.getByRole('region', { name: /request detail/i })
    await user.selectOptions(within(detail).getByLabelText(/status/i), 'done')
    expect(
      within(screen.getByRole('table')).getAllByText(/done/i).length,
    ).toBeGreaterThan(0)
  })

  it('opens a row via the keyboard-focusable row button', async () => {
    const user = userEvent.setup()
    wrap()
    screen.getByRole('button', { name: /Olena Kravets/i }).focus()
    await user.keyboard('{Enter}')
    expect(
      screen.getByRole('region', { name: /request detail/i }),
    ).toBeInTheDocument()
  })

  it('deletes a request after confirmation', async () => {
    const user = userEvent.setup()
    wrap()
    const before = Number(screen.getByTestId('count').textContent)
    await user.click(screen.getByRole('button', { name: /Olena Kravets/i }))
    const detail = screen.getByRole('region', { name: /request detail/i })
    await user.click(within(detail).getByRole('button', { name: /^delete$/i }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /delete request/i }),
    )
    expect(Number(screen.getByTestId('count').textContent)).toBe(before - 1)
  })
})
