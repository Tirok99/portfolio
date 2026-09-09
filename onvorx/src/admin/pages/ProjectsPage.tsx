import { useEffect, useMemo, useState } from 'react'
import type { CardListKey, L, ProjectCard } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { CardList } from '../components/CardList'
import { CardScreen } from './CardScreen'
import { ImageUpload } from '../components/ImageUpload'
import { LocalizedField } from '../components/LocalizedField'
import { TextField } from '../components/TextField'
import { Toggle } from '../components/Toggle'
import { SaveBar } from '../components/SaveBar'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { useAdminTitle } from '../useAdminTitle'

const TABS: { key: CardListKey; label: string }[] = [
  { key: 'projectsHome', label: 'On the home page' },
  { key: 'projectsPage', label: 'Projects page' },
]

interface Draft {
  title: L
  tags: string
  description: L
  imageAlt: L
  published: boolean
}
const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk
const toDraft = (c: ProjectCard): Draft => ({
  title: { ...c.title },
  tags: c.tags.join(', '),
  description: { ...c.description },
  imageAlt: { ...c.imageAlt },
  published: c.published,
})

export function ProjectsPage() {
  useAdminTitle('Projects')
  const { data, actions } = useSiteContentRaw()
  const { confirm, dialog } = useConfirm()
  const toast = useToast()

  const [list, setList] = useState<CardListKey>('projectsHome')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const cards = useMemo(
    () => [...(data[list] as ProjectCard[])].sort((a, b) => a.order - b.order),
    [data, list],
  )
  const selected = cards.find((c) => c.id === selectedId) ?? null

  const [draft, setDraft] = useState<Draft | null>(null)
  const stored = selected ? toDraft(selected) : null
  // re-seed the draft when the selected card changes (different id or list).
  // In-place store edits (image, save) do not re-seed — the draft owns the form.
  useEffect(() => {
    setDraft(selected ? toDraft(selected) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, list])

  const dirty =
    Boolean(draft && stored) &&
    (!eqL(draft!.title, stored!.title) ||
      draft!.tags !== stored!.tags ||
      !eqL(draft!.description, stored!.description) ||
      !eqL(draft!.imageAlt, stored!.imageAlt) ||
      draft!.published !== stored!.published)

  const save = () => {
    if (!selected || !draft) return
    const normalizedTags = draft.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    actions.updateCard(list, selected.id, {
      title: draft.title,
      tags: normalizedTags,
      description: draft.description,
      imageAlt: draft.imageAlt,
      published: draft.published,
    })
    // Re-seed the draft with the canonical tag string so a non-canonical input
    // (`"a,b"`, trailing comma, double space) does not leave `dirty` stuck true.
    setDraft((d) => d && { ...d, tags: normalizedTags.join(', ') })
    toast('Saved')
  }

  const del = async () => {
    if (!selected) return
    const ok = await confirm({
      title: 'Delete this project card?',
      message: 'It will be removed from the list. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    actions.removeCard(list, selected.id)
    setSelectedId(null)
    toast('Card deleted')
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
      onMove={(id, dir) => actions.moveCard(list, id, dir)}
      onAdd={() => actions.addCard(list)}
      addLabel="Add project"
    />
  )

  const editorNode =
    selected && draft ? (
      <div>
        <p className="admin-field__hint">
          Position {cards.findIndex((c) => c.id === selected.id) + 1} of{' '}
          {cards.length} — use ▲ ▼ in the list to reorder.
        </p>
        <LocalizedField
          label="Title"
          value={draft.title}
          onChange={(v) => setDraft({ ...draft, title: v })}
        />
        <TextField
          label="Tags"
          value={draft.tags}
          hint="Comma-separated, e.g. WordPress, WooCommerce"
          onChange={(v) => setDraft({ ...draft, tags: v })}
        />
        <LocalizedField
          label="Description"
          value={draft.description}
          multiline
          onChange={(v) => setDraft({ ...draft, description: v })}
        />
        <ImageUpload
          label="Image"
          value={selected.image}
          onChange={(ref) => actions.setCardImage(list, selected.id, ref)}
          onClear={() =>
            actions.setCardImage(list, selected.id, { kind: 'asset', src: '' })
          }
        />
        <LocalizedField
          label="Image alt text"
          value={draft.imageAlt}
          hint="Describes the image for screen readers and search engines."
          onChange={(v) => setDraft({ ...draft, imageAlt: v })}
        />
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
        title="Projects"
        hint="Project cards shown in the Projects block on the home page, and the (future) Projects page. Each list is separate."
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
