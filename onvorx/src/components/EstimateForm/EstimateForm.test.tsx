import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
} from '../../content/SiteContentProvider'
import { EstimateFormProvider, useEstimateForm } from './useEstimateForm'
import { EstimateForm } from './EstimateForm'

beforeEach(() => localStorage.clear())

function OpenButton() {
  const { open } = useEstimateForm()
  return <button onClick={() => open('/test')}>open form</button>
}

function RequestCount() {
  const { data } = useSiteContentRaw()
  return <span data-testid="count">{data.requests.length}</span>
}

const setup = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <EstimateFormProvider>
          <OpenButton />
          <RequestCount />
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

  it('blocks submit and shows errors when required fields are empty', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    const countBefore = screen.getByTestId('count').textContent
    await user.click(screen.getByRole('button', { name: /send request/i }))
    expect(screen.getByTestId('count')).toHaveTextContent(countBefore!)
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

  it('submits a valid form and records a request', async () => {
    const user = userEvent.setup()
    setup()
    const before = Number(screen.getByTestId('count').textContent)
    await user.click(screen.getByText('open form'))
    await user.type(screen.getByLabelText(/name/i), 'Jane Roe')
    await user.type(screen.getByLabelText(/email/i), 'jane@roe.com')
    await user.type(screen.getByLabelText(/message/i), 'We need a new site.')
    await user.click(screen.getByRole('button', { name: /send request/i }))
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument()
    expect(Number(screen.getByTestId('count').textContent)).toBe(before + 1)
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
