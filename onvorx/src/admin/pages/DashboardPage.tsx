import { useAdminTitle } from '../useAdminTitle'

export function DashboardPage() {
  useAdminTitle('Dashboard')
  return (
    <section className="admin-page">
      <h1>Dashboard</h1>
    </section>
  )
}
