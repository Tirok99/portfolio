import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { L } from '../types'
import { LocalizedListField } from './LocalizedListField'

function Harness({ initial }: { initial: L[] }) {
  const [items, setItems] = useState(initial)
  return (
    <>
      <LocalizedListField label="Tags" items={items} onChange={setItems} addLabel="Add tag" />
      <output data-testid="value">{JSON.stringify(items)}</output>
    </>
  )
}
const value = () => JSON.parse(screen.getByTestId('value').textContent!) as L[]
const two = [{ en: 'A', uk: 'А' }, { en: 'B', uk: 'Б' }]

describe('LocalizedListField', () => {
  it('shows one language at a time, EN by default', () => {
    render(<Harness initial={two} />)
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Tags 1 EN')).toHaveValue('A')
    expect(screen.queryByLabelText('Tags 1 UA')).not.toBeInTheDocument()
  })

  it('switching to UA edits the UA text and keeps EN', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    await user.click(screen.getByRole('button', { name: 'UA' }))
    expect(screen.queryByLabelText('Tags 2 EN')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Tags 2 UA'), '!')
    expect(value()[1]).toEqual({ en: 'B', uk: 'Б!' })
  })

  it('adds an empty item at the end', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    await user.click(screen.getByRole('button', { name: 'Add tag' }))
    expect(value()).toEqual([...two, { en: '', uk: '' }])
    expect(screen.getByLabelText('Tags 3 EN')).toHaveValue('')
  })

  it('removes an item', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    await user.click(screen.getByRole('button', { name: 'Remove: Tags 1' }))
    expect(value()).toEqual([two[1]])
  })

  it('moves items; the edge buttons are disabled', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    expect(screen.getByRole('button', { name: 'Move up: Tags 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move down: Tags 2' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move down: Tags 1' }))
    expect(value()).toEqual([two[1], two[0]])
  })

  it('says so when the list is empty', () => {
    render(<Harness initial={[]} />)
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument()
  })
})
