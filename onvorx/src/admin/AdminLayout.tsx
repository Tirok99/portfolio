import { useCallback } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import './admin.css'

const NAV: { to: string; label: string }[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/projects', label: 'Projects' },
  { to: '/admin/services', label: 'Services' },
  { to: '/admin/seo', label: 'SEO' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/settings', label: 'Settings' },
]

export function AdminLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = useCallback(async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }, [logout, navigate])

  return (
    <div className="admin" data-theme="light">
      <aside className="admin__sidebar">
        <div className="admin__brand">ONVORX Admin</div>
        <nav className="admin__nav" aria-label="Admin sections">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                `admin__nav-link${isActive ? ' is-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="admin__logout" onClick={onLogout}>
          Log out
        </button>
      </aside>
      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  )
}
