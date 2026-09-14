import { useState } from 'react'
import { ProjectsPage } from './ProjectsPage'
import { ServicesPage } from './ServicesPage'
import { SectionCardsPage } from './SectionCardsPage'

type CardType = 'hero' | 'howWork' | 'about' | 'projects' | 'services'

const TYPES: { key: CardType; label: string }[] = [
  { key: 'hero', label: 'Hero' },
  { key: 'howWork', label: 'How it works' },
  { key: 'about', label: 'About' },
  { key: 'projects', label: 'Projects' },
  { key: 'services', label: 'Services' },
]

export function CardsPage() {
  const [active, setActive] = useState<CardType>('hero')

  return (
    <div className="admin-page admin-page--wide">
      <div className="admin-tabs" role="tablist" aria-label="Card type">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            className={`admin-tab${t.key === active ? ' is-active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active === 'hero' && (
        <SectionCardsPage
          sectionKey="hero"
          title="Hero"
          hint="The 4 stat cards and the Launch card shown in the Hero block."
        />
      )}
      {active === 'howWork' && (
        <SectionCardsPage
          sectionKey="howWork"
          title="How it works"
          hint="The 4 step cards shown in the How it works block."
        />
      )}
      {active === 'about' && (
        <SectionCardsPage
          sectionKey="about"
          title="About"
          hint="The 3 stat cards shown in the About block."
        />
      )}
      {active === 'projects' && <ProjectsPage />}
      {active === 'services' && <ServicesPage />}
    </div>
  )
}
