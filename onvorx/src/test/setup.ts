import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// `SiteContentProvider` calls `fetchRemoteContent()` on mount. Locally, Vitest
// loads `.env.local`, so real Supabase creds would leak in and every suite that
// mounts the provider would fire a live network request (flaky, and it clobbers
// suites that stub global `fetch`). Force the "unconfigured" path in tests so
// `getSupabase()` returns null and the overlay is a no-op — matching CI, where
// `.env.local` is absent. Suites that exercise the remote path mock `./remote`
// or `./supabaseClient` directly and are unaffected by this.
vi.stubEnv('VITE_SUPABASE_URL', '')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

// Mock jsdom not-implemented methods
window.scrollTo = () => {}
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})
