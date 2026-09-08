import { useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import './LoginPage.css'

interface FromState { from?: string }

export function LoginPage() {
  const { status, login } = useAuth()
  const location = useLocation()
  const from = (location.state as FromState | null)?.from ?? '/admin'
  const fieldId = useId()
  const errId = `${fieldId}-err`

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (status === 'authed' || done) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const { ok } = await login(password)
      setBusy(false)
      if (ok) setDone(true)
      else setError('Incorrect password. Try again.')
    } catch {
      setBusy(false)
      setError("Couldn't reach the server. Try again.")
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={submit} noValidate>
        <h1 className="admin-login__title">ONVORX Admin</h1>
        <label className="admin-login__label" htmlFor={fieldId}>
          Password
          <input
            id={fieldId}
            className="admin-login__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errId : undefined}
            autoFocus
          />
        </label>
        {error && (
          <p id={errId} className="admin-login__error" role="alert">
            {error}
          </p>
        )}
        <button className="admin-login__submit" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
