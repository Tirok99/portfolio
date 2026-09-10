import { useMemo, useState } from 'react'
import type { EstimateRequest, RequestStatus } from '../types'
import { useRequests } from '../hooks/useRequests'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { useAdminTitle } from '../useAdminTitle'

const STATUSES: RequestStatus[] = ['new', 'in_progress', 'done', 'archived']
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

interface DetailProps {
  req: EstimateRequest
  setStatus: (id: string, status: RequestStatus) => Promise<void>
  setNote: (id: string, note: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

function Detail({ req, setStatus, setNote, remove }: DetailProps) {
  const { confirm, dialog } = useConfirm()
  const toast = useToast()
  const [note, setNoteText] = useState(req.note ?? '')

  const del = async () => {
    const ok = await confirm({
      title: 'Delete this request?',
      message: 'It will be permanently removed.',
      confirmLabel: 'Delete request',
      danger: true,
    })
    if (ok) {
      remove(req.id)
        .then(() => toast('Request deleted'))
        .catch(() => toast('Save failed', 'error'))
    }
  }

  return (
    <section className="admin-detail" aria-label="Request detail">
      <h2>{req.name}</h2>
      <dl className="admin-detail__grid">
        <dt>Email</dt><dd><a href={`mailto:${req.email}`}>{req.email}</a></dd>
        <dt>Company</dt><dd>{req.company || '—'}</dd>
        <dt>Budget</dt><dd>{req.budget ?? '—'}</dd>
        <dt>Interested in</dt><dd>{req.interestedIn.join(', ') || '—'}</dd>
        <dt>Language</dt><dd>{req.locale.toUpperCase()}</dd>
        <dt>From page</dt><dd>{req.sourcePage ?? '—'}</dd>
        <dt>Received</dt><dd>{fmtDate(req.createdAt)}</dd>
      </dl>
      <p className="admin-detail__message">{req.message}</p>

      <label className="admin-field">
        <span className="admin-field__label">Status</span>
        <select
          className="admin-input"
          value={req.status}
          onChange={(e) =>
            setStatus(req.id, e.target.value as RequestStatus).catch(() =>
              toast('Save failed', 'error'),
            )
          }
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </label>

      <label className="admin-field">
        <span className="admin-field__label">Internal note</span>
        <textarea
          className="admin-textarea"
          value={note}
          onChange={(e) => setNoteText(e.target.value)}
        />
      </label>
      <div className="admin-detail__actions">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => {
            setNote(req.id, note)
              .then(() => toast('Note saved'))
              .catch(() => toast('Save failed', 'error'))
          }}
        >
          Save note
        </button>
        <button type="button" className="admin-btn admin-btn--danger" onClick={del}>
          Delete
        </button>
      </div>
      {dialog}
    </section>
  )
}

export function RequestsPage() {
  useAdminTitle('Requests')
  const { requests, error, setStatus, setNote, remove } = useRequests()
  const [status, setStatusFilter] = useState<'all' | RequestStatus>('all')
  const [lang, setLang] = useState<'all' | 'en' | 'uk'>('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    if (!requests) return []
    const needle = q.trim().toLowerCase()
    return [...requests]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .filter((r) => (status === 'all' ? true : r.status === status))
      .filter((r) => (lang === 'all' ? true : r.locale === lang))
      .filter((r) =>
        !needle
          ? true
          : `${r.name} ${r.email} ${r.message}`.toLowerCase().includes(needle),
      )
  }, [requests, status, lang, q])

  const open = openId && requests ? requests.find((r) => r.id === openId) ?? null : null

  return (
    <section className="admin-page admin-page--wide">
      <h1>Requests</h1>
      <p className="admin-page__hint">Incoming “Request an Estimate” submissions.</p>

      <div className="admin-filters">
        <label>
          Status
          <select className="admin-input" value={status} onChange={(e) => setStatusFilter(e.target.value as never)}>
            <option value="all">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </label>
        <label>
          Language
          <select className="admin-input" value={lang} onChange={(e) => setLang(e.target.value as never)}>
            <option value="all">All</option>
            <option value="en">EN</option>
            <option value="uk">UA</option>
          </select>
        </label>
        <label>
          Search
          <input className="admin-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="name, email, text" />
        </label>
      </div>

      {error ? (
        <EmptyState title="Couldn’t load requests" hint="Try reloading the page." />
      ) : requests === null ? (
        <EmptyState title="Loading…" hint="Fetching requests." />
      ) : rows.length === 0 ? (
        <EmptyState title="No requests match" hint="Try a different filter." />
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>Date</th><th>Name</th><th>Email</th><th>Budget</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === openId ? 'is-selected' : undefined}>
                <td>{fmtDate(r.createdAt)}</td>
                <td>
                  <button
                    type="button"
                    className="admin-rowbtn"
                    aria-current={r.id === openId ? 'true' : undefined}
                    onClick={() => setOpenId(r.id)}
                  >
                    {r.name}
                  </button>
                </td>
                <td>{r.email}</td>
                <td>{r.budget ?? '—'}</td>
                <td><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && (
        <Detail
          key={open.id}
          req={open}
          setStatus={setStatus}
          setNote={setNote}
          remove={remove}
        />
      )}
    </section>
  )
}
