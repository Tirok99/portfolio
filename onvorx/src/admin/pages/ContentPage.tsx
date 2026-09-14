import { useMemo, useState } from 'react'
import type { L, SectionCard, SectionKey, SectionText } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { LocalizedField } from '../components/LocalizedField'
import { ImageUpload } from '../components/ImageUpload'
import { SaveBar } from '../components/SaveBar'
import { useToast } from '../components/Toast'
import { useAdminTitle } from '../useAdminTitle'

function CardEditor({
  title,
  card,
  onChange,
}: {
  title: string
  card: SectionCard
  onChange: (next: SectionCard) => void
}) {
  const summary = card.title.en.trim() ? `${title} — ${card.title.en}` : title
  return (
    <details className="admin-disclosure admin-disclosure--nested">
      <summary className="admin-disclosure__summary">
        <span>{summary}</span>
      </summary>
      <div className="admin-disclosure__body admin-card-editor">
        <ImageUpload
          label="Icon"
          folder="cards"
          variant="icon"
          value={card.icon}
          onChange={async (icon) => onChange({ ...card, icon })}
          onClear={async () => onChange({ ...card, icon: { kind: 'asset', src: '' } })}
          // draft-state editor: nothing is persisted until the section's Save
          // button, so the old Storage object must outlive an unsaved replace
          deferDelete={true}
        />
        <LocalizedField
          label="Card title"
          value={card.title}
          onChange={(v) => onChange({ ...card, title: v })}
        />
        {card.sub !== undefined && (
          <LocalizedField
            label="Sub"
            value={card.sub}
            onChange={(v) => onChange({ ...card, sub: v })}
          />
        )}
        <LocalizedField
          label="Card text"
          value={card.text}
          multiline
          onChange={(v) => onChange({ ...card, text: v })}
        />
      </div>
    </details>
  )
}

type Draft = Pick<SectionText, 'eyebrow' | 'title' | 'body'> & {
  ctaLabel?: L
  cards?: SectionCard[]
  launch?: SectionCard
}

const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk
const eqCard = (a: SectionCard, b: SectionCard): boolean =>
  a.icon.src === b.icon.src &&
  eqL(a.title, b.title) &&
  eqL(a.text, b.text) &&
  (a.sub === undefined && b.sub === undefined ? true : Boolean(a.sub && b.sub && eqL(a.sub, b.sub)))
const eqCards = (a: SectionCard[] | undefined, b: SectionCard[] | undefined): boolean => {
  if (a === undefined || b === undefined) return a === b
  if (a.length !== b.length) return false
  return a.every((c, i) => eqCard(c, b[i]))
}

const toDraft = (s: SectionText): Draft => ({
  eyebrow: { ...s.eyebrow },
  title: { ...s.title },
  body: { ...s.body },
  ...(s.ctaLabel ? { ctaLabel: { ...s.ctaLabel } } : {}),
  ...(s.cards ? { cards: s.cards.map((c) => ({ ...c })) } : {}),
  ...(s.launch ? { launch: { ...s.launch } } : {}),
})

function SectionEditor({ section }: { section: SectionText }) {
  const { actions } = useSiteContentRaw()
  const toast = useToast()

  // recomputes whenever the store slice changes; after our own save the new
  // `section` object flows in, `stored` updates, and `dirty` returns to false
  const stored = useMemo(() => toDraft(section), [section])
  const [draft, setDraft] = useState<Draft>(() => toDraft(section))

  const dirty =
    !eqL(draft.eyebrow, stored.eyebrow) ||
    !eqL(draft.title, stored.title) ||
    !eqL(draft.body, stored.body) ||
    Boolean(draft.ctaLabel && stored.ctaLabel && !eqL(draft.ctaLabel, stored.ctaLabel)) ||
    !eqCards(draft.cards, stored.cards) ||
    (draft.launch && stored.launch ? !eqCard(draft.launch, stored.launch) : draft.launch !== stored.launch)

  const save = async () => {
    const patch: Partial<Draft> = {}
    if (!eqL(draft.eyebrow, stored.eyebrow)) patch.eyebrow = draft.eyebrow
    if (!eqL(draft.title, stored.title)) patch.title = draft.title
    if (!eqL(draft.body, stored.body)) patch.body = draft.body
    if (draft.ctaLabel && stored.ctaLabel && !eqL(draft.ctaLabel, stored.ctaLabel))
      patch.ctaLabel = draft.ctaLabel
    if (!eqCards(draft.cards, stored.cards)) patch.cards = draft.cards
    if (draft.launch && stored.launch && !eqCard(draft.launch, stored.launch)) patch.launch = draft.launch
    try {
      await actions.updateSection(section.key, patch)
      toast('Saved')
    } catch {
      toast('Save failed', 'error')
    }
  }

  const isFooter = section.key === 'footer'

  return (
    <details className="admin-disclosure">
      <summary className="admin-disclosure__summary">
        <h2>{section.label}</h2>
      </summary>
      <div className="admin-disclosure__body">
        {!isFooter && (
          <>
            <LocalizedField
              label="Eyebrow"
              value={draft.eyebrow}
              onChange={(v) => setDraft((d) => ({ ...d, eyebrow: v }))}
            />
            <LocalizedField
              label="Title"
              value={draft.title}
              onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
            />
          </>
        )}
        <LocalizedField
          label={isFooter ? 'Tagline' : 'Body'}
          value={draft.body}
          multiline
          onChange={(v) => setDraft((d) => ({ ...d, body: v }))}
        />
        {!isFooter && draft.ctaLabel && (
          <LocalizedField
            label="Button label"
            value={draft.ctaLabel}
            onChange={(v) => setDraft((d) => ({ ...d, ctaLabel: v }))}
          />
        )}
        {draft.cards && (
          <div className="admin-cards-block">
            <h3>Cards</h3>
            {draft.cards.map((card, i) => (
              <CardEditor
                key={i}
                title={`Card ${i + 1}`}
                card={card}
                onChange={(next) =>
                  setDraft((d) => ({
                    ...d,
                    cards: d.cards!.map((c, ci) => (ci === i ? next : c)),
                  }))
                }
              />
            ))}
          </div>
        )}
        {draft.launch && (
          <div className="admin-cards-block">
            <CardEditor
              title="Launch card"
              card={draft.launch}
              onChange={(next) => setDraft((d) => ({ ...d, launch: next }))}
            />
          </div>
        )}
        <SaveBar dirty={Boolean(dirty)} onSave={save} onDiscard={() => setDraft(stored)} />
      </div>
    </details>
  )
}

const ORDER: SectionKey[] = ['hero', 'services', 'projects', 'howWork', 'about', 'cta', 'footer']

export function ContentPage() {
  useAdminTitle('Content')
  const { data } = useSiteContentRaw()
  const sections = ORDER.map((k) => data.sections.find((s) => s.key === k)).filter(
    (s): s is SectionText => Boolean(s),
  )
  return (
    <section className="admin-page">
      <h1>Content</h1>
      <p className="admin-page__hint">
        The heading and text for each block on the home page. Changes appear on the
        site immediately after you save.
      </p>
      {sections.map((s) => (
        <SectionEditor key={s.key} section={s} />
      ))}
    </section>
  )
}
