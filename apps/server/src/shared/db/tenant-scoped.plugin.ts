import {
  type Aggregate,
  type MongooseQueryMiddleware,
  type MongooseQueryOrDocumentMiddleware,
  type Query,
  type Schema,
  Types,
} from "mongoose";

import { TenantScopeError } from "../errors";

/**
 * Query option that disables the check for one query. Allowed only where the
 * tenant cannot be known yet (login lookup by email) and in the seed script.
 * Audit with: grep -rn bypassTenantScope src scripts
 */
export const BYPASS_TENANT_SCOPE = "bypassTenantScope";

const QUERY_OPERATIONS: MongooseQueryMiddleware[] = [
  "find",
  "findOne",
  "countDocuments",
  "estimatedDocumentCount",
  "distinct",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "updateMany",
  "replaceOne",
  "deleteMany",
];

// Also exist as document methods; registered as query middleware only.
const QUERY_OR_DOCUMENT_OPERATIONS: MongooseQueryOrDocumentMiddleware[] = ["updateOne", "deleteOne"];

/**
 * Only an equality on a concrete id counts as a tenant filter. Operators such as
 * `{ $ne: id }` or `{ $exists: true }` would match other tenants' documents.
 */
function isTenantEquality(value: unknown): boolean {
  return typeof value === "string" || value instanceof Types.ObjectId;
}

const REPLACE_OPERATIONS = new Set(["replaceOne", "findOneAndReplace"]);
const UPDATE_OPERATIONS = new Set(["updateOne", "updateMany", "findOneAndUpdate"]);
// The only update operators allowed to mention company_id, and only with the filter's value
// (an upsert inserts it; `immutable` makes it a no-op on existing documents).
const OPERATORS_ALLOWING_SAME_TENANT = new Set(["$set", "$setOnInsert"]);

type Payload = Record<string, unknown>;

function sameTenant(value: unknown, tenant: unknown): boolean {
  return value != null && String(value) === String(tenant);
}

/**
 * The filter decides which documents are touched; the payload decides where they end up.
 * `immutable` only strips plain updates: replacements, upserts and `overwriteImmutable`
 * can still write another tenant's id, so the payload is checked here too, before
 * Mongoose casts it.
 */
function assertWriteStaysInTenant(query: Query<unknown, unknown>, op: string): void {
  if (!REPLACE_OPERATIONS.has(op) && !UPDATE_OPERATIONS.has(op)) return;

  const model = query.model.modelName;
  const tenant = query.getFilter().company_id;
  const update = query.getUpdate() as Payload | Payload[] | null;
  const reject = (reason: string) => {
    throw new TenantScopeError(model, op, reason);
  };

  // Aggregation-pipeline updates can compute any company_id; not supported.
  if (Array.isArray(update)) reject("pipeline updates are not allowed");
  if (!update) return;

  if (REPLACE_OPERATIONS.has(op)) {
    if ("company_id" in update && !sameTenant(update.company_id, tenant)) {
      reject("replacement belongs to another tenant");
    }
    // A replacement without company_id would leave the document with no tenant: pin it.
    query.setUpdate({ ...update, company_id: tenant });
    return;
  }

  for (const [key, value] of Object.entries(update)) {
    if (!key.startsWith("$")) {
      // Top-level field in an update document is an implicit $set.
      if (key === "company_id" && !sameTenant(value, tenant)) reject("update targets another tenant");
      continue;
    }
    const fields = value as Payload | null;
    if (!fields || typeof fields !== "object" || !("company_id" in fields)) continue;
    if (!OPERATORS_ALLOWING_SAME_TENANT.has(key) || !sameTenant(fields.company_id, tenant)) {
      reject(`${key} on company_id is not allowed`);
    }
  }
}

/**
 * Makes a schema tenant-owned: adds `company_id` and rejects any query that
 * does not filter by it, so a forgotten filter becomes an error instead of a leak.
 * Writes are also checked so a document can never be moved to (or upserted into)
 * another tenant. Inserts are covered by `required`.
 */
export function tenantScoped(schema: Schema): void {
  schema.add({
    company_id: {
      type: Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
      immutable: true,
    },
  });

  async function assertQueryScoped(this: Query<unknown, unknown>) {
    if (this.getOptions()[BYPASS_TENANT_SCOPE] === true) return;
    // `op` is set at runtime but missing from the Query typings.
    const op = (this as unknown as { op?: string }).op ?? "query";
    if (!isTenantEquality(this.getFilter().company_id)) {
      throw new TenantScopeError(this.model.modelName, op);
    }
    assertWriteStaysInTenant(this, op);
  }

  schema.pre(QUERY_OPERATIONS, assertQueryScoped);
  schema.pre(QUERY_OR_DOCUMENT_OPERATIONS, { document: false, query: true }, assertQueryScoped);

  // Aggregations must start by narrowing to one tenant; later stages ($lookup,
  // $unionWith) are the repository's responsibility. No bypass for aggregates.
  schema.pre("aggregate", async function (this: Aggregate<unknown>) {
    const first = this.pipeline()[0] as { $match?: Record<string, unknown> } | undefined;
    if (!isTenantEquality(first?.$match?.company_id)) {
      throw new TenantScopeError(this.model().modelName, "aggregate");
    }
  });
}
