import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardList } from './CardList'

const items = [
  { id: 'a', title: 'Alpha', published: true },
  { id: 'b', title: 'Beta', published: false },
]

describe('CardList', () => {
  it('renders rows, selects on click, and adds', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onAdd = vi.fn()
    render(
      <CardList
        items={items}
        selectedId="a"
        onSelect={onSelect}
        onMove={vi.fn()}
        onAdd={onAdd}
        addLabel="Add project"
      />,
    )
    await user.click(screen.getByText('Beta'))
    expect(onSelect).toHaveBeenCalledWith('b')
    await user.click(screen.getByRole('button', { name: /add project/i }))
    expect(onAdd).toHaveBeenCalled()
  })

  it('disables move-up on the first row and move-down on the last', () => {
    render(
      <CardList items={items} selectedId={null} onSelect={vi.fn()} onMove={vi.fn()} onAdd={vi.fn()} addLabel="Add" />,
    )
    const ups = screen.getAllByRole('button', { name: /move up/i })
    const downs = screen.getAllByRole('button', { name: /move down/i })
    expect(ups[0]).toBeDisabled()
    expect(downs[downs.length - 1]).toBeDisabled()
  })

  it('shows an empty-state line when there are no items', () => {
    render(
      <CardList items={[]} selectedId={null} onSelect={vi.fn()} onMove={vi.fn()} onAdd={vi.fn()} addLabel="Add" />,
    )
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument()
  })
})
