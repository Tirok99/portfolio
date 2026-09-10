import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRequests } from './useRequests'

vi.mock('../api', () => ({
  adminApi: {
    listRequests: vi.fn(),
    setRequestStatus: vi.fn().mockResolvedValue(undefined),
    setRequestNote: vi.fn().mockResolvedValue(undefined),
    deleteRequest: vi.fn().mockResolvedValue(undefined),
  },
}))
import { adminApi } from '../api'

const R = (over = {}) => ({
  id: 'r1', createdAt: '2026-01-01T00:00:00Z', status: 'new', name: 'A', email: 'a@b.c',
  interestedIn: [], message: 'hi', locale: 'en', ...over,
})

beforeEach(() => {
  vi.mocked(adminApi.listRequests).mockResolvedValue([R()])
})

describe('useRequests', () => {
  it('loads on mount', async () => {
    const { result } = renderHook(() => useRequests())
    expect(result.current.requests).toBeNull()
    await waitFor(() => expect(result.current.requests).toHaveLength(1))
  })
  it('setStatus is optimistic and calls the api', async () => {
    const { result } = renderHook(() => useRequests())
    await waitFor(() => expect(result.current.requests).toHaveLength(1))
    await act(() => result.current.setStatus('r1', 'done'))
    expect(result.current.requests![0].status).toBe('done')
    expect(adminApi.setRequestStatus).toHaveBeenCalledWith('r1', 'done')
  })
  it('reloads to revert when the api rejects', async () => {
    vi.mocked(adminApi.setRequestStatus).mockRejectedValueOnce(new Error('x'))
    vi.mocked(adminApi.listRequests).mockResolvedValueOnce([R()]).mockResolvedValueOnce([R({ status: 'new' })])
    const { result } = renderHook(() => useRequests())
    await waitFor(() => expect(result.current.requests).toHaveLength(1))
    await act(() => result.current.setStatus('r1', 'done').catch(() => {}))
    await waitFor(() => expect(result.current.requests![0].status).toBe('new'))
  })
  it('sets error:true when the initial load fails', async () => {
    vi.mocked(adminApi.listRequests).mockRejectedValueOnce(new Error('x'))
    const { result } = renderHook(() => useRequests())
    await waitFor(() => expect(result.current.error).toBe(true))
  })
})
