// Must be the first import: loads .env files into process.env (validated against
// .env.schema) before config/env.ts parses them.
import "varlock/auto-load";

import { createDb } from "@multi-tenant-ai-catalog/db";

import { createApp } from "./app";
import { env } from "./config/env";

await createDb(env);

createApp().listen(env.PORT, () => {
  console.log(`Server is running on http://localhost:${env.PORT}`);
});
