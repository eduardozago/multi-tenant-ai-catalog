# apps/server

## Layout

```
src/
  config/env.ts          zod-validated env; import `env`, never read process.env directly
  modules/<feature>/     *.routes.ts → *.controller.ts → *.service.ts → *.repository.ts → *.model.ts, *.schemas.ts
  modules/chat/          agent.service.ts (loop), tools/ (definitions + registry), llm/ (LLMProvider + implementation)
  shared/middlewares/    authenticate, authorize, validate, error-handler
  shared/db/             connection, tenantScoped plugin
  shared/errors/         AppError hierarchy
  container.ts           composition root: builds repositories and services, injects via constructors
  app.ts                 createApp(): builds Express without listening (used by tests)
  server.ts              connects to Mongo and listens
scripts/seed.ts
```

## Layer responsibilities

- routes: path + middleware chain only (`authenticate`, `authorize`, `validate`, controller).
- controller: reads validated input and `req.auth`, calls one service method, maps the result to HTTP. No business logic, no Mongoose.
- service: business rules. Receives a `RequestContext` (`{ userId, companyId, role }`) explicitly. Knows nothing about Express.
- repository: the only layer that imports Mongoose models. `companyId` first parameter. Returns plain objects via `.lean()`.
- model: Mongoose schema. Tenant-owned schemas apply `tenantScoped` and indexes that start with `company_id`.

No module-level singletons other than config and logger. Everything else is wired in `container.ts`.

## Conventions

- Validation with zod at the edge: `validate({ body, params, query })`. ObjectId params are validated before reaching Mongo.
- Services throw typed errors (`NotFoundError`, `ForbiddenError`, `UnauthorizedError`, `ValidationError`). The error handler maps them to `{ error: { code, message, details? } }`. Unknown errors become 500 without leaking internals.
- Express 5 forwards async errors; do not wrap handlers in try/catch just to call `next`.
- Mongo field `company_id` (mirrors the challenge spec); `companyId` in TypeScript.
- Never log tokens, passwords, or full prompts containing user data.
- The LLM model name and API key come from env.

## Testing

- Vitest + Supertest against `createApp()` with mongodb-memory-server. The LLM is faked through `LLMProvider`.
- Priority order: tenant isolation (cross-tenant read/update/delete → 404, plugin throws without filter, tools only see own tenant), then auth and roles, then service rules.
