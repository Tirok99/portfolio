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
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
})

test('owner edits a section title and it shows on the home page', async ({ page }) => {
  await page.goto('/admin/content')
  await expect(page.getByRole('heading', { level: 1, name: 'Content' })).toBeVisible()

  const firstTitle = page.getByRole('textbox', { name: 'Title' }).first()
  await firstTitle.fill('E2E hero headline')
  await page.getByRole('button', { name: 'Save' }).first().click()
  await expect(page.getByText('All changes saved').first()).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'E2E hero headline' })).toBeVisible()
})

test('estimate form submission appears in the admin requests inbox', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /request an estimate/i }).first().click()
  await page.getByLabel('Name').fill('E2E Tester')
  await page.getByLabel('Email').fill('e2e@example.com')
  await page.getByLabel('Message').fill('Please quote a rebuild.')
  await page.getByRole('button', { name: /send request/i }).click()
  await expect(page.getByText(/thank you/i)).toBeVisible()

  await page.goto('/admin/requests')
  await expect(page.getByText('E2E Tester')).toBeVisible()
})
