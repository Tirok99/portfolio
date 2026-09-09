import { useState } from 'react'
import type { L, Locale } from '../types'
import { TextField } from './TextField'

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'UA' },
]

export function LocalizedField({
  label,
  value,
  onChange,
  multiline,
  hint,
  recommended,
}: {
  label: string
  value: L
  onChange: (next: L) => void
  multiline?: boolean
  hint?: string
  recommended?: number
}) {
  const [active, setActive] = useState<Locale>('en')
  return (
    <div>
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
      <TextField
        label={label}
        value={value[active]}
        onChange={(v) => onChange({ ...value, [active]: v })}
        multiline={multiline}
        hint={hint}
        recommended={recommended}
      />
    </div>
  )
}
