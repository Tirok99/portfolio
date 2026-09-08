import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return (
      <div className="admin-auth-checking" role="status" aria-live="polite">
        Checking your session…
      </div>
    )
  }
  if (status === 'anon') {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    )
  }
  return <>{children}</>
}
