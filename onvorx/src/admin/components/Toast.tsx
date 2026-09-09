import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { newId } from '../lib/id'

type ToastType = 'ok' | 'error'
interface ToastItem { id: string; message: string; type: ToastType }

interface ToastCtx {
  toasts: ToastItem[]
  push: (message: string, type?: ToastType) => void
  dismiss: (id: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])
  const push = useCallback(
    (message: string, type: ToastType = 'ok') => {
      const id = newId('toast')
      setToasts((t) => [...t, { id, message, type }])
      window.setTimeout(() => dismiss(id), 3000)
    },
    [dismiss],
  )
  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useToast(): (message: string, type?: ToastType) => void {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx.push
}

export function ToastRegion() {
  const ctx = useContext(Ctx)
  if (!ctx) return null
  return (
    <div className="admin-toastregion" aria-live="polite" aria-atomic="false">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          className={`admin-toast${t.type === 'error' ? ' admin-toast--error' : ''}`}
          role={t.type === 'error' ? 'alert' : 'status'}
          onClick={() => ctx.dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
