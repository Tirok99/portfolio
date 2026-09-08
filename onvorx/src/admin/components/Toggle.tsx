import { useId } from 'react'

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  const id = useId()
  return (
    <div className="admin-field">
      <label
        className="admin-field__label"
        htmlFor={id}
        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
      >
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <span className="admin-field__hint">{hint}</span>}
    </div>
  )
}
