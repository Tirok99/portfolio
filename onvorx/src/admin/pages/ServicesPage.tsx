import { useEffect, useMemo, useState } from 'react'
import type { CardListKey, L, ServiceCard } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { CardList } from '../components/CardList'
import { CardScreen } from './CardScreen'
import { ImageUpload } from '../components/ImageUpload'
import { LocalizedField } from '../components/LocalizedField'
import { Toggle } from '../components/Toggle'
import { SaveBar } from '../components/SaveBar'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { useAdminTitle } from '../useAdminTitle'

const TABS: { key: CardListKey; label: string }[] = [
  { key: 'servicesHome', label: 'On the home page' },
  { key: 'servicesPage', label: 'Services page' },
]

interface Draft {
  title: L
  text: L
  featured: boolean
  published: boolean
}
const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk
const toDraft = (c: ServiceCard): Draft => ({
  title: { ...c.title },
  text: { ...c.text },
  featured: c.featured,
  published: c.published,
})

export function ServicesPage() {
  useAdminTitle('Services')
  const { data, actions } = useSiteContentRaw()
  const { confirm, dialog } = useConfirm()
  const toast = useToast()

  const [list, setList] = useState<CardListKey>('servicesHome')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const isHome = list === 'servicesHome'

  const cards = useMemo(
    () => [...(data[list] as ServiceCard[])].sort((a, b) => a.order - b.order),
    [data, list],
  )
  const selected = cards.find((c) => c.id === selectedId) ?? null

  const [draft, setDraft] = useState<Draft | null>(null)
  const stored = selected ? toDraft(selected) : null
  // re-seed the draft when the selected card changes (different id or list).
  // In-place store edits (icon, save) do not re-seed — the draft owns the form.
  useEffect(() => {
    setDraft(selected ? toDraft(selected) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, list])

  const dirty =
    Boolean(draft && stored) &&
    (!eqL(draft!.title, stored!.title) ||
      !eqL(draft!.text, stored!.text) ||
      draft!.featured !== stored!.featured ||
      draft!.published !== stored!.published)

  const save = async () => {
    if (!selected || !draft) return
    try {
      await actions.updateCard(list, selected.id, {
        title: draft.title,
        text: draft.text,
        published: draft.published,
        ...(isHome ? { featured: draft.featured } : {}),
      })
      // Re-seed the local draft from what was just written, in canonical form, so
      // `dirty` reads false immediately (the hidden Featured field on the page tab
      // is not part of the patch, so mirror the stored value).
      setDraft((d) => d && { ...d, featured: isHome ? d.featured : selected.featured })
      toast('Saved')
    } catch {
      toast('Save failed', 'error')
    }
  }

  const del = async () => {
    if (!selected) return
    const ok = await confirm({
      title: 'Delete this service card?',
      message: 'It will be removed from the list. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await actions.removeCard(list, selected.id)
      setSelectedId(null)
      toast('Card deleted')
    } catch {
      toast('Delete failed', 'error')
    }
  }

  const listNode = (
    <CardList
      items={cards.map((c) => ({
        id: c.id,
        title: c.title.en,
        published: c.published,
      }))}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onMove={(id, dir) => {
        void actions.moveCard(list, id, dir).catch(() => toast('Save failed', 'error'))
      }}
      onAdd={() => {
        void actions.addCard(list).catch(() => toast('Save failed', 'error'))
      }}
      addLabel="Add service"
    />
  )

  const editorNode =
    selected && draft ? (
      <div>
        <ImageUpload
          label="Icon"
          value={selected.icon}
          onChange={(ref) => {
            void actions
              .setCardImage(list, selected.id, ref)
              .catch(() => toast('Save failed', 'error'))
          }}
          onClear={() => {
            void actions
              .setCardImage(list, selected.id, { kind: 'asset', src: '' })
              .catch(() => toast('Save failed', 'error'))
          }}
        />
        <LocalizedField
          label="Title"
          value={draft.title}
          onChange={(v) => setDraft({ ...draft, title: v })}
        />
        <LocalizedField
          label="Text"
          value={draft.text}
          multiline
          onChange={(v) => setDraft({ ...draft, text: v })}
        />
        {isHome && (
          <Toggle
            label="Featured (larger card)"
            checked={draft.featured}
            onChange={(v) => setDraft({ ...draft, featured: v })}
          />
        )}
        <Toggle
          label="Show on the site"
          checked={draft.published}
          onChange={(v) => setDraft({ ...draft, published: v })}
          hint="Unpublished cards are hidden from visitors but kept here."
        />
        <SaveBar
          dirty={dirty}
          onSave={save}
          onDiscard={() => stored && setDraft(stored)}
        />
        <button
          type="button"
          className="admin-btn admin-btn--danger"
          onClick={del}
        >
          Delete card
        </button>
      </div>
    ) : (
      <EmptyState
        title="No card selected"
        hint="Pick a card from the list, or add a new one."
      />
    )

  return (
    <>
      <CardScreen
        title="Services"
        hint="Service cards shown in the Services block on the home page, and the (future) Services page. Each list is separate."
        tabs={TABS}
        activeList={list}
        onActiveListChange={(l) => {
          setList(l)
          setSelectedId(null)
        }}
        list={listNode}
        editor={editorNode}
      />
      {dialog}
    </>
  )
}
