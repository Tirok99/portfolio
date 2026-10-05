import type { L } from '../types'

/** An editable list of short EN/UA strings: add, remove, move up / down. */
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
  const set = (i: number, patch: Partial<L>) =>
    onChange(items.map((item, j) => (j === i ? { ...item, ...patch } : item)))
  const move = (i: number, j: number) => {
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <fieldset className="admin-field admin-llist">
      <legend className="admin-field__label">{label}</legend>
      {items.length === 0 && <p className="admin-field__hint">No items yet.</p>}
      {items.map((item, i) => {
        const name = `${label} ${i + 1}`
        return (
          <div key={i} className="admin-llist__row">
            <input
              className="admin-input"
              aria-label={`${name} EN`}
              placeholder="EN"
              value={item.en}
              onChange={(e) => set(i, { en: e.target.value })}
            />
            <input
              className="admin-input"
              aria-label={`${name} UA`}
              placeholder="UA"
              value={item.uk}
              onChange={(e) => set(i, { uk: e.target.value })}
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
