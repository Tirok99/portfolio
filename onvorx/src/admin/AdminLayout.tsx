import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { ToastProvider, ToastRegion } from './components/Toast'
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
  const [menuOpen, setMenuOpen] = useState(false)

  const onLogout = useCallback(async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }, [logout, navigate])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <ToastProvider>
      <div className="admin" data-theme="light">
        <header className="admin__topbar">
          <button
            type="button"
            className="admin__burger"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="admin-sidebar"
            onClick={() => setMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="admin__topbar-brand">ONVORX Admin</div>
        </header>
        {menuOpen && (
          <div className="admin__scrim" onClick={() => setMenuOpen(false)} />
        )}
        <aside
          id="admin-sidebar"
          className={`admin__sidebar${menuOpen ? ' is-open' : ''}`}
        >
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
                onClick={() => setMenuOpen(false)}
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
        <ToastRegion />
      </div>
    </ToastProvider>
  )
}
