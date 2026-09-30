import { ZodError } from "zod";

import type { ProductDto } from "../../products/product.dto";
import type { ToolResultBlock, ToolSpec, ToolUseBlock } from "../llm/types";
import { createGetProductDetailsTool } from "./get-product-details";
import { toStrictJsonSchema } from "./json-schema";
import { createListCategoriesTool } from "./list-categories";
import { createSearchProductsTool } from "./search-products";
import { type AgentTool, type CatalogReader, type ToolContext, ToolError } from "./tool";

/** Outcome of one tool call: the block sent back to the model plus data for the UI and logs. */
export type ToolExecution = {
  result: ToolResultBlock;
  /** Set on success. */
  resultCount?: number;
  /** Error code, set when the model receives a tool error. */
  error?: string;
  products: ProductDto[];
};

function issuesOf(error: ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

/**
 * Holds the agent's tools: exposes their specs to the provider and executes calls by
 * name. Every failure the model can cause or fix (bad JSON, invalid input, unknown
 * tool, product not found) comes back as an `isError` tool result so the loop can
 * continue. Anything else (database down, a bug) is thrown: hiding it would let the
 * model answer "nothing found" during an outage.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();
  private readonly toolSpecs: ToolSpec[];

  constructor(tools: AgentTool[]) {
    for (const tool of tools) this.tools.set(tool.name, tool);
    // Converted once; throws at startup if a schema is not strict-compatible.
    this.toolSpecs = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: toStrictJsonSchema(tool.inputSchema),
    }));
  }

  specs(): ToolSpec[] {
    return this.toolSpecs;
  }

  async execute(call: ToolUseBlock, ctx: ToolContext): Promise<ToolExecution> {
    const failure = (error: string, details?: unknown): ToolExecution => ({
      result: {
        type: "tool_result",
        toolUseId: call.id,
        content: JSON.stringify(details === undefined ? { error } : { error, details }),
        isError: true,
      },
      error,
      products: [],
    });

    if (call.parseError) return failure("invalid_arguments", call.parseError);

    const tool = this.tools.get(call.name);
    if (!tool) return failure("unknown_tool", { available: [...this.tools.keys()] });

    // Also strips unknown keys: a company_id the model invents never reaches execute.
    const parsed = tool.inputSchema.safeParse(call.input);
    if (!parsed.success) return failure("invalid_input", issuesOf(parsed.error));

    try {
      const output = await tool.execute(parsed.data, ctx);
      return {
        result: { type: "tool_result", toolUseId: call.id, content: JSON.stringify(output.content), isError: false },
        resultCount: output.resultCount,
        products: output.products ?? [],
      };
    } catch (error) {
      if (error instanceof ToolError) return failure(error.code, error.details);
      // ProductRepository.search re-validates its filters (D-16); a rejection there is
      // still an input the model can fix.
      if (error instanceof ZodError) return failure("invalid_input", issuesOf(error));
      throw error;
    }
  }
}

export function createCatalogToolRegistry(products: CatalogReader): ToolRegistry {
  return new ToolRegistry([
    createSearchProductsTool(products),
    createGetProductDetailsTool(products),
    createListCategoriesTool(products),
  ]);
}
