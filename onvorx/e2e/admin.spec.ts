import { test, expect } from '@playwright/test'

// Stub the auth endpoints (preview does not run the Vercel functions) and start
// every test from a clean content store. `localStorage` is cleared once, after
// the app origin is loaded — not via addInitScript, which would also wipe the
// store on the second navigation inside a test.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/session', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) }),
  )
  await page.route('**/api/admin/logout', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: false }) }),
  )
  // Preview does not run the Vercel functions, so the admin write endpoints
  // (`PUT /api/admin/content`, `/api/admin/cards`) would 404. The provider's
  // optimistic `setData` still updates the UI, but a 404 leaves a rejected
  // promise and triggers an immediate revert `refetch`. Stub them 200 so the
  // write path is exercised cleanly.
  await page.route('**/api/admin/content', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  )
  await page.route('**/api/admin/cards**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  )
  // E2E covers the admin/localStorage path, not the Supabase runtime read. A
  // local `vite build` embeds VITE_SUPABASE_* from .env.local, so the preview
  // bundle would otherwise fetch live content and the mount overlay could race
  // the E2E edits. Abort every Supabase REST call.
  await page.route('**/rest/v1/**', (r) => r.abort())
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
})

test('owner edits a section title and it shows on the home page', async ({ page }) => {
  await page.goto('/admin/content')
  await expect(page.getByRole('heading', { level: 1, name: 'Content' })).toBeVisible()

  const heroFieldset = page.locator('fieldset').filter({ hasText: /^Hero/ })
  await heroFieldset.getByRole('textbox', { name: 'Title' }).first().fill('E2E hero headline')
  await heroFieldset.getByRole('button', { name: 'Save' }).click()
  // Scope the wait to the Hero block — a page-wide "All changes saved" match
  // would resolve instantly against an untouched sibling SaveBar.
  await expect(heroFieldset.getByText('All changes saved')).toBeVisible()
  await expect(heroFieldset.getByRole('button', { name: 'Save' })).toBeDisabled()

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'E2E hero headline' })).toBeVisible()
})

test('estimate form submits and shows the thank-you panel', async ({ page }) => {
  // Preview does not run the Vercel functions, so POST /api/estimate would 404.
  await page.route('**/api/estimate', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: /request an estimate/i }).first().click()
  await page.getByLabel('Name').fill('E2E Tester')
  await page.getByLabel('Email').fill('e2e@example.com')
  await page.getByLabel('Message').fill('Please quote a rebuild.')
  await page.getByRole('button', { name: /send request/i }).click()
  await expect(page.getByText(/thank you/i)).toBeVisible()

  // Plan 3: the submitted request will be verifiable on /admin/requests once useRequests() + /api/admin/requests land.
})
