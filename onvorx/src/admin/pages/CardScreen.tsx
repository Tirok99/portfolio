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
