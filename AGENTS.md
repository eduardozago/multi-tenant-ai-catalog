# multi-tenant-ai-catalog

Multi-tenant SaaS where companies manage a product catalog and an AI agent answers customer questions by querying real MongoDB data through tool calling. Built as a 48h technical challenge: clear, well-justified code matters more than feature count.

## Stack

- Monorepo: pnpm workspaces + Turborepo
- `apps/server`: Node.js, Express 5, TypeScript, Mongoose, zod, jsonwebtoken, bcrypt
- `apps/web`: React + Vite SPA, TanStack Router, TanStack Query, shadcn/ui, Tailwind, react-hook-form + zod
- LLM: official provider SDK called directly behind an `LLMProvider` interface. No agent frameworks (LangChain, Vercel AI SDK): the tool-calling loop is part of what is being evaluated.
- Tooling: Biome (lint + format), Vitest + Supertest + mongodb-memory-server

## Commands

- Install: `pnpm install`
- Database: `pnpm db:start` (MongoDB)
- Dev (web + server): `pnpm dev`
- Seed: `pnpm --filter server seed`
- Types: `pnpm check-types`

## Repository map

- `apps/server` — REST API. Conventions in `apps/server/AGENTS.md`.
- `apps/web` — SPA. Conventions in `apps/web/AGENTS.md`.
- `docs/decisions.md` — architectural decision log; source for the README.

## Non-negotiable invariants

These are the core of the evaluation. Never trade them for speed, and flag any request that would break them.

### Tenant isolation

1. `companyId` comes only from the verified JWT (`req.auth.companyId`). Never from body, query, params, headers, or LLM tool arguments.
2. Every tenant-owned schema applies the `tenantScoped` plugin. A query without `company_id` must throw, never silently return data.
3. Repository methods take `companyId` as their first parameter.
4. Id lookups filter by `{ _id, company_id }`. A resource from another tenant returns 404, not 403.
5. Updates never accept `company_id` from input (no spreading request bodies into updates).

### Auth and roles

- JWT payload: `{ sub, companyId, role }`. Roles: `admin`, `user`.
- `authenticate` verifies the token and sets `req.auth`. `authorize(...roles)` guards routes.
- `admin` creates, updates and deletes products. `user` reads products and uses the chat.
- Registration creates a new company and its first admin. It never accepts an existing company id.
- Passwords hashed with bcrypt. `passwordHash` never leaves the repository layer.

### AI agent

- Tool input schemas never contain a tenant identifier. The tenant is injected from the request context at execution time, so prompt injection cannot reach another tenant's data.
- Tool inputs are validated with zod. Invalid input becomes a tool error for the model, not a 500.
- The agent loop has a hard iteration cap.
- Tool results are capped in size and project only the fields the model needs.
- The system prompt restricts answers to tool results: no invented products or prices.

## Working agreement

- Plan before non-trivial changes: list the files you will touch and the approach. Wait for approval when the change affects architecture, data model, auth, or tenant isolation.
- Do not add dependencies without asking.
- Keep changes scoped to the task. No drive-by refactors.
- After changing code, run `pnpm check-types` and the relevant tests, and report results honestly, including failures.
- Explain the reasoning behind non-obvious code in your reply. The author must be able to defend every line in the interview.
- When a design decision is made or changed, record it in `docs/decisions.md`.
- Never read or print `.env` files. Use `.env.example` for variable names.
- Do not commit or push unless asked. Commit messages follow Conventional Commits.

## Definition of done

- Types, lint and tests pass
- Tenant invariants hold; isolation test added when data access changed
- Errors go through the central error handler with a consistent shape
- UI covers loading, empty and error states, works at 375px and in dark mode
- Decision logged, if one was made
