import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useConfirm } from './ConfirmDialog'

function Probe({ onResult }: { onResult: (v: boolean) => void }) {
  const { confirm, dialog } = useConfirm()
  return (
    <>
      <button onClick={async () => onResult(await confirm({ title: 'Delete?', message: 'Sure?' }))}>
        ask
      </button>
      {dialog}
    </>
  )
}

describe('useConfirm', () => {
  it('resolves true on confirm, false on cancel', async () => {
    const user = userEvent.setup()
    const results: boolean[] = []
    render(<Probe onResult={(v) => results.push(v)} />)

    await user.click(screen.getByText('ask'))
    await user.click(screen.getByRole('button', { name: /confirm|delete|yes/i }))
    await user.click(screen.getByText('ask'))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(results).toEqual([true, false])
  })
})
