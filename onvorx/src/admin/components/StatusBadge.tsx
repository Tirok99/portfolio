import type { RequestStatus } from '../types'

const LABEL: Record<RequestStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  done: 'Done',
  archived: 'Archived',
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`admin-badge admin-badge--${status}`}>{LABEL[status]}</span>
}
