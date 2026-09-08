# Admin auth

Single shared password, verified server-side, signed session cookie.

- **Logic** (framework-agnostic, unit-tested): `api/_lib/session.ts` (token + cookie),
  `api/_lib/handlers.ts` (login / session / logout).
- **Prod**: Vercel Node functions `api/admin/{login,session,logout}.ts`.
- **Dev** (`npm run dev`): `vite-plugins/admin-api-dev.ts` serves the same routes;
  cookie is issued without `Secure` (plain http). `vercel dev` also works and is
  closer to prod.
- **Client**: `<AuthProvider>` + `useAuth()` (`src/admin/auth/useAuth.tsx`),
  `<RequireAuth>` gate, `<LoginPage>`. Wired into the `/admin/*` route tree by the
  admin shell (Plan 3).

Env: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (both server-only, never `VITE_`).
Cookie: `admin_session`, HttpOnly, SameSite=Lax, 8h.

To rotate: change `ADMIN_SESSION_SECRET` (invalidates all sessions) or
`ADMIN_PASSWORD`, then redeploy / restart dev.
