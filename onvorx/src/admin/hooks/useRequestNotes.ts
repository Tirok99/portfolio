import { useCallback, useEffect, useState } from 'react'
import type { RequestNote } from '../types'
import { adminApi } from '../api'

export function useRequestNotes(requestId: string) {
  const [notes, setNotes] = useState<RequestNote[] | null>(null)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    try {
      setNotes(await adminApi.listRequestNotes(requestId))
      setError(false)
    } catch {
      setError(true)
    }
  }, [requestId])

  useEffect(() => {
    void reload()
  }, [reload])

  const addNote = useCallback(
    async (body: string) => {
      await adminApi.addRequestNote(requestId, body)
      await reload()
    },
    [requestId, reload],
  )

  return { notes, error, addNote }
}
