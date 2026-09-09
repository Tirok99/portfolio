import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalizedField } from './LocalizedField'
import type { L } from '../types'

// a controlled harness so typing actually updates the value
function Harness({ initial }: { initial: L }) {
  const [value, setValue] = useState<L>(initial)
  return (
    <>
      <LocalizedField label="Title" value={value} onChange={setValue} />
      <span data-testid="en">{value.en}</span>
      <span data-testid="uk">{value.uk}</span>
    </>
  )
}

describe('LocalizedField', () => {
  it('edits EN and UA independently without losing the other locale', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ en: 'Hello', uk: 'Privit' }} />)

    // EN tab is the default
    const input = () => screen.getByLabelText('Title') as HTMLInputElement
    expect(input().value).toBe('Hello')
    await user.type(input(), '!')
    expect(screen.getByTestId('en')).toHaveTextContent('Hello!')
    expect(screen.getByTestId('uk')).toHaveTextContent('Privit')

    await user.click(screen.getByRole('button', { name: 'UA' }))
    expect(input().value).toBe('Privit')
    await user.type(input(), ' UA')
    expect(screen.getByTestId('uk')).toHaveTextContent('Privit UA')
    expect(screen.getByTestId('en')).toHaveTextContent('Hello!')
  })
})
