import { useState } from 'react'
import type { L, Locale } from '../types'

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'UA' },
]

/**
 * An editable list of short EN/UA strings: add, remove, move up / down.
 * One language is shown at a time, switched like `LocalizedField`.
 */
export function LocalizedListField({
  label,
  items,
  onChange,
  addLabel = 'Add item',
}: {
  label: string
  items: L[]
  onChange: (next: L[]) => void
  addLabel?: string
}) {
  const [active, setActive] = useState<Locale>('en')
  const lang = active === 'en' ? 'EN' : 'UA'
  const set = (i: number, text: string) =>
    onChange(items.map((item, j) => (j === i ? { ...item, [active]: text } : item)))
  const move = (i: number, j: number) => {
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <fieldset className="admin-field admin-llist">
      <legend className="admin-field__label">{label}</legend>
      <div className="admin-langtabs" role="group" aria-label={`${label} language`}>
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            className={`admin-langtab${active === l.code ? ' is-active' : ''}`}
            aria-pressed={active === l.code}
            onClick={() => setActive(l.code)}
          >
            {l.label}
          </button>
        ))}
      </div>
      {items.length === 0 && <p className="admin-field__hint">No items yet.</p>}
      {items.map((item, i) => {
        const name = `${label} ${i + 1}`
        return (
          <div key={i} className="admin-llist__row">
            <input
              className="admin-input"
              aria-label={`${name} ${lang}`}
              value={item[active]}
              onChange={(e) => set(i, e.target.value)}
            />
            <button
              type="button"
              className="admin-cardrow__move"
              aria-label={`Move up: ${name}`}
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="admin-cardrow__move"
              aria-label={`Move down: ${name}`}
              disabled={i === items.length - 1}
              onClick={() => move(i, i + 1)}
            >
              ▼
            </button>
            <button
              type="button"
              className="admin-cardrow__move"
              aria-label={`Remove: ${name}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        )
      })}
      <button
        type="button"
        className="admin-btn"
        aria-label={addLabel}
        onClick={() => onChange([...items, { en: '', uk: '' }])}
      >
        + {addLabel}
      </button>
    </fieldset>
  )
}
