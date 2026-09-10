import { Link } from 'react-router-dom'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { useRequests } from '../hooks/useRequests'
import { StatusBadge } from '../components/StatusBadge'
import { useAdminTitle } from '../useAdminTitle'

export function DashboardPage() {
  useAdminTitle('Dashboard')
  const { data } = useSiteContentRaw()
  const { requests } = useRequests()
  const list = requests ?? []
  const newCount = list.filter((r) => r.status === 'new').length
  const recent = [...list]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5)

  return (
    <section className="admin-page admin-page--wide">
      <h1>Dashboard</h1>
      <div className="admin-stats">
        <div className="admin-stat">
          <div className="admin-stat__n">{data.projectsHome.length}</div>
          <div className="admin-stat__label">Projects — home</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__n">{data.projectsPage.length}</div>
          <div className="admin-stat__label">Projects — page</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__n">{data.servicesHome.length}</div>
          <div className="admin-stat__label">Services — home</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__n">{data.servicesPage.length}</div>
          <div className="admin-stat__label">Services — page</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__n">{newCount}</div>
          <div className="admin-stat__label">New requests</div>
        </div>
      </div>

      <h2 style={{ fontSize: '1rem' }}>Recent requests</h2>
      {recent.length === 0 ? (
        <p className="admin-field__hint">No requests yet.</p>
      ) : (
        <ul className="admin-recent">
          {recent.map((r) => (
            <li key={r.id}>
              <Link to="/admin/requests">{r.name}</Link>
              {' — '}
              <StatusBadge status={r.status} />
              {' · '}
              {new Date(r.createdAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/admin/content">Edit texts</Link> ·{' '}
        <Link to="/admin/projects">Projects</Link> ·{' '}
        <Link to="/admin/seo">SEO</Link>
      </p>
    </section>
  )
}
