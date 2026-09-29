---
name: backend-module
description: Scaffold or extend a feature module in apps/server (routes, controller, service, repository, model, zod schemas) following the layered architecture and tenant isolation rules. Use when adding a resource, endpoint or collection to the API.
---

# Backend module

## Steps

1. Read `apps/server/AGENTS.md` and an existing module (`modules/products` once it exists) before writing.
2. Create in `src/modules/<feature>/`:
   - `<feature>.model.ts`: schema; apply `tenantScoped` if the data belongs to a company; compound indexes starting with `company_id`.
   - `<feature>.schemas.ts`: zod schemas for body, params and query; export inferred types.
   - `<feature>.repository.ts`: every method starts with `companyId: string`; `.lean()`; id lookups use `{ _id, company_id }`.
   - `<feature>.service.ts`: business rules; receives `RequestContext`; throws typed errors.
   - `<feature>.controller.ts`: thin HTTP mapping.
   - `<feature>.routes.ts`: middleware chain.
3. Wire repository and service in `src/container.ts`; mount the router in `app.ts`.
4. Add an isolation test: seed two tenants and assert tenant A cannot list, read, update or delete tenant B's documents (404).
5. Run `pnpm check-types` and the server tests.
6. Delegate a review of the diff to the `tenant-isolation-reviewer` subagent.

## Checklist

- [ ] No tenant id read from body, query or params
- [ ] Update schemas do not accept `company_id`
- [ ] Mutating routes guarded with `authorize('admin')` where required
- [ ] Responses exclude internal fields (`passwordHash`, `__v`)
- [ ] Errors are typed and handled centrally
