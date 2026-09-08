export function SaveBar({
  dirty,
  onSave,
  onDiscard,
  saving,
}: {
  dirty: boolean
  onSave: () => void
  onDiscard: () => void
  saving?: boolean
}) {
  return (
    <div className={`admin-savebar${dirty ? ' is-dirty' : ''}`}>
      <span className="admin-savebar__note">
        {dirty ? 'You have unsaved changes' : 'All changes saved'}
      </span>
      {dirty && (
        <button type="button" className="admin-btn" onClick={onDiscard} disabled={saving}>
          Discard
        </button>
      )}
      <button
        type="button"
        className="admin-btn admin-btn--primary"
        onClick={onSave}
        disabled={!dirty || saving}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
