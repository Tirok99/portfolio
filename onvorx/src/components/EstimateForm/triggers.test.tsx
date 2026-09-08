import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { EstimateFormProvider } from './useEstimateForm'
import { EstimateForm } from './EstimateForm'
import { SiteHeader } from '../SiteHeader/SiteHeader'
import { Hero } from '../../sections/Hero/Hero'
import { Cta } from '../../sections/Cta/Cta'

beforeEach(() => localStorage.clear())

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <EstimateFormProvider>
          <MemoryRouter>{ui}</MemoryRouter>
          <EstimateForm />
        </EstimateFormProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('estimate CTA triggers', () => {
  it('header CTA opens the modal', async () => {
    const user = userEvent.setup()
    wrap(<SiteHeader />)
    await user.click(
      screen.getAllByRole('button', { name: /request an estimate/i })[0],
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hero CTA opens the modal', async () => {
    const user = userEvent.setup()
    wrap(<Hero />)
    await user.click(screen.getByRole('button', { name: /request an estimate/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('cta section button opens the modal', async () => {
    const user = userEvent.setup()
    wrap(<Cta />)
    await user.click(
      screen.getByRole('button', { name: /request a project estimate/i }),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
