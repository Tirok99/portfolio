import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, ToastRegion, useToast } from './Toast'

function Trigger() {
  const toast = useToast()
  return <button onClick={() => toast('Saved', 'ok')}>go</button>
}

describe('Toast', () => {
  it('shows a toast then auto-dismisses', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
        <ToastRegion />
      </ToastProvider>,
    )
    act(() => screen.getByText('go').click())
    expect(screen.getByText('Saved')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(3100))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
