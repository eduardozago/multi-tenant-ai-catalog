# apps/web

## Layout

```
src/
  routes/               TanStack Router file routes: __root, public auth routes, protected _app layout
  features/<feature>/   api.ts (fetchers), hooks.ts (queries/mutations), components/
  components/ui/        shadcn primitives; edit only to customize the design system
  lib/api-client.ts     fetch wrapper: base URL, credentials: 'include', JSON Content-Type, error normalization, 401 → logout
  lib/auth.tsx          auth state (user, role) loaded from GET /auth/me; never holds the token
```

## Conventions

- Auth is an httpOnly cookie set by the server (D-08). The token is never read, stored (no localStorage/sessionStorage) or sent manually: every request uses `fetch` with `credentials: 'include'`. POST/PUT/PATCH always send `Content-Type: application/json`, even without a body (the server returns 415 otherwise). Logout is `POST /auth/logout`; session bootstrap is `GET /auth/me`.

- Server state only through TanStack Query. Keys: `['products', filters]`, `['products', id]`. Mutations invalidate related keys and show a toast (sonner).
- Forms: react-hook-form + zod resolver, inline field errors, submit disabled while pending.
- Route protection in the `_app` layout `beforeLoad`. Admin-only actions are hidden for `user`, but the server is the source of truth.
- shadcn components and Tailwind theme tokens only (`bg-background`, `text-muted-foreground`, ...). No hard-coded colors, so dark mode works everywhere.
- Every data view handles loading (skeleton), empty and error (with retry) states.
- Mobile first: check 375px. Tables become cards or scroll horizontally on small screens.
- Chat: markdown rendering for assistant messages, visible tool activity, product results as cards, auto-scroll, input disabled while waiting. Streaming uses `fetch` + `ReadableStream` (not `EventSource`, which cannot POST) with `credentials: 'include'`.
