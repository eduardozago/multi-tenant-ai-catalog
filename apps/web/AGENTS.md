# apps/web

## Layout

```
src/
  routes/               TanStack Router file routes: __root, _auth (login, register), _app (protected shell + pages)
  features/<feature>/   api.ts (fetchers), hooks.ts (queries/mutations), schemas.ts (zod), components/
  features/auth/        session query ['auth','me'], useSession/useLogin/useRegister/useLogout, demo accounts
  components/           app-level components (sidebar, user menu, page header, role badge, 403 state)
  lib/api-client.ts     fetch wrapper: base URL, credentials: 'include', JSON Content-Type, ApiError, 401 → registered handler
  lib/permissions.tsx   role → permission map (mirrors the server), can(), <Can>, usePermission
  lib/form-errors.ts    server error code → pt-BR message; EMAIL_TAKEN / VALIDATION_ERROR → field errors
  lib/redirect.ts       ?redirect= validation (same-origin paths only)
```

shadcn primitives live in `packages/ui` (shared), not in this app. Import from
`@multi-tenant-ai-catalog/ui/components/<name>`. Add new ones from `packages/ui` with
`pnpm exec shadcn add <name>`, and point any `import { cn } from "cn"` it generates at
`@multi-tenant-ai-catalog/ui/lib/utils`. The style is `base-lyra` (Base UI, not Radix):
compose with the `render` prop (`<DialogTrigger render={<Button />}>`), there is no `asChild`.
`DropdownMenuLabel` must sit inside a `DropdownMenuGroup`.

## Conventions

- Auth is an httpOnly cookie set by the server (D-08). The token is never read, stored (no localStorage/sessionStorage) or sent manually: every request uses `fetch` with `credentials: 'include'`. POST/PUT/PATCH always send `Content-Type: application/json`, even without a body (the server returns 415 otherwise). Logout is `POST /auth/logout`; session bootstrap is `GET /auth/me`.

- Session (D-12): the only source is the TanStack Query key `['auth', 'me']` (`null` = signed out). Login and register write the returned user into it; logout and any 401 go through `resetSession()` (clears the whole cache, then seeds `null`). Nothing auth-related in localStorage/sessionStorage.
- Server state only through TanStack Query. Keys: `['auth', 'me']`, `['users']`, `['products', 'list', filters]`, `['products', 'detail', id]`, `['products', 'categories']` (writes invalidate `['products']`). Mutations invalidate related keys and show a toast (sonner).
- UI copy in pt-BR. Server error messages are English and never shown: map `ApiError.code` via `lib/form-errors.ts`.
- Forms: react-hook-form + zod resolver (types from `z.infer`), `Field`/`FieldLabel`/`FieldError` from `packages/ui`, inline field errors, correct `autoComplete`, submit disabled with spinner while pending. Zod schemas mirror the server rules.
- Route protection in the `_app` layout `beforeLoad`. Permission checks only through `lib/permissions.tsx` (`can`, `<Can>`, `usePermission`, `<RequirePermission>` for pages, which renders a 403 state instead of redirecting). No `role === 'admin'` checks elsewhere. This shapes the UI; the server is the source of truth.
- shadcn components and Tailwind theme tokens only (`bg-background`, `text-muted-foreground`, ...). No hard-coded colors, so dark mode works everywhere.
- Every data view handles loading (skeleton), empty and error (with retry) states.
- Mobile first: check 375px. Tables become cards or scroll horizontally on small screens.
- Chat: markdown rendering for assistant messages, visible tool activity, product results as cards, auto-scroll, input disabled while waiting. Streaming uses `fetch` + `ReadableStream` (not `EventSource`, which cannot POST) with `credentials: 'include'`.
