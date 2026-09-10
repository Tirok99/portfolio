import { useMemo, useState } from 'react'
import type { L, SectionKey, SectionText } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { LocalizedField } from '../components/LocalizedField'
import { SaveBar } from '../components/SaveBar'
import { useToast } from '../components/Toast'
import { useAdminTitle } from '../useAdminTitle'

type Draft = Pick<SectionText, 'eyebrow' | 'title' | 'body'> & { ctaLabel?: L }

const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk
const toDraft = (s: SectionText): Draft => ({
  eyebrow: { ...s.eyebrow },
  title: { ...s.title },
  body: { ...s.body },
  ...(s.ctaLabel ? { ctaLabel: { ...s.ctaLabel } } : {}),
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
    Boolean(draft.ctaLabel && stored.ctaLabel && !eqL(draft.ctaLabel, stored.ctaLabel))

  const save = async () => {
    const patch: Partial<Draft> = {}
    if (!eqL(draft.eyebrow, stored.eyebrow)) patch.eyebrow = draft.eyebrow
    if (!eqL(draft.title, stored.title)) patch.title = draft.title
    if (!eqL(draft.body, stored.body)) patch.body = draft.body
    if (draft.ctaLabel && stored.ctaLabel && !eqL(draft.ctaLabel, stored.ctaLabel))
      patch.ctaLabel = draft.ctaLabel
    try {
      await actions.updateSection(section.key, patch)
      toast('Saved')
    } catch {
      toast('Save failed', 'error')
    }
  }

  return (
    <fieldset className="admin-fieldset">
      <legend>
        <h2>{section.label}</h2>
      </legend>
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
      <LocalizedField
        label="Body"
        value={draft.body}
        multiline
        onChange={(v) => setDraft((d) => ({ ...d, body: v }))}
      />
      {draft.ctaLabel && (
        <LocalizedField
          label="Button label"
          value={draft.ctaLabel}
          onChange={(v) => setDraft((d) => ({ ...d, ctaLabel: v }))}
        />
      )}
      <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(stored)} />
    </fieldset>
  )
}

const ORDER: SectionKey[] = ['hero', 'services', 'projects', 'howWork', 'about', 'cta']

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
