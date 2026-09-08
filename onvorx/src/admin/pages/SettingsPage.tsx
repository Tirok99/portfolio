import { useAdminTitle } from '../useAdminTitle'

export function SettingsPage() {
  useAdminTitle('Settings')
  return (
    <section className="admin-page">
      <h1>Settings</h1>
    </section>
  )
}
