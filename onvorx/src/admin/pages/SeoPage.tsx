import { useMemo, useState } from 'react'
import type { L, SeoEntry } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { LocalizedField } from '../components/LocalizedField'
import { SaveBar } from '../components/SaveBar'
import { SerpPreview } from './SerpPreview'
import { useToast } from '../components/Toast'
import { useAdminTitle } from '../useAdminTitle'

const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk

function SeoEntryEditor({ entry }: { entry: SeoEntry }) {
  const { actions } = useSiteContentRaw()
  const toast = useToast()

  const stored = useMemo(
    () => ({ title: { ...entry.title }, description: { ...entry.description } }),
    [entry],
  )
  const [draft, setDraft] = useState(() => ({
    title: { ...entry.title },
    description: { ...entry.description },
  }))
  const dirty = !eqL(draft.title, stored.title) || !eqL(draft.description, stored.description)

  const save = () => {
    actions.updateSeo(entry.pageKey, { title: draft.title, description: draft.description })
    toast('Saved')
  }

  return (
    <fieldset className="admin-fieldset">
      <legend>
        <h2>{entry.label}</h2>
      </legend>
      <LocalizedField
        label="SEO title"
        value={draft.title}
        recommended={60}
        onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
      />
      <LocalizedField
        label="Meta description"
        value={draft.description}
        multiline
        recommended={155}
        onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
      />
      <p className="admin-field__hint">Google preview (English):</p>
      <SerpPreview title={draft.title.en} description={draft.description.en} path={entry.path} />
      <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(stored)} />
    </fieldset>
  )
}

export function SeoPage() {
  useAdminTitle('SEO')
  const { data } = useSiteContentRaw()
  return (
    <section className="admin-page">
      <h1>SEO</h1>
      <p className="admin-page__hint">
        The title and description search engines show for each page. Keep the title under ~60
        characters and the description under ~155.
      </p>
      {data.seo.map((e) => (
        <SeoEntryEditor key={e.pageKey} entry={e} />
      ))}
    </section>
  )
}
