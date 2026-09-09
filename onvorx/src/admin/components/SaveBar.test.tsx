import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SaveBar } from './SaveBar'

describe('SaveBar', () => {
  it('shows dirty state and fires callbacks', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onDiscard = vi.fn()
    render(<SaveBar dirty onSave={onSave} onDiscard={onDiscard} />)
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /save/i }))
    await user.click(screen.getByRole('button', { name: /discard/i }))
    expect(onSave).toHaveBeenCalled()
    expect(onDiscard).toHaveBeenCalled()
  })
  it('disables Save when clean', () => {
    render(<SaveBar dirty={false} onSave={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })
})
