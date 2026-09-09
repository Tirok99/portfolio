import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type Status = 'checking' | 'authed' | 'anon'

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'bad_password' | 'not_configured' | 'error' }

interface AuthValue {
  status: Status
  login: (password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  recheck: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

async function readAuthenticated(res: Response): Promise<boolean> {
  try {
    const data = (await res.json()) as { authenticated?: unknown }
    return data.authenticated === true
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')

  const recheck = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/session', { credentials: 'same-origin' })
      setStatus((await readAuthenticated(res)) ? 'authed' : 'anon')
    } catch {
      setStatus('anon')
    }
  }, [])

  useEffect(() => {
    void recheck()
  }, [recheck])

  const login = useCallback(async (password: string): Promise<LoginResult> => {
    let res: Response
    try {
      res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
    } catch {
      return { ok: false, reason: 'error' }
    }
    if (res.status === 200 && (await readAuthenticated(res))) {
      setStatus('authed')
      return { ok: true }
    }
    if (res.status === 401) return { ok: false, reason: 'bad_password' }
    if (res.status === 500) return { ok: false, reason: 'not_configured' }
    return { ok: false, reason: 'error' }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
    } finally {
      setStatus('anon')
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ status, login, logout, recheck }),
    [status, login, logout, recheck],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
