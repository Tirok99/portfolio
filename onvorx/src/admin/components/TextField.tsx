import { useId } from 'react'
import { CharCounter } from './CharCounter'

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  hint?: string
  maxLength?: number
  recommended?: number
  type?: string
  invalid?: boolean
}

export function TextField({
  label,
  value,
  onChange,
  multiline,
  hint,
  maxLength,
  recommended,
  type = 'text',
  invalid,
}: Props) {
  const id = useId()
  return (
    <div className="admin-field">
      <label className="admin-field__label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="admin-textarea"
          value={value}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="admin-input"
          type={type}
          value={value}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {(hint || recommended != null) && (
        <span className="admin-field__hint">
          {hint}
          {hint && recommended != null ? ' · ' : ''}
          {recommended != null && <CharCounter value={value.length} recommended={recommended} />}
        </span>
      )}
    </div>
  )
}
