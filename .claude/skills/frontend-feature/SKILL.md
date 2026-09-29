---
name: frontend-feature
description: Build or polish a page or component in apps/web with shadcn/ui, TanStack Router and TanStack Query following the project's UI conventions. Use for any new screen, form, list, dialog, or visual and UX improvement in the web app.
---

# Frontend feature

## Steps

1. Check `packages/ui/src/components` first (shared shadcn primitives, imported as `@multi-tenant-ai-catalog/ui/components/<name>`). Add missing ones from `packages/ui` with `pnpm exec shadcn add <name>` instead of hand-writing them, then change any generated `import { cn } from "cn"` to `@multi-tenant-ai-catalog/ui/lib/utils`. The style is Base UI (`base-lyra`): compose with `render={<Button />}`, there is no `asChild`; a `Button` rendering a `Link` needs `nativeButton={false}`, or use `buttonVariants()` on the `Link`.
2. Data: fetchers in `features/<f>/api.ts` via `apiFetch` (types mirror the server DTO), zod schemas in `features/<f>/schemas.ts` mirroring server rules, hooks in `features/<f>/hooks.ts`. Mutations invalidate related keys and toast on success. Form errors stay in the form: `applyFieldErrors` for `EMAIL_TAKEN`/`VALIDATION_ERROR`, otherwise an `Alert` with `getErrorMessage` (`lib/form-errors.ts`); toast errors only for actions without a form.
3. Build every state: skeleton, empty (with a call to action for admins), error with retry, success.
4. Role awareness: only through `lib/permissions.tsx` (`<Can>`, `usePermission`, `<RequirePermission>` for a whole page). Never `role === 'admin'`. Add new permissions to the map there, mirroring the server's `authorize(...)`. This is UX, never security.
5. Copy in pt-BR; map server error codes, never show server messages.
6. Verify at 375px and desktop, in light and dark mode, and with keyboard navigation in dialogs and forms.

## Visual standards

- Layout: sidebar on desktop, sheet on mobile; content `max-w-6xl`; consistent spacing (`gap-4`/`gap-6`, `p-4`/`p-6`).
- Page header: use `components/page-header.tsx` (title `text-2xl font-semibold`, description `text-muted-foreground`, primary action aligned right). Empty and error states use `Empty` from `packages/ui`; roles render with `RoleBadge`.
- Color only through theme tokens. Icons from lucide-react, `size-4` inside buttons.
- Prices: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Product images: fixed aspect ratio, `object-cover`, placeholder when the URL fails to load.
