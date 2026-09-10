export const BUDGETS = ['<1k', '1-3k', '3-10k', '10k+', 'not_sure'] as const
export const LOCALES = ['en', 'uk'] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MAX = { name: 200, email: 200, company: 200, message: 5000, sourcePage: 200, tag: 100 }
const MAX_INTERESTS = 20

export interface EstimateInsert {
  name: string
  email: string
  company: string | null
  budget: (typeof BUDGETS)[number] | null
  interested_in: string[]
  message: string
  locale: (typeof LOCALES)[number]
  source_page: string | null
}

type Result =
  | { ok: true; row: EstimateInsert }
  | { ok: false; error: string }

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function validateEstimate(body: unknown): Result {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'body' }
  const b = body as Record<string, unknown>

  // Honeypot. Named `ref_token` (not `company_url`) so browser org-autofill
  // does not fill it for a real visitor and silently drop their submission.
  if (typeof b.ref_token === 'string' && b.ref_token.trim() !== '') {
    return { ok: false, error: 'honeypot' }
  }

  const name = str(b.name)
  const email = str(b.email)
  const message = str(b.message)
  const locale = str(b.locale)

  if (!name || name.length > MAX.name) return { ok: false, error: 'name' }
  if (!email || email.length > MAX.email || !EMAIL_RE.test(email)) return { ok: false, error: 'email' }
  if (!message || message.length > MAX.message) return { ok: false, error: 'message' }
  if (!(LOCALES as readonly string[]).includes(locale)) return { ok: false, error: 'locale' }

  const company = str(b.company) || null
  if (company && company.length > MAX.company) return { ok: false, error: 'company' }

  const sourcePage = str(b.sourcePage) || null
  if (sourcePage && sourcePage.length > MAX.sourcePage) return { ok: false, error: 'sourcePage' }

  const budgetRaw = str(b.budget)
  let budget: EstimateInsert['budget'] = null
  if (budgetRaw) {
    if (!(BUDGETS as readonly string[]).includes(budgetRaw)) return { ok: false, error: 'budget' }
    budget = budgetRaw as EstimateInsert['budget']
  }

  const interested = Array.isArray(b.interestedIn) ? b.interestedIn : []
  const interested_in = interested
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= MAX.tag)
    .map((x) => x.trim())
  if (interested_in.length > MAX_INTERESTS) return { ok: false, error: 'interestedIn' }

  return {
    ok: true,
    row: {
      name,
      email,
      company,
      budget,
      interested_in,
      message,
      locale: locale as EstimateInsert['locale'],
      source_page: sourcePage,
    },
  }
}
