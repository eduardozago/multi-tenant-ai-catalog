import { createDb } from "@multi-tenant-ai-catalog/db";

import { ENV } from "./env.server";

export const db = await createDb(ENV);
