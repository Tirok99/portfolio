import type { ImageRef, L, SectionCard } from '../types'
import { ImageUpload } from './ImageUpload'
import { LocalizedField } from './LocalizedField'

const emptyL = (): L => ({ en: '', uk: '' })

/** Feature items of a /services block: icon, title, text; add, remove, reorder. */
export function FeatureListEditor({
  label,
  items,
  onChange,
  newItemIcon,
}: {
  label: string
  items: SectionCard[]
  onChange: (next: SectionCard[]) => void
  /** icon a new item starts with — the block's first built-in feature icon */
  newItemIcon: ImageRef
}) {
  const set = (i: number, patch: Partial<SectionCard>) =>
    onChange(items.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const move = (i: number, j: number) => {
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <fieldset className="admin-group">
      <legend className="admin-field__label">{label}</legend>
      {items.length === 0 && <p className="admin-field__hint">No items yet.</p>}
      {items.map((item, i) => {
        const name = `${label} item ${i + 1}`
        return (
          <div key={i} className="admin-group__item">
            <div className="admin-group__head">
              <span>Item {i + 1}</span>
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
                className="admin-btn admin-btn--danger"
                aria-label={`Remove: ${name}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
            <ImageUpload
              label="Icon"
              folder="cards"
              variant="icon"
              value={item.icon}
              onChange={async (icon) => set(i, { icon })}
              onClear={async () => set(i, { icon: { kind: 'asset', src: '' } })}
              // draft-only until Save — the old Storage object must outlive a discard
              deferDelete={true}
            />
            <LocalizedField label="Title" value={item.title} onChange={(title) => set(i, { title })} />
            <LocalizedField label="Text" value={item.text} multiline onChange={(text) => set(i, { text })} />
          </div>
        )
      })}
      <button
        type="button"
        className="admin-btn"
        aria-label={`Add item to ${label}`}
        onClick={() => onChange([...items, { icon: { ...newItemIcon }, title: emptyL(), text: emptyL() }])}
      >
        + Add item
      </button>
    </fieldset>
  )
}
