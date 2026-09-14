import { useEffect, useState } from 'react'
import type { L, SectionCard } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { CardScreen } from './CardScreen'
import { FixedCardList } from '../components/FixedCardList'
import { ImageUpload } from '../components/ImageUpload'
import { LocalizedField } from '../components/LocalizedField'
import { SaveBar } from '../components/SaveBar'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useAdminTitle } from '../useAdminTitle'

interface Row {
  id: string
  label: string
  card: SectionCard
}

const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk
const eqCard = (a: SectionCard, b: SectionCard): boolean =>
  a.icon.src === b.icon.src &&
  eqL(a.title, b.title) &&
  eqL(a.text, b.text) &&
  (a.sub === undefined && b.sub === undefined ? true : Boolean(a.sub && b.sub && eqL(a.sub, b.sub)))

export function SectionCardsPage({
  sectionKey,
  title,
  hint,
}: {
  sectionKey: 'hero' | 'howWork' | 'about'
  title: string
  hint: string
}) {
  useAdminTitle(title)
  const { data, actions } = useSiteContentRaw()
  const toast = useToast()

  const section = data.sections.find((s) => s.key === sectionKey)!
  const cards = section.cards ?? []
  const launch = sectionKey === 'hero' ? section.launch : undefined

  const rows: Row[] = [
    ...cards.map((card, i) => ({
      id: `card-${i}`,
      label: `${i + 1} — ${card.title.en || 'Untitled'}`,
      card,
    })),
    ...(launch ? [{ id: 'launch', label: `Launch — ${launch.title.en || 'Untitled'}`, card: launch }] : []),
  ]

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedRow = rows.find((r) => r.id === selectedId) ?? null

  const [draft, setDraft] = useState<SectionCard | null>(null)
  const stored = selectedRow?.card ?? null
  // re-seed the draft when the selection changes (different row or section).
  // In-place store edits (icon upload) do not re-seed — the draft owns the form.
  useEffect(() => {
    setDraft(selectedRow ? { ...selectedRow.card } : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, sectionKey])

  const dirty = Boolean(draft && stored) && !eqCard(draft!, stored!)

  const save = async () => {
    if (!selectedRow || !draft) return
    try {
      if (selectedRow.id === 'launch') {
        await actions.updateSection(sectionKey, { launch: draft })
      } else {
        const index = Number(selectedRow.id.slice('card-'.length))
        const nextCards = cards.map((c, i) => (i === index ? draft : c))
        await actions.updateSection(sectionKey, { cards: nextCards })
      }
      toast('Saved')
    } catch {
      toast('Save failed', 'error')
    }
  }

  const listNode = (
    <FixedCardList
      items={rows.map((r) => ({ id: r.id, label: r.label }))}
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  )

  const editorNode =
    selectedRow && draft ? (
      <div>
        <ImageUpload
          label="Icon"
          folder="cards"
          variant="icon"
          value={draft.icon}
          onChange={async (icon) => setDraft({ ...draft, icon })}
          onClear={async () => setDraft({ ...draft, icon: { kind: 'asset', src: '' } })}
          // this editor only mutates local draft state until Save — the old
          // Storage object must outlive an unsaved icon replace
          deferDelete={true}
        />
        <LocalizedField
          label="Card title"
          value={draft.title}
          onChange={(v) => setDraft({ ...draft, title: v })}
        />
        {draft.sub !== undefined && (
          <LocalizedField
            label="Sub"
            value={draft.sub}
            onChange={(v) => setDraft({ ...draft, sub: v })}
          />
        )}
        <LocalizedField
          label="Card text"
          value={draft.text}
          multiline
          onChange={(v) => setDraft({ ...draft, text: v })}
        />
        <SaveBar
          dirty={dirty}
          onSave={save}
          onDiscard={() => stored && setDraft({ ...stored })}
        />
        <div className="admin-detail__actions">
          <button type="button" className="admin-btn" onClick={() => setSelectedId(null)}>
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <EmptyState title="No card selected" hint="Pick a card from the list." />
    )

  return <CardScreen title={title} hint={hint} list={listNode} editor={editorNode} />
}
