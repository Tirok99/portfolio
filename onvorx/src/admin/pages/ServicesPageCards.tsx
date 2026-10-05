import { useMemo, useState, type ReactNode } from 'react'
import type {
  AiBuildMedia,
  ImageRef,
  SectionCard,
  SectionMedia,
  SectionText,
  ServiceBlockMedia,
  ServicesSectionKey,
} from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { defaultSections } from '../../content/defaults/sections'
import { isAiBuildMedia, isBlockMedia, mergeTrack } from '../../content/servicesSections'
import { CardScreen } from './CardScreen'
import { FixedCardList } from '../components/FixedCardList'
import { FeatureListEditor } from '../components/FeatureListEditor'
import { ImageUpload } from '../components/ImageUpload'
import { LocalizedField } from '../components/LocalizedField'
import { LocalizedListField } from '../components/LocalizedListField'
import { SaveBar } from '../components/SaveBar'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'

type Group = Exclude<ServicesSectionKey, 'svcCta'>

const GROUPS: { id: Group; label: string }[] = [
  { id: 'svcHero', label: 'Hero cards' },
  { id: 'svcWebDevelopment', label: 'Web Development' },
  { id: 'svcAiBuild', label: 'AI Build' },
  { id: 'svcWebsiteSupport', label: 'Website Support' },
  { id: 'svcBusinessAnalysis', label: 'Business Analysis' },
  { id: 'svcGoogleAds', label: 'Google Ads' },
]

/** The Google Ads block has no illustration in the design (spec §5.3). */
const NO_PICTURE: Group[] = ['svcGoogleAds']

const emptyImage = (): ImageRef => ({ kind: 'asset', src: '' })
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** A new feature item starts with the block's first built-in icon (spec §6.2). */
const placeholderIcon = (key: Group): ImageRef => ({
  ...(defaultSections.find((s) => s.key === key)?.cards?.[0]?.icon ?? emptyImage()),
})

interface Draft {
  cards: SectionCard[]
  media?: SectionMedia
}

const blockMedia = (m: SectionMedia | undefined): ServiceBlockMedia =>
  m && isBlockMedia(m) ? m : { badge: emptyImage() }
const aiMedia = (m: SectionMedia | undefined): AiBuildMedia =>
  m && isAiBuildMedia(m) ? m : { site: emptyImage(), admin: emptyImage(), bot: emptyImage() }

function GroupEditor({ sectionKey, section }: { sectionKey: Group; section: SectionText }) {
  const { actions } = useSiteContentRaw()
  const toast = useToast()

  const stored = useMemo<Draft>(
    () => clone({ cards: section.cards ?? [], ...(section.media ? { media: section.media } : {}) }),
    [section],
  )
  const [draft, setDraft] = useState<Draft>(() => clone(stored))
  const dirty = !same(draft, stored)

  const save = async () => {
    // Cards owns `cards` + `media` only — never `texts` (spec §5.3).
    const patch: Partial<Pick<SectionText, 'cards' | 'media'>> = {}
    if (!same(draft.cards, stored.cards)) patch.cards = draft.cards
    if (draft.media && !same(draft.media, stored.media)) patch.media = draft.media
    try {
      await actions.updateSection(sectionKey, patch)
      toast('Saved')
    } catch {
      toast('Save failed', 'error')
    }
  }

  // Every draft change is computed from the CURRENT draft: an image upload
  // resolves seconds after the render that started it, and a snapshot taken
  // back then would undo whatever else was edited (or uploaded) meanwhile.
  const setCards = (update: (prev: SectionCard[]) => SectionCard[]) =>
    setDraft((d) => ({ ...d, cards: update(d.cards) }))
  const setCard = (i: number, patch: Partial<SectionCard>) =>
    setCards((cards) => cards.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const setBlockMedia = (patch: Partial<ServiceBlockMedia>) =>
    setDraft((d) => ({ ...d, media: { ...blockMedia(d.media), ...patch } }))
  const setAiMedia = (patch: Partial<AiBuildMedia>) =>
    setDraft((d) => ({ ...d, media: { ...aiMedia(d.media), ...patch } }))

  const image = (label: string, value: ImageRef, onSet: (ref: ImageRef) => void, variant: 'icon' | 'photo') => (
    <ImageUpload
      label={label}
      folder="cards"
      variant={variant}
      value={value}
      onChange={async (ref) => onSet(ref)}
      onClear={async () => onSet(emptyImage())}
      // draft-only until Save — the old Storage object must outlive a discard
      deferDelete={true}
    />
  )

  let body: ReactNode
  if (sectionKey === 'svcHero') {
    body = draft.cards.map((card, i) => (
      <fieldset key={i} className="admin-group">
        <legend className="admin-field__label">Card {i + 1}</legend>
        {image('Icon', card.icon, (icon) => setCard(i, { icon }), 'icon')}
        <LocalizedField label="Title" value={card.title} onChange={(title) => setCard(i, { title })} />
        <LocalizedListField label="Tags" items={card.tags ?? []} onChange={(tags) => setCard(i, { tags })} addLabel="Add tag" />
      </fieldset>
    ))
  } else if (sectionKey === 'svcAiBuild') {
    const media = aiMedia(draft.media)
    body = (
      <>
        {/* AI Build has no cards of its own — only the 3 mockups live here */}
        <p className="admin-page__hint">
          Title, text, badge and stack of this block are edited in{' '}
          <a href="/admin/content?tab=services">Content → Services → AI Build</a>.
        </p>
        {image('Site mockup', media.site, (site) => setAiMedia({ site }), 'photo')}
        {image('Admin panel mockup', media.admin, (admin) => setAiMedia({ admin }), 'photo')}
        {image('Telegram bot mockup', media.bot, (bot) => setAiMedia({ bot }), 'photo')}
      </>
    )
  } else {
    const media = blockMedia(draft.media)
    const icon = placeholderIcon(sectionKey)
    body = (
      <>
        {image('Badge', media.badge, (badge) => setBlockMedia({ badge }), 'icon')}
        {!NO_PICTURE.includes(sectionKey) &&
          image('Illustration', media.picture ?? emptyImage(), (picture) => setBlockMedia({ picture }), 'photo')}
        {sectionKey === 'svcBusinessAnalysis' ? (
          ([0, 1] as const).map((track) => (
            <FeatureListEditor
              key={track}
              label={`Track 0${track + 1} features`}
              items={draft.cards.filter((c) => c.track === track)}
              newItemIcon={icon}
              onChange={(update) =>
                setCards((cards) => mergeTrack(cards, track, update(cards.filter((c) => c.track === track))))
              }
            />
          ))
        ) : (
          <FeatureListEditor label="Features" items={draft.cards} newItemIcon={icon} onChange={setCards} />
        )}
      </>
    )
  }

  return (
    <div>
      {body}
      <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(clone(stored))} />
    </div>
  )
}

/** Cards → Services: the /services page cards and images (spec §6.2). */
export function ServicesPageCards() {
  const { data } = useSiteContentRaw()
  const [selected, setSelected] = useState<Group | null>(null)
  const section = selected ? data.sections.find((s) => s.key === selected) : undefined

  const list = (
    <FixedCardList items={GROUPS} selectedId={selected} onSelect={(id) => setSelected(id as Group)} />
  )
  const editor =
    selected && section ? (
      // keyed by group: switching groups starts a fresh draft
      <GroupEditor key={selected} sectionKey={selected} section={section} />
    ) : (
      <EmptyState title="No group selected" hint="Pick a group from the list." />
    )

  return (
    <CardScreen
      title="Services"
      hint="Cards and images on the /services page. Texts are edited under Content → Services."
      list={list}
      editor={editor}
    />
  )
}
