import { useMemo, useState } from 'react'
import type { L, SectionText, SectionTexts, ServicesSectionKey, TrackHead } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { SVC_SECTION_KEYS, isAiBuildTexts, isBlockTexts } from '../../content/servicesSections'
import { LocalizedField } from '../components/LocalizedField'
import { LocalizedListField } from '../components/LocalizedListField'
import { SaveBar } from '../components/SaveBar'
import { useToast } from '../components/Toast'

/** Which of the optional columns each section shows, and under what name (spec §5.2). */
const FIELD_LABELS: Record<ServicesSectionKey, { eyebrow?: string; ctaLabel?: string }> = {
  svcHero: { eyebrow: 'Eyebrow' },
  svcWebDevelopment: { ctaLabel: 'Button label' },
  svcAiBuild: { eyebrow: 'Badge', ctaLabel: 'Link text' },
  svcWebsiteSupport: { ctaLabel: 'Button label' },
  svcBusinessAnalysis: { ctaLabel: 'Button label' },
  svcGoogleAds: { ctaLabel: 'Button label' },
  svcCta: { eyebrow: 'Eyebrow', ctaLabel: 'Button label' },
}

interface Draft {
  eyebrow: L
  title: L
  body: L
  ctaLabel?: L
  texts?: SectionTexts
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const toDraft = (s: SectionText): Draft =>
  clone({
    eyebrow: s.eyebrow,
    title: s.title,
    body: s.body,
    ...(s.ctaLabel ? { ctaLabel: s.ctaLabel } : {}),
    ...(s.texts ? { texts: s.texts } : {}),
  })

function SvcSectionEditor({ section }: { section: SectionText }) {
  const key = section.key as ServicesSectionKey
  const labels = FIELD_LABELS[key]
  const { actions } = useSiteContentRaw()
  const toast = useToast()

  const stored = useMemo(() => toDraft(section), [section])
  const [draft, setDraft] = useState<Draft>(() => toDraft(section))
  const dirty = !same(draft, stored)

  const save = async () => {
    // Content owns these columns only — never `cards` / `media` (spec §5.3),
    // so a save here cannot overwrite an image change made under Cards.
    const patch: Partial<Draft> = {}
    if (!same(draft.eyebrow, stored.eyebrow)) patch.eyebrow = draft.eyebrow
    if (!same(draft.title, stored.title)) patch.title = draft.title
    if (!same(draft.body, stored.body)) patch.body = draft.body
    if (draft.ctaLabel && !same(draft.ctaLabel, stored.ctaLabel)) patch.ctaLabel = draft.ctaLabel
    if (draft.texts && !same(draft.texts, stored.texts)) patch.texts = draft.texts
    try {
      await actions.updateSection(key, patch)
      toast('Saved')
    } catch {
      toast('Save failed', 'error')
    }
  }

  const texts = draft.texts
  const setTexts = (next: SectionTexts) => setDraft((d) => ({ ...d, texts: next }))

  return (
    <details className="admin-disclosure">
      <summary className="admin-disclosure__summary">
        <h2>{section.label}</h2>
      </summary>
      <div className="admin-disclosure__body">
        {labels.eyebrow && (
          <LocalizedField
            label={labels.eyebrow}
            value={draft.eyebrow}
            onChange={(v) => setDraft((d) => ({ ...d, eyebrow: v }))}
          />
        )}
        <LocalizedField label="Title" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} />
        <LocalizedField
          label="Body"
          value={draft.body}
          multiline
          onChange={(v) => setDraft((d) => ({ ...d, body: v }))}
        />
        {labels.ctaLabel && draft.ctaLabel && (
          <LocalizedField
            label={labels.ctaLabel}
            value={draft.ctaLabel}
            onChange={(v) => setDraft((d) => ({ ...d, ctaLabel: v }))}
          />
        )}

        {texts && isBlockTexts(texts) && (
          <>
            <LocalizedListField
              label="Tags"
              items={texts.tags}
              onChange={(tags) => setTexts({ ...texts, tags })}
              addLabel="Add tag"
            />
            {texts.tracks?.map((track, i) => {
              const setTrack = (patch: Partial<TrackHead>) =>
                setTexts({
                  ...texts,
                  tracks: texts.tracks!.map((t, j) => (j === i ? { ...t, ...patch } : t)) as [TrackHead, TrackHead],
                })
              return (
                <div key={i}>
                  <LocalizedField
                    label={`Track 0${i + 1} — label`}
                    value={track.label}
                    onChange={(label) => setTrack({ label })}
                  />
                  <LocalizedField
                    label={`Track 0${i + 1} — title`}
                    value={track.title}
                    onChange={(title) => setTrack({ title })}
                  />
                </div>
              )
            })}
            {texts.get && (
              <>
                <LocalizedField
                  label="What you get — title"
                  value={texts.get.title}
                  onChange={(title) => setTexts({ ...texts, get: { ...texts.get!, title } })}
                />
                <LocalizedField
                  label="What you get — text"
                  value={texts.get.text}
                  multiline
                  onChange={(text) => setTexts({ ...texts, get: { ...texts.get!, text } })}
                />
              </>
            )}
          </>
        )}

        {texts && isAiBuildTexts(texts) && (
          <LocalizedListField
            label="Stack"
            items={texts.stack}
            onChange={(stack) => setTexts({ stack })}
            addLabel="Add item"
          />
        )}

        <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(clone(stored))} />
      </div>
    </details>
  )
}

/** Content → Services: the texts of the 7 /services sections, in page order. */
export function ServicesContent() {
  const { data } = useSiteContentRaw()
  const sections = SVC_SECTION_KEYS.map((k) => data.sections.find((s) => s.key === k)).filter(
    (s): s is SectionText => Boolean(s),
  )
  return (
    <>
      <p className="admin-page__hint">
        Texts on the /services page. Cards and images are edited under Cards → Services.
      </p>
      {sections.map((s) => (
        <SvcSectionEditor key={s.key} section={s} />
      ))}
    </>
  )
}
