import type { z } from "zod";

import type { ProductDto } from "../../products/product.dto";
import type { ProductRepository } from "../../products/product.repository";

/**
 * Who the tool runs for. Built by the server from the verified JWT and passed at
 * execution time; no input schema has a tenant field, so nothing the model writes
 * can change which company is queried.
 */
export type ToolContext = { companyId: string; userId: string };

/** The repository methods the tools use; tests pass a fake with this shape. */
export type CatalogReader = Pick<ProductRepository, "search" | "findById" | "listCategories">;

export type ToolOutput = {
  /** What the model reads (serialized to JSON). Small, projected fields only. */
  content: unknown;
  /** How many items the tool returned; shown in the UI and in `tool_end` events. */
  resultCount: number;
  /** Full products for the UI cards (imageUrl included). Never sent to the model. */
  products?: ProductDto[];
};

/** An expected failure the model should see (e.g. product_not_found), not a 500. */
export class ToolError extends Error {
  constructor(
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = "ToolError";
  }
}

export type AgentTool<Schema extends z.ZodType = z.ZodType> = {
  /** snake_case verb_noun. */
  name: string;
  /** Written for the model: what it returns, when to use it, when not to. */
  description: string;
  /** Strict-compatible: every field required, optional ones `.nullable()`. */
  inputSchema: Schema;
  execute(input: z.output<Schema>, ctx: ToolContext): Promise<ToolOutput>;
};

/** Identity function that keeps `execute`'s input typed from the schema. */
export function defineTool<Schema extends z.ZodType>(tool: AgentTool<Schema>): AgentTool<Schema> {
  return tool;
}
