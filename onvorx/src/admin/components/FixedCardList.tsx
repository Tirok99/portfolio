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
