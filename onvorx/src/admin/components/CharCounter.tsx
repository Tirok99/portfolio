export function CharCounter({ value, recommended }: { value: number; recommended: number }) {
  const over = value > recommended
  return (
    <span className={`admin-charcount ${over ? 'is-over' : 'is-ok'}`}>
      {value} / {recommended}
    </span>
  )
}
