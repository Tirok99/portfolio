import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AdminData,
  CardListKey,
  ImageRef,
  SectionKey,
  SectionText,
  SeoEntry,
  SeoPageKey,
} from '../admin/types'
import * as A from '../admin/actions'
import {
  STORAGE_KEY,
  isAdminData,
  loadAdminData,
  saveAdminData,
} from './persistence'
import { fetchRemoteContent } from './remote'

export interface SiteContentActions {
  updateSection: (
    key: SectionKey,
    patch: Partial<Omit<SectionText, 'key' | 'label'>>,
  ) => void
  addCard: (list: CardListKey) => void
  updateCard: (
    list: CardListKey,
    id: string,
    patch: Record<string, unknown>,
  ) => void
  removeCard: (list: CardListKey, id: string) => void
  moveCard: (list: CardListKey, id: string, dir: 'up' | 'down') => void
  setCardImage: (list: CardListKey, id: string, image: ImageRef) => void
  updateSeo: (
    pageKey: SeoPageKey,
    patch: Partial<Pick<SeoEntry, 'title' | 'description'>>,
  ) => void
  resetAll: () => void
}

export interface SiteContentContextValue {
  data: AdminData
  actions: SiteContentActions
}

export const SiteContentContext =
  createContext<SiteContentContextValue | null>(null)

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>(loadAdminData)
  const skipNextPersist = useRef(false)
  const firstRun = useRef(true)

  // persist whenever data changes, except when the change came from another
  // tab's storage event, or on the initial mount (already in storage)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    saveAdminData(data)
  }, [data])

  // cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      let parsed: unknown
      try {
        parsed = JSON.parse(e.newValue)
      } catch {
        return
      }
      if (!isAdminData(parsed)) return
      skipNextPersist.current = true
      setData(parsed)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // On mount, pull the managed content from Supabase and overlay it on top of
  // the seeded/persisted defaults. Failure (no env, offline, query error) is a
  // no-op — the bundled content stays. Admin write-through is Plan 3.
  useEffect(() => {
    let cancelled = false
    void fetchRemoteContent().then((remote) => {
      if (cancelled || !remote) return
      skipNextPersist.current = true
      setData((d) => ({ ...d, ...remote }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const actions = useMemo<SiteContentActions>(
    () => ({
      updateSection: (key, patch) =>
        setData((d) => A.updateSection(d, key, patch)),
      addCard: (list) => setData((d) => A.addCard(d, list)),
      updateCard: (list, id, patch) =>
        setData((d) => A.updateCard(d, list, id, patch)),
      removeCard: (list, id) => setData((d) => A.removeCard(d, list, id)),
      moveCard: (list, id, dir) => setData((d) => A.moveCard(d, list, id, dir)),
      setCardImage: (list, id, image) =>
        setData((d) => A.setCardImage(d, list, id, image)),
      updateSeo: (pageKey, patch) =>
        setData((d) => A.updateSeo(d, pageKey, patch)),
      resetAll: () => setData(A.resetAll()),
    }),
    [],
  )

  const value = useMemo(() => ({ data, actions }), [data, actions])

  return (
    <SiteContentContext.Provider value={value}>
      {children}
    </SiteContentContext.Provider>
  )
}

export function useSiteContentRaw(): SiteContentContextValue {
  const ctx = useContext(SiteContentContext)
  if (!ctx)
    throw new Error('useSiteContent must be used within <SiteContentProvider>')
  return ctx
}
