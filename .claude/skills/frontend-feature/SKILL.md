---
name: frontend-feature
description: Build or polish a page or component in apps/web with shadcn/ui, TanStack Router and TanStack Query following the project's UI conventions. Use for any new screen, form, list, dialog, or visual and UX improvement in the web app.
---

# Frontend feature

## Steps

1. Check `src/components/ui` first. Add missing primitives with `pnpm dlx shadcn@latest add <component>` from `apps/web` instead of hand-writing them.
2. Data: fetchers in `features/<f>/api.ts`, hooks in `features/<f>/hooks.ts`. Mutations invalidate related keys and toast on success and error.
3. Build every state: skeleton, empty (with a call to action for admins), error with retry, success.
4. Role awareness: hide admin-only actions for `user`; never treat this as security.
5. Verify at 375px and desktop, in light and dark mode, and with keyboard navigation in dialogs and forms.

## Visual standards

- Layout: sidebar on desktop, sheet on mobile; content `max-w-6xl`; consistent spacing (`gap-4`/`gap-6`, `p-4`/`p-6`).
- Page header: title `text-2xl font-semibold`, description `text-muted-foreground`, primary action aligned right.
- Color only through theme tokens. Icons from lucide-react, `size-4` inside buttons.
- Prices: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Product images: fixed aspect ratio, `object-cover`, placeholder when the URL fails to load.
