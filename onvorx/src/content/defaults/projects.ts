import type { L, ProjectCard } from '../../admin/types'
import en from '../../i18n/en.json'
import uk from '../../i18n/uk.json'

interface RawProject {
  id: string
  title: string
  tags: string[]
  text: string
  image?: string
  imageAlt: string
}

const ukById = new Map<string, RawProject>(
  (uk.projects.items as unknown as RawProject[]).map((p) => [p.id, p]),
)

const pair = (a: string, b: string | undefined): L => ({ en: a, uk: b ?? a })

const cards: ProjectCard[] = (en.projects.items as unknown as RawProject[]).map(
  (p, i): ProjectCard => {
    const u = ukById.get(p.id)
    return {
      id: p.id,
      order: i,
      published: true,
      title: pair(p.title, u?.title),
      tags: [...p.tags],
      description: pair(p.text, u?.text),
      image: { kind: 'asset', src: p.image ?? `/assets/projects/${p.id}.png` },
      imageAlt: pair(p.imageAlt, u?.imageAlt),
    }
  },
)

const clone = (list: ProjectCard[]): ProjectCard[] =>
  list.map((c, i) => ({
    ...c,
    id: `${c.id}`,
    order: i,
    tags: [...c.tags],
    title: { ...c.title },
    description: { ...c.description },
    image: { ...c.image },
    imageAlt: { ...c.imageAlt },
  }))

export const defaultProjectsHome: ProjectCard[] = clone(cards)
export const defaultProjectsPage: ProjectCard[] = clone(cards)
