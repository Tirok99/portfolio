# Admin: Unified CARDS Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/admin`'s separate "Projects" and "Services" nav entries with one "CARDS" entry that also brings in Hero/HowWork/About's card editors (currently nested accordions inside "Content"), so all five card types share one consistent list-left/editor-right interface.

**Architecture:** A new `CardsPage` owns a 5-way type tab strip (Hero/How it works/About/Projects/Services) and renders, per active type, either the existing `ProjectsPage`/`ServicesPage` components unchanged (as tab content instead of routed pages) or a new `SectionCardsPage` component for the fixed-count types, which reuses the existing `CardScreen` list+editor grid with a new, simpler `FixedCardList` (no add/reorder/publish — those don't apply to a fixed-count list).

**Tech Stack:** TypeScript, React, react-router-dom, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-14-admin-cards-nav-restructure-design.md` — read this in full before starting.

## Global Constraints

- The Telegram bot (any file under `api/_lib/telegram*.ts`) is not touched by this project, in any way.
- No add/remove/reorder for Hero/HowWork/About's cards — still fixed-count (4/4/3 plus Hero's single Launch card).
- No backend or data-model changes: `sectionRow()`, `site_sections` columns, and `actions.updateSection(key, patch)`'s signature (`Partial<Omit<SectionText,'key'|'label'>>`) are all reused exactly as they exist today — no new API method, no new action.
- No public-site changes (`Hero.tsx`/`HowWork.tsx`/`About.tsx`/`SiteFooter.tsx`/`src/content/*` are untouched).
- `src/components/Icon/Icon.tsx` is untouched.
- Projects' and Services' own editing behavior does not change — same fields, same add/reorder/publish/delete, same validation. Their existing test files (`ProjectsPage.test.tsx`, `ServicesPage.test.tsx`) must keep passing unmodified (they test the component's own behavior, which this project does not change).
- No new Supabase migration.

---

### Task 1: Widen `CardScreen` for reuse + new `FixedCardList` component

**Files:**
- Modify: `src/admin/pages/CardScreen.tsx`
- Create: `src/admin/components/FixedCardList.tsx`
- Test: `src/admin/components/FixedCardList.test.tsx`

**Interfaces:**
- Produces: `CardScreen<K extends string = string>` — `tabs`, `activeList`, `onActiveListChange` become optional (previously required, hardcoded to `CardListKey`); `FixedCardList({ items: {id:string;label:string}[], selectedId: string|null, onSelect: (id:string)=>void })`.
- Consumes (unchanged): `ProjectsPage.tsx`/`ServicesPage.tsx` continue to call `CardScreen` with `tabs`/`activeList`/`onActiveListChange` all supplied (typed to `CardListKey`) exactly as they do today — this task's widening must not change their behavior or require any edit to either file.

`CardScreen.tsx`'s current props type hardcodes `tabs: {key: CardListKey; label}[]`, `activeList: CardListKey`, `onActiveListChange: (l: CardListKey) => void` — all required. Task 2's `SectionCardsPage` needs the same list+editor grid layout but has no sub-tabs at all (Hero/HowWork/About have only one list each, unlike Projects/Services' Home/Page split). Making these three props optional and generic over the key type lets both kinds of caller share this one component, with zero behavior change for the existing callers (they keep passing all three, so `tabs.length > 1` still gates the tab row exactly as before).

- [ ] **Step 1: Write the failing test for `FixedCardList`**

Create `src/admin/components/FixedCardList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FixedCardList } from './FixedCardList'

const ITEMS = [
  { id: 'card-0', label: '1 — Since 2023' },
  { id: 'card-1', label: '2 — Real project work' },
  { id: 'launch', label: 'Launch — Launch' },
]

describe('FixedCardList', () => {
  it('renders every item label', () => {
    render(<FixedCardList items={ITEMS} selectedId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('1 — Since 2023')).toBeInTheDocument()
    expect(screen.getByText('2 — Real project work')).toBeInTheDocument()
    expect(screen.getByText('Launch — Launch')).toBeInTheDocument()
  })

  it('marks the selected row with is-selected', () => {
    render(<FixedCardList items={ITEMS} selectedId="card-1" onSelect={vi.fn()} />)
    expect(screen.getByText('2 — Real project work').closest('div')).toHaveClass('is-selected')
    expect(screen.getByText('1 — Since 2023').closest('div')).not.toHaveClass('is-selected')
  })

  it('calls onSelect with the row id on click', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<FixedCardList items={ITEMS} selectedId={null} onSelect={onSelect} />)
    await user.click(screen.getByText('Launch — Launch'))
    expect(onSelect).toHaveBeenCalledWith('launch')
  })

  it('calls onSelect on Enter and Space keydown', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<FixedCardList items={ITEMS} selectedId={null} onSelect={onSelect} />)
    const row = screen.getByText('1 — Since 2023').closest('div')!
    row.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('card-0')
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/admin/components/FixedCardList.test.tsx`
Expected: FAIL — `./FixedCardList` module doesn't exist yet.

- [ ] **Step 3: Implement `FixedCardList`**

Create `src/admin/components/FixedCardList.tsx`:

```tsx
export function FixedCardList({
  items,
  selectedId,
  onSelect,
}: {
  items: { id: string; label: string }[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="admin-cardlist">
      {items.map((it) => (
        <div
          key={it.id}
          className={`admin-cardrow${it.id === selectedId ? ' is-selected' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(it.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelect(it.id)
          }}
        >
          <span className="admin-cardrow__title">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
```

This reuses the existing `.admin-cardlist`/`.admin-cardrow`/`.admin-cardrow__title`/`.is-selected` CSS rules already defined in `src/admin/admin.css` (lines 133-144) for `CardList` — no new CSS needed; the rules are generic enough (flex row, border, selected-state border color) to work without the publish dot / move buttons `CardList` also renders.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/admin/components/FixedCardList.test.tsx`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Widen `CardScreen`'s prop types**

Replace `src/admin/pages/CardScreen.tsx` in full:

```tsx
import type { ReactNode } from 'react'

export function CardScreen<K extends string = string>({
  title,
  hint,
  tabs,
  activeList,
  onActiveListChange,
  list,
  editor,
}: {
  title: string
  hint: string
  tabs?: { key: K; label: string }[]
  activeList?: K
  onActiveListChange?: (l: K) => void
  list: ReactNode
  editor: ReactNode
}) {
  return (
    <section className="admin-page admin-page--wide">
      <h1>{title}</h1>
      <p className="admin-page__hint">{hint}</p>
      {tabs && tabs.length > 1 && (
        <div className="admin-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === activeList}
              className={`admin-tab${t.key === activeList ? ' is-active' : ''}`}
              onClick={() => onActiveListChange?.(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="admin-cardscreen">
        <div className="admin-cardscreen__list">{list}</div>
        <div className="admin-cardscreen__editor">{editor}</div>
      </div>
    </section>
  )
}
```

The only changes from the current file: `tabs`/`activeList`/`onActiveListChange` gain `?` (optional) and their key type changes from the hardcoded `CardListKey` (imported from `../types`) to a generic `K extends string = string`, inferred per call site — `ProjectsPage.tsx`/`ServicesPage.tsx` pass all three exactly as before (still typed as `CardListKey`, since TypeScript infers `K = CardListKey` from their `tabs`/`activeList` arguments), so their rendered output and behavior are byte-identical. The `import type { CardListKey } from '../types'` line is removed since nothing in this file references it anymore.

- [ ] **Step 6: Run the full admin test suite and typecheck to confirm no regression**

Run: `npx vitest run src/admin` and `npx tsc -b`
Expected: All tests pass (including `ProjectsPage.test.tsx`/`ServicesPage.test.tsx` unmodified), 0 TypeScript errors. This is the regression check that the `CardScreen` widening is genuinely behavior-preserving for its existing callers.

- [ ] **Step 7: Commit**

```bash
git add src/admin/pages/CardScreen.tsx src/admin/components/FixedCardList.tsx src/admin/components/FixedCardList.test.tsx
git commit -m "feat(admin): widen CardScreen for reuse, add FixedCardList for fixed-count cards"
```

---

### Task 2: `SectionCardsPage` — Hero/HowWork/About card editor

**Files:**
- Create: `src/admin/pages/SectionCardsPage.tsx`
- Test: `src/admin/pages/SectionCardsPage.test.tsx`

**Interfaces:**
- Consumes: `CardScreen<K>` and `FixedCardList` (Task 1); `useSiteContentRaw()` from `src/content/SiteContentProvider.tsx` (`data.sections: SectionText[]`, `actions.updateSection(key, patch)`); `SectionCard`/`SectionKey`/`L` from `src/admin/types.ts`; `ImageUpload`, `LocalizedField`, `SaveBar`, `EmptyState`, `useToast`, `useAdminTitle` (all existing, unchanged).
- Produces: `SectionCardsPage({ sectionKey: 'hero'|'howWork'|'about', title: string, hint: string })` — a full page component (own `<h1>`/hint/list/editor via `CardScreen`), consumed by Task 3's `CardsPage`.

Renders a `FixedCardList` of the section's cards (plus, for `hero` only, one extra "Launch" row for its standalone `launch` object) on the left, and a single-card editor (icon, title, optional Sub, text) on the right — matching the field set Project A's `CardEditor` already had, but editing one card at a time instead of always-open nested accordions. Saving patches only the edited card (or `launch`) back into the section's full `cards` array (or `launch` object) via the existing `actions.updateSection`.

- [ ] **Step 1: Write the failing tests**

Create `src/admin/pages/SectionCardsPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { ToastProvider, ToastRegion } from '../components/Toast'
import { SectionCardsPage } from './SectionCardsPage'
import { adminApi } from '../../admin/api'

vi.mock('../../admin/api', () => ({
  adminApi: {
    saveSection: vi.fn().mockResolvedValue(undefined),
    saveSeo: vi.fn().mockResolvedValue(undefined),
    resetContent: vi.fn().mockResolvedValue(undefined),
    createCard: vi.fn().mockResolvedValue(undefined),
    updateCard: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    reorderCards: vi.fn().mockResolvedValue(undefined),
    uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn/new-icon.png', path: 'cards/new-icon.png' }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
  },
}))

beforeEach(() => localStorage.clear())

const wrapHero = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <SectionCardsPage sectionKey="hero" title="Hero" hint="Hero cards." />
          <ToastRegion />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

const wrapHowWork = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <SectionCardsPage sectionKey="howWork" title="How it works" hint="Step cards." />
          <ToastRegion />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('SectionCardsPage', () => {
  it('lists Hero\'s 4 cards plus a Launch row, nothing selected initially', () => {
    wrapHero()
    expect(screen.getByText(/1 —/)).toBeInTheDocument()
    expect(screen.getByText(/2 —/)).toBeInTheDocument()
    expect(screen.getByText(/3 —/)).toBeInTheDocument()
    expect(screen.getByText(/4 —/)).toBeInTheDocument()
    expect(screen.getByText(/^Launch —/)).toBeInTheDocument()
    expect(screen.getByText(/no card selected/i)).toBeInTheDocument()
  })

  it('selecting a card shows its editor fields, no Sub field for Hero', async () => {
    const user = userEvent.setup()
    wrapHero()
    await user.click(screen.getByText(/1 —/))
    expect(screen.getByLabelText(/^card title$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^card text$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^sub$/i)).not.toBeInTheDocument()
  })

  it('shows a Sub field when editing a HowWork card', async () => {
    const user = userEvent.setup()
    wrapHowWork()
    await user.click(screen.getByText(/1 —/))
    expect(screen.getByLabelText(/^sub$/i)).toBeInTheDocument()
  })

  it('editing a card\'s text and saving sends only the cards key, with only that card changed', async () => {
    vi.mocked(adminApi.saveSection).mockClear()
    const user = userEvent.setup()
    wrapHero()
    await user.click(screen.getByText(/1 —/))
    const text = screen.getByLabelText(/^card text$/i)
    await user.clear(text)
    await user.type(text, 'Edited card text')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(adminApi.saveSection).toHaveBeenCalledTimes(1)
    expect(adminApi.saveSection).toHaveBeenCalledWith(
      'hero',
      expect.objectContaining({ cards: expect.any(Array) }),
    )
    const patch = vi.mocked(adminApi.saveSection).mock.calls[0][1] as {
      cards: { text: { en: string } }[]
    }
    expect(patch.cards).toHaveLength(4)
    expect(patch.cards[0].text.en).toBe('Edited card text')
    expect(patch.cards[1].text.en).not.toBe('Edited card text')
    expect(Object.keys(patch)).toEqual(['cards'])
    expect(await screen.findByText(/^saved$/i)).toBeInTheDocument()
  })

  it('editing and saving the Launch row sends only the launch key', async () => {
    vi.mocked(adminApi.saveSection).mockClear()
    const user = userEvent.setup()
    wrapHero()
    await user.click(screen.getByText(/^Launch —/))
    const text = screen.getByLabelText(/^card text$/i)
    await user.clear(text)
    await user.type(text, 'Edited launch text')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(adminApi.saveSection).toHaveBeenCalledTimes(1)
    const patch = vi.mocked(adminApi.saveSection).mock.calls[0][1] as {
      launch: { text: { en: string } }
    }
    expect(patch.launch.text.en).toBe('Edited launch text')
    expect(Object.keys(patch)).toEqual(['launch'])
  })

  it('Cancel returns to the empty state without saving', async () => {
    const user = userEvent.setup()
    wrapHero()
    await user.click(screen.getByText(/1 —/))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.getByText(/no card selected/i)).toBeInTheDocument()
  })

  it('shows a "Save failed" toast when the api rejects', async () => {
    vi.mocked(adminApi.saveSection).mockRejectedValueOnce(new Error('x'))
    const user = userEvent.setup()
    wrapHero()
    await user.click(screen.getByText(/1 —/))
    const text = screen.getByLabelText(/^card text$/i)
    await user.type(text, ' more')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText(/save failed/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/admin/pages/SectionCardsPage.test.tsx`
Expected: FAIL — `./SectionCardsPage` module doesn't exist yet.

- [ ] **Step 3: Implement `SectionCardsPage`**

Create `src/admin/pages/SectionCardsPage.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/admin/pages/SectionCardsPage.test.tsx`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run` and `npx tsc -b`
Expected: All tests pass, 0 TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/admin/pages/SectionCardsPage.tsx src/admin/pages/SectionCardsPage.test.tsx
git commit -m "feat(admin): SectionCardsPage — single-card editor for Hero/HowWork/About"
```

---

### Task 3: `CardsPage` — the 5-way type switcher

**Files:**
- Create: `src/admin/pages/CardsPage.tsx`
- Test: `src/admin/pages/CardsPage.test.tsx`

**Interfaces:**
- Consumes: `ProjectsPage` (`src/admin/pages/ProjectsPage.tsx`, unchanged), `ServicesPage` (`src/admin/pages/ServicesPage.tsx`, unchanged), `SectionCardsPage` (Task 2).
- Produces: `CardsPage()` — a full page component with no props, consumed by Task 4's route wiring.

- [ ] **Step 1: Write the failing tests**

Create `src/admin/pages/CardsPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { ToastProvider, ToastRegion } from '../components/Toast'
import { CardsPage } from './CardsPage'

vi.mock('../../admin/api', () => ({
  adminApi: {
    saveSection: vi.fn().mockResolvedValue(undefined),
    saveSeo: vi.fn().mockResolvedValue(undefined),
    resetContent: vi.fn().mockResolvedValue(undefined),
    createCard: vi.fn().mockResolvedValue(undefined),
    updateCard: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    reorderCards: vi.fn().mockResolvedValue(undefined),
    uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn/new-icon.png', path: 'cards/new-icon.png' }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
  },
}))

beforeEach(() => localStorage.clear())

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <CardsPage />
          <ToastRegion />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('CardsPage', () => {
  it('defaults to the Hero tab', () => {
    wrap()
    expect(screen.getByRole('tab', { name: 'Hero' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /^hero$/i })).toBeInTheDocument()
  })

  it('switches to each of the other 4 tabs and renders that type\'s page', async () => {
    const user = userEvent.setup()
    wrap()

    await user.click(screen.getByRole('tab', { name: 'How it works' }))
    expect(screen.getByRole('heading', { name: /^how it works$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'About' }))
    expect(screen.getByRole('heading', { name: /^about$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Projects' }))
    expect(screen.getByRole('heading', { name: /^projects$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Services' }))
    expect(screen.getByRole('heading', { name: /^services$/i })).toBeInTheDocument()
  })

  it('only one type tab is aria-selected at a time', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: 'Projects' }))
    expect(screen.getByRole('tab', { name: 'Projects' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Hero' })).toHaveAttribute('aria-selected', 'false')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/admin/pages/CardsPage.test.tsx`
Expected: FAIL — `./CardsPage` module doesn't exist yet.

- [ ] **Step 3: Implement `CardsPage`**

Create `src/admin/pages/CardsPage.tsx`:

```tsx
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
```

Only the active type is mounted at a time (plain conditional rendering, not CSS-hidden) — switching tabs unmounts the previous type's component (its `useAdminTitle` cleanup restores the prior document title) and mounts the new one (its own `useAdminTitle` call sets the new title), so the document title always reflects the active card type with no extra title logic needed in `CardsPage` itself.

`CardsPage`'s own wrapper uses `.admin-page admin-page--wide` for the same `max-width: 960px` cap `CardScreen`'s own `<section>` also carries — both being 960px, nesting them is harmless (no visual difference from a single cap).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/admin/pages/CardsPage.test.tsx`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run` and `npx tsc -b`
Expected: All tests pass, 0 TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/admin/pages/CardsPage.tsx src/admin/pages/CardsPage.test.tsx
git commit -m "feat(admin): CardsPage — unified 5-way card type switcher"
```

---

### Task 4: Route and navigation wiring

**Files:**
- Modify: `src/admin/AdminLayout.tsx`
- Modify: `src/admin/AdminApp.tsx`
- Modify: `src/admin/pages/DashboardPage.tsx`
- Modify: `src/admin/AdminApp.test.tsx`

**Interfaces:**
- Consumes: `CardsPage` (Task 3).

- [ ] **Step 1: Write the failing test additions**

In `src/admin/AdminApp.test.tsx`, extend the existing `it('shows the admin layout (sidebar nav) when authed', ...)` test and add a new one:

```tsx
  it('shows the admin layout (sidebar nav) when authed', async () => {
    vi.stubGlobal('fetch', fetchAuthed(true))
    wrap('/admin')
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: /admin/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /content/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /requests/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^cards$/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^projects$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^services$/i })).not.toBeInTheDocument()
  })

  it('renders CardsPage at /admin/cards', async () => {
    vi.stubGlobal('fetch', fetchAuthed(true))
    wrap('/admin/cards')
    expect(await screen.findByRole('tab', { name: 'Hero' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/admin/AdminApp.test.tsx`
Expected: FAIL — the nav still has "Projects"/"Services" links and no "Cards" link; `/admin/cards` doesn't route anywhere yet (falls through to the `path="*"` redirect to `/admin`, so no "Hero" tab appears).

- [ ] **Step 3: Update `AdminLayout.tsx`'s nav**

In `src/admin/AdminLayout.tsx`, replace the `NAV` array:

```tsx
const NAV: { to: string; label: string }[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/cards', label: 'Cards' },
  { to: '/admin/seo', label: 'SEO' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/settings', label: 'Settings' },
]
```

- [ ] **Step 4: Update `AdminApp.tsx`'s routes**

In `src/admin/AdminApp.tsx`, replace:

```tsx
import { ProjectsPage } from './pages/ProjectsPage'
import { ServicesPage } from './pages/ServicesPage'
```

with:

```tsx
import { CardsPage } from './pages/CardsPage'
```

and replace:

```tsx
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="services" element={<ServicesPage />} />
```

with:

```tsx
            <Route path="cards" element={<CardsPage />} />
```

- [ ] **Step 5: Update `DashboardPage.tsx`'s quick link**

In `src/admin/pages/DashboardPage.tsx`, replace:

```tsx
        <Link to="/admin/projects">Projects</Link> ·{' '}
```

with:

```tsx
        <Link to="/admin/cards">Cards</Link> ·{' '}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/admin/AdminApp.test.tsx`
Expected: PASS (both the extended and the new test).

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npx vitest run` and `npx tsc -b`
Expected: All tests pass, 0 TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/admin/AdminLayout.tsx src/admin/AdminApp.tsx src/admin/pages/DashboardPage.tsx src/admin/AdminApp.test.tsx
git commit -m "feat(admin): route /admin/cards to CardsPage, replace Projects/Services nav entries"
```

---

### Task 5: Remove the old card editors from `ContentPage`

**Files:**
- Modify: `src/admin/pages/ContentPage.tsx`
- Modify: `src/admin/pages/ContentPage.test.tsx`
- Modify: `src/admin/admin.css`

**Interfaces:**
- Consumes: none new — this task only removes code now superseded by Task 2's `SectionCardsPage`.

Hero/HowWork/About's card editing now lives at `/admin/cards` (Task 3/4). `ContentPage.tsx` must stop rendering the `CardEditor` component and the `cards`/`launch` blocks inside `SectionEditor` — every section (including hero/howWork/about) keeps its Eyebrow/Title/Body/Button-label text fields exactly as today; only the nested card blocks are removed.

- [ ] **Step 1: Remove the 3 now-superseded tests from `ContentPage.test.tsx`**

In `src/admin/pages/ContentPage.test.tsx`, delete these three `it(...)` blocks in full (their behavior is now covered by `SectionCardsPage.test.tsx` from Task 2):

- `it('renders a card editor for each of Hero\'s 4 cards plus its Launch card', ...)`
- `it('renders a Sub field only for HowWork\'s cards, not Hero\'s', ...)`
- `it("editing a card's text and saving sends only the cards key to the api", ...)`

Also remove the now-unused `uploadImage`/`deleteImage` entries from the `vi.mock('../../admin/api', ...)` block at the top of the file (they were only needed by the deleted card-icon-upload test) — the mock object becomes:

```tsx
vi.mock('../../admin/api', () => ({
  adminApi: {
    saveSection: vi.fn().mockResolvedValue(undefined),
    saveSeo: vi.fn().mockResolvedValue(undefined),
    resetContent: vi.fn().mockResolvedValue(undefined),
    createCard: vi.fn().mockResolvedValue(undefined),
    updateCard: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    reorderCards: vi.fn().mockResolvedValue(undefined),
  },
}))
```

Every remaining test in this file (`'renders all six section blocks'`, `'only Hero and CTA expose a Button label field'`, `'editing a title and saving updates the store'`, `'shows a "Save failed" toast when the api rejects'`, `'footer only shows a Tagline field, no Eyebrow/Title/Button label'`) is about section TEXT, not cards, and is unaffected — leave them exactly as they are.

- [ ] **Step 2: Run the trimmed test file to verify it still fails only for the expected reason (implementation not yet changed)**

Run: `npx vitest run src/admin/pages/ContentPage.test.tsx`
Expected: PASS — the remaining tests never depended on the card blocks being removed, so this file already passes against the CURRENT (not-yet-changed) `ContentPage.tsx`. This step exists to confirm the test trim itself introduced no accidental breakage before touching the component.

- [ ] **Step 3: Remove `CardEditor` and the `cards`/`launch` blocks from `ContentPage.tsx`**

Replace `src/admin/pages/ContentPage.tsx` in full:

```tsx
import { useMemo, useState } from 'react'
import type { L, SectionKey, SectionText } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { LocalizedField } from '../components/LocalizedField'
import { SaveBar } from '../components/SaveBar'
import { useToast } from '../components/Toast'
import { useAdminTitle } from '../useAdminTitle'

type Draft = Pick<SectionText, 'eyebrow' | 'title' | 'body'> & {
  ctaLabel?: L
}

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
```

Note `SectionCard` is no longer imported (the `CardEditor` component and every `cards`/`launch` reference are gone); `Draft` drops its `cards`/`launch` fields; `eqCard`/`eqCards` are deleted entirely (their only caller was the removed code).

- [ ] **Step 4: Run the test file to verify it passes against the new implementation**

Run: `npx vitest run src/admin/pages/ContentPage.test.tsx`
Expected: PASS (all 5 remaining tests).

- [ ] **Step 5: Remove the now-dead CSS rules**

First confirm nothing else references them:

Run: `grep -rn "admin-cards-block\|admin-card-editor\|admin-disclosure--nested" src/`
Expected: no matches outside `src/admin/admin.css` itself (the only consumer, `ContentPage.tsx`'s `CardEditor`, was just deleted in Step 3).

In `src/admin/admin.css`, remove these three rule blocks (added by the prior "admin-hero-howwork-about-cards" project, now unused):

```css
.admin-cards-block { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border, #e8e8ec); }
.admin-cards-block h3 { font-size: 0.95rem; margin: 0 0 1rem; }
.admin-card-editor { display: flex; flex-direction: column; gap: 0.75rem; }

/* nested card accordion — same disclosure pattern, one size down */
.admin-disclosure--nested {
  margin: 0 0 0.6rem; border-color: var(--border, #e8e8ec); background: var(--surface-2, #fbfbfc);
}
.admin-disclosure--nested .admin-disclosure__summary { padding: 0.55rem 0.85rem; font-size: 0.85rem; font-weight: 600; }
.admin-disclosure--nested .admin-disclosure__body { padding: 0 0.85rem 0.85rem; border-top-color: var(--border, #e8e8ec); }
.admin-disclosure--nested:last-child { margin-bottom: 0; }
```

- [ ] **Step 6: Run the full test suite, typecheck, lint, and build**

Run: `npx vitest run`, `npx tsc -b`, `npx tsc -p tsconfig.api.json --noEmit`, `npx oxlint`, `npm run build`
Expected: all green — this is the last task, so this is the whole branch's final gate before review.

- [ ] **Step 7: Commit**

```bash
git add src/admin/pages/ContentPage.tsx src/admin/pages/ContentPage.test.tsx src/admin/admin.css
git commit -m "refactor(admin): remove card editors from ContentPage, now at /admin/cards"
```

---

## Spec coverage check (self-review)

- §4 Navigation → Task 4 (`AdminLayout` NAV, `AdminApp` routes).
- §5 Page structure → Task 2 (`SectionCardsPage`) + Task 3 (`CardsPage`'s 5-way switcher, Projects/Services rendered unchanged as tab content).
- §6 Data flow for fixed-count cards → Task 2's `save()` (patches one card/launch back into the full array/object via the existing `updateSection`).
- §7 Component reuse table → Task 1 (`CardScreen` widened, `FixedCardList` new, `CardList` untouched), Task 2/3 (new pages), Task 5 (`ContentPage` cards/launch removed, text fields untouched).
- §8 Testing → covered per-task (new component tests in Tasks 1-3, nav/route test in Task 4, `ContentPage.test.tsx` trim in Task 5).
- §3 Non-goals → respected throughout: no Telegram bot file touched by any task; no add/remove/reorder introduced for Hero/HowWork/About (`FixedCardList` has no add/move controls at all); no backend/data-model file touched (`api/_lib/`, `supabase/` do not appear in any task); no public-site file touched; `Icon.tsx` not referenced; `ProjectsPage.tsx`/`ServicesPage.tsx` internals are never edited, only their routing/mounting (confirmed by Task 1 Step 6's explicit regression check and the Global Constraint that their test files must pass unmodified).

One deliberate, minor departure from the spec's literal wording, resolved during planning: §7's table says `CardScreen.tsx` is "Unchanged." Task 1 widens its prop types (`tabs`/`activeList`/`onActiveListChange` become optional and generic instead of required/hardcoded to `CardListKey`) so `SectionCardsPage` can reuse it without sub-tabs — this is a type-level, backward-compatible change only: `ProjectsPage.tsx`/`ServicesPage.tsx` pass the same props they always did and their behavior/output is unaffected (verified by Task 1 Step 6 running their existing, unmodified test suites against the widened component). The alternative (duplicating `CardScreen`'s ~10 lines of wrapper JSX inside `SectionCardsPage` to leave the file byte-for-byte untouched) was considered and rejected as worse — it would create two copies of the same layout to keep in sync for no benefit.

No placeholder text, TBD, or "implement similarly" phrasing appears in any task above. Type/signature names are consistent across tasks: `SectionCardsPage`'s props (Task 2) are exactly what `CardsPage` (Task 3) passes; `FixedCardList`'s `items`/`selectedId`/`onSelect` (Task 1) match exactly what `SectionCardsPage` (Task 2) supplies; `CardScreen`'s widened generic signature (Task 1) is exercised by `SectionCardsPage` calling it with no `tabs` argument (Task 2) and remains exercised with `tabs` supplied by the untouched `ProjectsPage`/`ServicesPage`.
