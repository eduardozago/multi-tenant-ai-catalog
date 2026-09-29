---
name: agent-tool
description: Add or change a tool available to the chat agent in apps/server/src/modules/chat/tools. Use when the agent needs a new capability to query data, or when changing a tool's schema, description or output.
---

# Agent tool

A tool is: a `snake_case` name (`verb_noun`), a description written for the model, a zod input schema (converted to JSON Schema for the provider) and `execute(input, ctx)`.

## Rules

- The input schema never includes a tenant identifier. `ctx.companyId` comes from the authenticated request.
- Validate input with zod. On failure return `{ error: 'invalid_input', details }` as the tool result so the model can correct itself.
- Call repositories, never Mongoose models.
- Cap results (default 10, max 25) and project only answer-relevant fields: id, name, price, category, short description, imageUrl.
- Keep results small and JSON-serializable; they cost tokens on every loop iteration.
- The description says what the tool returns, when to use it, and when not to.

## Steps

1. Create `tools/<tool-name>.ts` exporting the definition.
2. Register it in `tools/registry.ts`.
3. Unit test with a fake repository: the context `companyId` is the one passed to the repository; invalid input yields a tool error; results are capped.
4. If the tool reads tenant data, extend the isolation tests: a tenant A user asking for tenant B data gets nothing from B.
5. Update the tools table in the README if behavior changed.
