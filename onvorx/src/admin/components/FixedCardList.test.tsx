import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FixedCardList } from './FixedCardList'

const ITEMS = [
  { id: 'card-0', label: '1 — Since 2023' },
  { id: 'card-1', label: '2 — Real project work' },
  { id: 'launch', label: 'Launch — Launch' },
]

describe('FixedCardList', () => {
  it('renders every item label', () => {
    render(<FixedCardList items={ITEMS} selectedId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('1 — Since 2023')).toBeInTheDocument()
    expect(screen.getByText('2 — Real project work')).toBeInTheDocument()
    expect(screen.getByText('Launch — Launch')).toBeInTheDocument()
  })

  it('marks the selected row with is-selected', () => {
    render(<FixedCardList items={ITEMS} selectedId="card-1" onSelect={vi.fn()} />)
    expect(screen.getByText('2 — Real project work').closest('div')).toHaveClass('is-selected')
    expect(screen.getByText('1 — Since 2023').closest('div')).not.toHaveClass('is-selected')
  })

  it('calls onSelect with the row id on click', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<FixedCardList items={ITEMS} selectedId={null} onSelect={onSelect} />)
    await user.click(screen.getByText('Launch — Launch'))
    expect(onSelect).toHaveBeenCalledWith('launch')
  })

  it('calls onSelect on Enter and Space keydown', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<FixedCardList items={ITEMS} selectedId={null} onSelect={onSelect} />)
    const row = screen.getByText('1 — Since 2023').closest('div')!
    row.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('card-0')
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(2)
  })
})
