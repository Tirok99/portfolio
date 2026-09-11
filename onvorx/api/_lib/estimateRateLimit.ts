const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5

// Best-effort, per serverless-instance. Fluid Compute reuses instances so this
// catches naive floods; it is NOT an authoritative limiter. Vercel Firewall
// rate-limit rules on /api/estimate are the real defence — see docs/CMS-SETUP.md.
const hits = new Map<string, number[]>()

export function checkRateLimit(ip: string, now: number = Date.now()): boolean {
  if (!ip) return true
  // Cheap unbounded-growth guard: a flood of distinct IPs must not grow `hits`
  // without limit. Dropping the whole map just resets everyone's window.
  if (hits.size > 5000) hits.clear()
  const fresh = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (fresh.length >= MAX_PER_WINDOW) {
    hits.set(ip, fresh)
    return false
  }
  fresh.push(now)
  hits.set(ip, fresh)
  return true
}

export function __resetRateLimitForTest(): void {
  hits.clear()
}
