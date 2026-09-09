import { useCallback, useRef, useState, type ReactNode } from 'react'

interface ConfirmOpts {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((o: ConfirmOpts) => {
    setOpts(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const finish = useCallback((v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpts(null)
  }, [])

  const dialog: ReactNode = opts ? (
    <div className="admin-confirm__overlay" onClick={() => finish(false)}>
      <div
        className="admin-confirm"
        role="dialog"
        aria-modal="true"
        aria-label={opts.title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="admin-confirm__title">{opts.title}</h2>
        <p className="admin-confirm__msg">{opts.message}</p>
        <div className="admin-confirm__actions">
          <button type="button" className="admin-btn" onClick={() => finish(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={`admin-btn ${opts.danger ? 'admin-btn--danger' : 'admin-btn--primary'}`}
            onClick={() => finish(true)}
          >
            {opts.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, dialog }
}
