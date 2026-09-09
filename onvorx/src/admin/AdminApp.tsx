import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/useAuth'
import { RequireAuth } from './auth/RequireAuth'
import { LoginPage } from './auth/LoginPage'
import { AdminLayout } from './AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ContentPage } from './pages/ContentPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ServicesPage } from './pages/ServicesPage'
import { SeoPage } from './pages/SeoPage'
import { RequestsPage } from './pages/RequestsPage'
import { SettingsPage } from './pages/SettingsPage'
import './admin.css'

export default function AdminApp() {
  return (
    <div className="admin-root" data-theme="light">
      <AuthProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="seo" element={<SeoPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </div>
  )
}
