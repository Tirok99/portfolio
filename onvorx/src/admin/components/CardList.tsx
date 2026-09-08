interface Item {
  id: string
  title: string
  published: boolean
}

export function CardList({
  items,
  selectedId,
  onSelect,
  onMove,
  onAdd,
  addLabel,
}: {
  items: Item[]
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (id: string, dir: 'up' | 'down') => void
  onAdd: () => void
  addLabel: string
}) {
  return (
    <div>
      <div className="admin-cardlist">
        {items.length === 0 && (
          <p className="admin-field__hint">No items yet.</p>
        )}
        {items.map((it, i) => (
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
            <span
              className={`admin-cardrow__dot${it.published ? ' is-published' : ''}`}
              aria-hidden="true"
            />
            <span className="admin-cardrow__title">{it.title || 'Untitled'}</span>
            <button
              type="button"
              className="admin-cardrow__move"
              aria-label={`Move up: ${it.title || 'item'}`}
              disabled={i === 0}
              onClick={(e) => {
                e.stopPropagation()
                onMove(it.id, 'up')
              }}
            >
              ▲
            </button>
            <button
              type="button"
              className="admin-cardrow__move"
              aria-label={`Move down: ${it.title || 'item'}`}
              disabled={i === items.length - 1}
              onClick={(e) => {
                e.stopPropagation()
                onMove(it.id, 'down')
              }}
            >
              ▼
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="admin-btn"
        style={{ marginTop: '0.6rem' }}
        onClick={onAdd}
      >
        + {addLabel}
      </button>
    </div>
  )
}
