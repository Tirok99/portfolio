import { useAdminTitle } from '../useAdminTitle'

export function ContentPage() {
  useAdminTitle('Content')
  return (
    <section className="admin-page">
      <h1>Content</h1>
    </section>
  )
}
