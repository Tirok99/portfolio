import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

beforeEach(() => localStorage.clear())

describe('App', () => {
  it('renders the home hero from the content store', () => {
    render(<App />)
    // hero title seeded from i18n en.json
    expect(
      screen.getByRole('heading', {
        name: /Web solutions built around your business requirements/i,
      }),
    ).toBeInTheDocument()
  })
})
