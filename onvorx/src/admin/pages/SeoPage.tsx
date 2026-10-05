import { useMemo, useState } from 'react'
import type { L, SeoEntry, SeoPageKey } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { LocalizedField } from '../components/LocalizedField'
import { SaveBar } from '../components/SaveBar'
import { SerpPreview } from './SerpPreview'
import { useToast } from '../components/Toast'
import { useAdminTitle } from '../useAdminTitle'
import { SERVICE_BLOCKS } from '../../data/servicesPage'

const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk

function SeoEntryEditor({ entry, label, address }: { entry: SeoEntry; label?: string; address?: string }) {
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

  const save = async () => {
    try {
      await actions.updateSeo(entry.pageKey, {
        title: draft.title,
        description: draft.description,
      })
      toast('Saved')
    } catch {
      toast('Save failed', 'error')
    }
  }

  return (
    <details className="admin-disclosure">
      <summary className="admin-disclosure__summary">
        <h2>{label ?? entry.label}</h2>
      </summary>
      <div className="admin-disclosure__body">
        {address && <p className="admin-field__hint">{label} → {address}</p>}
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
        <SerpPreview title={draft.title.en} description={draft.description.en} path={address ?? entry.path} />
        <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(stored)} />
      </div>
    </details>
  )
}

type SeoTab = 'home' | 'services' | 'projects' | 'about'

interface TabEntry {
  pageKey: SeoPageKey
  /** overrides the stored label, e.g. for the /services blocks */
  label?: string
  /** where the entry really lives now; also used by the SERP preview */
  address?: string
}

const block = (id: string) => `/services#${id}`

/** spec §6.3 — grouping and labels only; pageKeys and rows are unchanged. */
const SEO_TABS: { key: SeoTab; label: string; entries: TabEntry[] }[] = [
  { key: 'home', label: 'Home', entries: [{ pageKey: 'home' }] },
  {
    key: 'services',
    label: 'Services',
    entries: [
      { pageKey: 'services' },
      { pageKey: 'web-development', label: 'Web Development', address: block(SERVICE_BLOCKS.webDevelopment.id) },
      { pageKey: 'support', label: 'Website Support & Development', address: block(SERVICE_BLOCKS.websiteSupport.id) },
      { pageKey: 'business-analysis', label: 'Business Analysis', address: block(SERVICE_BLOCKS.businessAnalysis.id) },
      { pageKey: 'google-ads', label: 'Google Ads', address: block(SERVICE_BLOCKS.googleAds.id) },
    ],
  },
  { key: 'projects', label: 'Projects', entries: [{ pageKey: 'projects' }] },
  { key: 'about', label: 'About', entries: [{ pageKey: 'about' }] },
]

export function SeoPage() {
  useAdminTitle('SEO')
  const { data } = useSiteContentRaw()
  const [tab, setTab] = useState<SeoTab>('home')
  const active = SEO_TABS.find((t) => t.key === tab)!
  return (
    <section className="admin-page">
      <h1>SEO</h1>
      <p className="admin-page__hint">
        The title and description search engines show for each page. Keep the title under ~60
        characters and the description under ~155.
      </p>
      <div className="admin-tabs" role="tablist" aria-label="Page">
        {SEO_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            className={`admin-tab${t.key === tab ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active.entries.map(({ pageKey, label, address }) => {
        const entry = data.seo.find((e) => e.pageKey === pageKey)
        return entry ? <SeoEntryEditor key={pageKey} entry={entry} label={label} address={address} /> : null
      })}
    </section>
  )
}
