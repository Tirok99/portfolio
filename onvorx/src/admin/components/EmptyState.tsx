import type { ReactNode } from 'react'

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="admin-empty">
      <p className="admin-empty__title">{title}</p>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  )
}
