import { useEffect, useId, useRef, useState } from 'react'
import type { BudgetRange } from '../../admin/types'
import { useI18n } from '../../i18n/i18n'
import { useSiteContent } from '../../content/useSiteContent'
import { useEstimateForm } from './useEstimateForm'
import './EstimateForm.css'

const BUDGETS: { value: BudgetRange; label: string }[] = [
  { value: '<1k', label: 'Under $1,000' },
  { value: '1-3k', label: '$1,000 – $3,000' },
  { value: '3-10k', label: '$3,000 – $10,000' },
  { value: '10k+', label: 'Over $10,000' },
  { value: 'not_sure', label: 'Not sure yet' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EstimateForm() {
  const { isOpen, sourcePage, close } = useEstimateForm()
  const { lang } = useI18n()
  const { servicesHome } = useSiteContent()
  const services = servicesHome()

  const baseId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [budget, setBudget] = useState<BudgetRange | ''>('')
  const [interested, setInterested] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [refToken, setRefToken] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  // reset each time it opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setEmail('')
      setCompany('')
      setBudget('')
      setInterested([])
      setMessage('')
      setRefToken('')
      setErrors({})
      setSent(false)
      setSubmitting(false)
      setSubmitError(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    // remember the element that had focus when we opened, so we can restore
    // it on any close path (Esc, scrim, ×, auto-close after success)
    triggerRef.current = document.activeElement
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    dialogRef.current?.querySelector<HTMLElement>('input,textarea')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
      const trigger = triggerRef.current
      triggerRef.current = null
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [isOpen, close])

  useEffect(() => {
    if (!sent) return
    const id = window.setTimeout(close, 2000)
    return () => window.clearTimeout(id)
  }, [sent, close])

  if (!isOpen) return null

  const toggleInterest = (id: string) =>
    setInterested((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Name is required.'
    if (!email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(email.trim()))
      next.email = 'Enter a valid email address.'
    if (!message.trim()) next.message = 'A short message is required.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitError(false)
    setSubmitting(true)
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || undefined,
          budget: budget || undefined,
          interestedIn: interested,
          message: message.trim(),
          locale: lang,
          sourcePage,
          ref_token: refToken,
        }),
      })
      if (!res.ok) throw new Error('request_failed')
      setSent(true)
    } catch {
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
  }

  const titleId = `${baseId}-title`

  return (
    <div className="estimate-form__overlay" onClick={close}>
      <div
        ref={dialogRef}
        className="estimate-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="estimate-form__close"
          aria-label="Close"
          onClick={close}
        >
          ×
        </button>

        {sent ? (
          <div className="estimate-form__done">
            <h2 id={titleId}>Thank you</h2>
            <p>
              Your request has been received. ONVORX will review it and get back
              to you shortly.
            </p>
          </div>
        ) : (
          <form className="estimate-form__body" onSubmit={submit} noValidate>
            <h2 id={titleId}>Request a Project Estimate</h2>

            {/* Anti-spam honeypot: hidden from real users, bots fill it in.
                Named `ref_token` (not `company_url`) so Chrome org-autofill and
                password managers leave it alone for a real visitor. */}
            <input
              type="text"
              name="ref_token"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              data-lpignore="true"
              data-1p-ignore=""
              value={refToken}
              onChange={(e) => setRefToken(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            <label htmlFor={`${baseId}-name`}>
              Name
              <input
                id={`${baseId}-name`}
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={
                  errors.name ? `${baseId}-name-error` : undefined
                }
              />
              {errors.name && (
                <span
                  id={`${baseId}-name-error`}
                  className="estimate-form__error"
                >
                  {errors.name}
                </span>
              )}
            </label>

            <label htmlFor={`${baseId}-email`}>
              Email
              <input
                id={`${baseId}-email`}
                type="email"
                maxLength={200}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={
                  errors.email ? `${baseId}-email-error` : undefined
                }
              />
              {errors.email && (
                <span
                  id={`${baseId}-email-error`}
                  className="estimate-form__error"
                >
                  {errors.email}
                </span>
              )}
            </label>

            <label htmlFor={`${baseId}-company`}>
              Company (optional)
              <input
                id={`${baseId}-company`}
                maxLength={200}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>

            <label htmlFor={`${baseId}-budget`}>
              Budget (optional)
              <select
                id={`${baseId}-budget`}
                value={budget}
                onChange={(e) => setBudget(e.target.value as BudgetRange | '')}
              >
                <option value="">Select a range…</option>
                {BUDGETS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>

            {services.length > 0 && (
              <fieldset className="estimate-form__interests">
                <legend>Interested in (optional)</legend>
                {services.map((s) => (
                  <label key={s.id} className="estimate-form__checkbox">
                    <input
                      type="checkbox"
                      checked={interested.includes(s.id)}
                      onChange={() => toggleInterest(s.id)}
                    />
                    {s.title}
                  </label>
                ))}
              </fieldset>
            )}

            <label htmlFor={`${baseId}-message`}>
              Message
              <textarea
                id={`${baseId}-message`}
                rows={4}
                maxLength={5000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={
                  errors.message ? `${baseId}-message-error` : undefined
                }
              />
              {errors.message && (
                <span
                  id={`${baseId}-message-error`}
                  className="estimate-form__error"
                >
                  {errors.message}
                </span>
              )}
            </label>

            {submitError && (
              <p className="estimate-form__error" role="alert">
                Something went wrong — please try again.
              </p>
            )}

            <button
              type="submit"
              className="btn estimate-form__submit"
              disabled={submitting}
            >
              {submitting ? 'Sending…' : 'Send request'}
            </button>
            <p className="estimate-form__note">
              Your information is secure and will not be shared.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
