import {
  createContext,
  useCallback,
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
import { adminApi } from '../admin/api'
import { fetchRemoteContent } from './remote'
import { loadContentCache, saveContentCache } from './contentCache'
import { cardKindOf, cardListOf } from './cardList'
import { toSiteContent } from './toSiteContent'
import { buildDefaults } from './defaults'

export interface SiteContentActions {
  updateSection: (
    key: SectionKey,
    patch: Partial<Omit<SectionText, 'key' | 'label'>>,
  ) => Promise<void>
  addCard: (list: CardListKey) => Promise<void>
  updateCard: (
    list: CardListKey,
    id: string,
    patch: Record<string, unknown>,
  ) => Promise<void>
  removeCard: (list: CardListKey, id: string) => Promise<void>
  moveCard: (
    list: CardListKey,
    id: string,
    dir: 'up' | 'down',
  ) => Promise<void>
  setCardImage: (
    list: CardListKey,
    id: string,
    image: ImageRef,
  ) => Promise<void>
  updateSeo: (
    pageKey: SeoPageKey,
    patch: Partial<Pick<SeoEntry, 'title' | 'description'>>,
  ) => Promise<void>
  resetAll: () => Promise<void>
  /** Re-pull the managed content from Supabase and overlay it on the store. */
  refetch: () => Promise<void>
}

export interface SiteContentContextValue {
  data: AdminData
  actions: SiteContentActions
}

export const SiteContentContext =
  createContext<SiteContentContextValue | null>(null)

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>(() => {
    const base = buildDefaults()
    const cache = loadContentCache()
    return cache ? { ...base, ...cache } : base
  })
  const mounted = useRef(true)
  const reconcileTimer = useRef<number | undefined>(undefined)

  // Pull the managed content from Supabase and overlay it on top of the
  // seeded defaults. Failure (no env, offline, query error) is a no-op — the
  // current content stays. Also refreshes the local content cache.
  const refetch = useCallback(async () => {
    const remote = await fetchRemoteContent()
    if (!remote || !mounted.current) return
    setData((d) => ({ ...d, ...remote }))
    saveContentCache(remote)
  }, [])

  // debounced reconcile: after a successful write, re-pull once things settle
  const scheduleReconcile = useCallback(() => {
    window.clearTimeout(reconcileTimer.current)
    reconcileTimer.current = window.setTimeout(() => void refetch(), 800)
  }, [refetch])

  // optimistic reducer + server call + revert-on-error
  const write = useCallback(
    async (
      reducer: (d: AdminData) => AdminData,
      call: () => Promise<void>,
    ) => {
      setData(reducer)
      try {
        await call()
        scheduleReconcile()
      } catch (e) {
        // Revert to server truth. NOTE: if `refetch()` also can't reach Supabase
        // (returns null) the optimistic edit is NOT rolled back — it sticks
        // until a later successful refetch / reload. Acceptable in the mock
        // phase; Task 9b surfaces the error to the user.
        await refetch()
        throw e
      }
    },
    [refetch, scheduleReconcile],
  )

  // mount refetch + refetch on window focus
  useEffect(() => {
    mounted.current = true
    // one-time cleanup of the retired admin working store
    try {
      localStorage.removeItem('onvorx.admin.v1')
    } catch {
      /* private mode / unavailable — nothing to clean up */
    }
    void refetch()
    const onFocus = () => void refetch()
    window.addEventListener('focus', onFocus)
    return () => {
      mounted.current = false
      window.removeEventListener('focus', onFocus)
      window.clearTimeout(reconcileTimer.current)
    }
  }, [refetch])

  const actions = useMemo<SiteContentActions>(
    () => ({
      updateSection: (key, patch) =>
        write(
          (d) => A.updateSection(d, key, patch),
          () => adminApi.saveSection(key, patch),
        ),
      updateSeo: (pageKey, patch) =>
        write(
          (d) => A.updateSeo(d, pageKey, patch),
          () => adminApi.saveSeo(pageKey, patch),
        ),
      updateCard: (list, id, patch) =>
        write(
          (d) => A.updateCard(d, list, id, patch),
          () => adminApi.updateCard(cardKindOf(list), cardListOf(list), id, patch),
        ),
      removeCard: (list, id) =>
        write(
          (d) => A.removeCard(d, list, id),
          () => adminApi.deleteCard(cardKindOf(list), cardListOf(list), id),
        ),
      setCardImage: (list, id, image) =>
        write(
          (d) => A.setCardImage(d, list, id, image),
          () =>
            adminApi.updateCard(
              cardKindOf(list),
              cardListOf(list),
              id,
              // the server maps `image` for projects and `icon` for services
              // (`api/_lib/adminRows.ts`); `A.setCardImage` picks the same field
              cardKindOf(list) === 'project' ? { image } : { icon: image },
            ),
        ),
      addCard: (list) => {
        const card =
          cardKindOf(list) === 'project'
            ? A.blankProjectCard(data[list].length)
            : A.blankServiceCard(data[list].length)
        return write(
          (d) => A.appendCard(d, list, card),
          () => adminApi.createCard(cardKindOf(list), cardListOf(list), card),
        )
      },
      moveCard: (list, id, dir) => {
        const ids = A.orderedIdsAfterMove(data[list], id, dir)
        return write(
          (d) => A.moveCard(d, list, id, dir),
          () => adminApi.reorderCards(cardKindOf(list), cardListOf(list), ids),
        )
      },
      resetAll: () =>
        write(
          () => A.resetAll(),
          () => adminApi.resetContent(toSiteContent(buildDefaults())),
        ),
      refetch,
    }),
    [write, refetch, data],
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
