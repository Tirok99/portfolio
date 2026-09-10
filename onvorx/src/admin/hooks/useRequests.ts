import { useCallback, useEffect, useState } from 'react'
import type { EstimateRequest, RequestStatus } from '../types'
import { adminApi } from '../api'

export function useRequests() {
  const [requests, setRequests] = useState<EstimateRequest[] | null>(null)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    try {
      setRequests(await adminApi.listRequests())
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const optimistic = useCallback(
    async (apply: (r: EstimateRequest) => EstimateRequest, id: string, call: () => Promise<void>) => {
      setRequests((rs) => rs?.map((r) => (r.id === id ? apply(r) : r)) ?? rs)
      try {
        await call()
      } catch (e) {
        await reload()
        throw e
      }
    },
    [reload],
  )

  const setStatus = useCallback(
    (id: string, status: RequestStatus) =>
      optimistic((r) => ({ ...r, status }), id, () => adminApi.setRequestStatus(id, status)),
    [optimistic],
  )
  const setNote = useCallback(
    (id: string, note: string) =>
      optimistic((r) => ({ ...r, note }), id, () => adminApi.setRequestNote(id, note)),
    [optimistic],
  )
  const remove = useCallback(
    async (id: string) => {
      setRequests((rs) => rs?.filter((r) => r.id !== id) ?? rs)
      try {
        await adminApi.deleteRequest(id)
      } catch (e) {
        await reload()
        throw e
      }
    },
    [reload],
  )

  return { requests, error, reload, setStatus, setNote, remove }
}
