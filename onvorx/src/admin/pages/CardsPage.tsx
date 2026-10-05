import { useState } from 'react'
import { ProjectsPage } from './ProjectsPage'
import { ServicesPage } from './ServicesPage'
import { SectionCardsPage } from './SectionCardsPage'
import { ServicesPageCards } from './ServicesPageCards'

/** First level: the site page; second level (Home only): the block on it. */
type Page = 'home' | 'services'
type HomeBlock = 'hero' | 'howWork' | 'about' | 'projects' | 'services'

const PAGES: { key: Page; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'services', label: 'Services' },
]

const HOME_BLOCKS: { key: HomeBlock; label: string }[] = [
  { key: 'hero', label: 'Hero' },
  { key: 'howWork', label: 'How it works' },
  { key: 'about', label: 'About' },
  { key: 'projects', label: 'Projects' },
  { key: 'services', label: 'Services' },
]

function Tabs<K extends string>({
  label,
  items,
  active,
  onChange,
}: {
  label: string
  items: { key: K; label: string }[]
  active: K
  onChange: (k: K) => void
}) {
  return (
    <div className="admin-tabs" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === active}
          className={`admin-tab${t.key === active ? ' is-active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function CardsPage() {
  const [page, setPage] = useState<Page>('home')
  const [block, setBlock] = useState<HomeBlock>('hero')

  return (
    <div className="admin-page admin-page--wide">
      <Tabs
        label="Page"
        items={PAGES}
        active={page}
        onChange={(p) => {
          setPage(p)
          setBlock('hero')
        }}
      />
      {page === 'home' && <Tabs label="Card type" items={HOME_BLOCKS} active={block} onChange={setBlock} />}
      {/* Separate conditional slots, deliberately not a map/lookup: each
          screen must occupy its own fixed position in this children array so
          switching tabs genuinely unmounts the old slot and mounts a fresh
          instance at the new one, resetting that instance's own selection
          state. Collapsing this into one persistent element whose prop just
          changes would silently break that reset — see CardsPage.test.tsx's
          "resets the …" tests. */}
      {page === 'home' && block === 'hero' && (
        <SectionCardsPage
          sectionKey="hero"
          title="Hero"
          hint="The 4 stat cards and the Launch card shown in the Hero block."
        />
      )}
      {page === 'home' && block === 'howWork' && (
        <SectionCardsPage
          sectionKey="howWork"
          title="How it works"
          hint="The 4 step cards shown in the How it works block."
        />
      )}
      {page === 'home' && block === 'about' && (
        <SectionCardsPage
          sectionKey="about"
          title="About"
          hint="The 3 stat cards shown in the About block."
        />
      )}
      {page === 'home' && block === 'projects' && <ProjectsPage />}
      {page === 'home' && block === 'services' && <ServicesPage />}
      {page === 'services' && <ServicesPageCards />}
    </div>
  )
}
