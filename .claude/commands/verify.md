---
description: Run lint, type check and tests across the monorepo and summarize results
---

Run in order and stop at the first failure:

1. `pnpm check`
2. `pnpm check-types`
3. `pnpm test`

Report what passed, what failed with the relevant error excerpt, and the likely fix. Do not change code unless I ask.
