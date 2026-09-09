import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { useAuth } from '../auth/useAuth'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { useAdminTitle } from '../useAdminTitle'

export function SettingsPage() {
  useAdminTitle('Settings')
  const { actions } = useSiteContentRaw()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  const reset = useCallback(async () => {
    const ok = await confirm({
      title: 'Reset all content?',
      message:
        'This discards every edit you have made and every estimate submission, and restores the original site content. This cannot be undone.',
      confirmLabel: 'Reset everything',
      danger: true,
    })
    if (!ok) return
    actions.resetAll()
    toast('Content reset to defaults')
  }, [confirm, actions, toast])

  const onLogout = useCallback(async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }, [logout, navigate])

  return (
    <section className="admin-page">
      <h1>Settings</h1>

      <fieldset className="admin-fieldset">
        <legend>
          <h2>Reset content</h2>
        </legend>
        <p className="admin-field__hint">
          Discards every edit you have made and every estimate submission, then
          restores the original site content. This cannot be undone.
        </p>
        <button
          type="button"
          className="admin-btn admin-btn--danger"
          onClick={reset}
        >
          Reset all content
        </button>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>
          <h2>Session</h2>
        </legend>
        <button type="button" className="admin-btn" onClick={onLogout}>
          Log out
        </button>
      </fieldset>
      {dialog}
    </section>
  )
}
