import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { EstimateFormProvider, useEstimateForm } from './useEstimateForm'
import { EstimateForm } from './EstimateForm'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

function OpenButton() {
  const { open } = useEstimateForm()
  return <button onClick={() => open('/test')}>open form</button>
}

const setup = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <EstimateFormProvider>
          <OpenButton />
          <EstimateForm />
        </EstimateFormProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('EstimateForm', () => {
  it('is not in the DOM until opened', () => {
    setup()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens and shows the form fields', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument()
  })

  it('caps field lengths so the server limits are unreachable via the UI', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    expect(screen.getByLabelText(/message/i)).toHaveAttribute('maxlength', '5000')
    expect(screen.getByLabelText(/name/i)).toHaveAttribute('maxlength', '200')
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('maxlength', '200')
    expect(screen.getByLabelText(/company/i)).toHaveAttribute('maxlength', '200')
  })

  it('blocks submit and shows errors when required fields are empty', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    await user.click(screen.getByRole('button', { name: /send request/i }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0)
  })

  it('rejects an invalid email', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    await user.type(screen.getByLabelText(/name/i), 'Jane')
    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/message/i), 'Hi there')
    await user.click(screen.getByRole('button', { name: /send request/i }))
    expect(screen.getByText(/valid email/i)).toBeInTheDocument()
  })

  it('POSTs the form to /api/estimate and shows the thank-you panel', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    await user.type(screen.getByLabelText(/name/i), 'Jane Roe')
    await user.type(screen.getByLabelText(/email/i), 'jane@roe.com')
    await user.type(screen.getByLabelText(/message/i), 'We need a new site.')
    await user.click(screen.getByRole('button', { name: /send request/i }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/estimate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
      }),
    )
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent).toMatchObject({
      name: 'Jane Roe',
      email: 'jane@roe.com',
      message: 'We need a new site.',
      locale: 'en',
    })
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument()
  })

  it('renders a hidden honeypot field and sends it empty', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    const hp = document.querySelector('input[name="company_url"]') as HTMLInputElement | null
    expect(hp).not.toBeNull()
    expect(hp).not.toBeVisible() // jest-dom: off-screen / aria-hidden
    await user.type(screen.getByLabelText(/name/i), 'Jane')
    await user.type(screen.getByLabelText(/email/i), 'jane@roe.com')
    await user.type(screen.getByLabelText(/message/i), 'hi there')
    await user.click(screen.getByRole('button', { name: /send request/i }))
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.company_url).toBe('')
  })

  it('shows an error and keeps the form when the request fails', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'insert_failed' }) })
    setup()
    await user.click(screen.getByText('open form'))
    await user.type(screen.getByLabelText(/name/i), 'Jane Roe')
    await user.type(screen.getByLabelText(/email/i), 'jane@roe.com')
    await user.type(screen.getByLabelText(/message/i), 'Hello there.')
    await user.click(screen.getByRole('button', { name: /send request/i }))

    expect(
      await screen.findByText(/something went wrong|could not send|try again/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/thank you/i)).not.toBeInTheDocument()
  })

  it('does not call fetch when client validation fails', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    await user.click(screen.getByRole('button', { name: /send request/i }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('returns focus to the trigger after closing via Escape', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = screen.getByText('open form')
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })

  it('associates a validation error with its input via aria-describedby', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    await user.click(screen.getByRole('button', { name: /send request/i }))
    const nameInput = screen.getByLabelText(/name/i)
    const describedBy = nameInput.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const errorEl = document.getElementById(describedBy!)
    expect(errorEl).toBeInTheDocument()
    expect(errorEl).toHaveTextContent(/required/i)
  })
})
