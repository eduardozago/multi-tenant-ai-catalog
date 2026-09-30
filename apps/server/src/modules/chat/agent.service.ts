import { AppError } from "../../shared/errors";
import { logger } from "../../shared/logger";
import type { ProductDto } from "../products/product.dto";
import type { LLMProvider, LLMRequest, LLMResponse, Message, TextBlock, ToolUseBlock, Usage } from "./llm/types";
import { buildSystemPrompt } from "./system-prompt";
import type { ToolExecution, ToolRegistry } from "./tools/registry";
import type { ToolContext } from "./tools/tool";

/** The model kept requesting tools past the cap: 502 like any other upstream failure. */
export class AgentIterationLimitError extends AppError {
  constructor(limit: number) {
    super(502, "AGENT_ITERATION_LIMIT", `The assistant could not finish the answer within ${limit} steps`);
  }
}

/** One tool call as shown to the user ("searched products: 3 results"). */
export type ToolCallSummary = {
  name: string;
  input: unknown;
  resultCount?: number;
  error?: string;
};

/** Progress events for streaming clients. */
export type AgentEvent =
  | { type: "tool_start"; name: string; input: unknown }
  | ({ type: "tool_end" } & ToolCallSummary)
  /** Text as the model writes it (stream mode only). */
  | { type: "delta"; text: string };

export type AgentRunInput = {
  ctx: ToolContext;
  companyName: string;
  /** Previous turns of the conversation, oldest first. */
  history: Message[];
  message: string;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
  /** Use provider.stream and emit `delta` events; the result is the same. */
  stream?: boolean;
};

export type AgentResult = {
  reply: string;
  /** Products from tool results that the reply mentions by name (for the UI cards). */
  products: ProductDto[];
  toolCalls: ToolCallSummary[];
  usage: Usage;
  /** LLM calls made. */
  iterations: number;
};

export type AgentOptions = { maxIterations: number };

export const MAX_REPLY_PRODUCTS = 6;

// Returned when the model ends without text (e.g. output cap hit mid tool call).
const EMPTY_REPLY_FALLBACK = "Não consegui concluir a resposta. Pode reformular a pergunta?";

function textOf(content: ReadonlyArray<{ type: string }>): string {
  return content
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * Keeps the products the reply talks about: returned by a tool in this run and named
 * in the final text (case-insensitive), deduplicated, in the order they are mentioned.
 * The cards therefore always show real database data, never something the model made up.
 */
export function selectMentionedProducts(reply: string, candidates: ProductDto[]): ProductDto[] {
  const text = reply.toLocaleLowerCase("pt-BR");
  const unique = new Map(candidates.map((product) => [product.id, product]));
  return [...unique.values()]
    .map((product) => ({ product, position: text.indexOf(product.name.toLocaleLowerCase("pt-BR")) }))
    .filter(({ position }) => position >= 0)
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_REPLY_PRODUCTS)
    .map(({ product }) => product);
}

/**
 * The tool-calling loop. Each iteration sends the whole conversation to the model; if
 * it asks for tools, they run (in parallel, scoped to ctx.companyId) and their results
 * are appended for the next iteration. It ends when the model answers with text, or
 * throws after `maxIterations` LLM calls.
 */
export class AgentService {
  constructor(
    private readonly provider: LLMProvider,
    private readonly tools: ToolRegistry,
    private readonly options: AgentOptions,
  ) {}

  async run({ ctx, companyName, history, message, signal, onEvent, stream }: AgentRunInput): Promise<AgentResult> {
    const startedAt = Date.now();
    const system = buildSystemPrompt(companyName);
    const messages: Message[] = [...history, { role: "user", content: [{ type: "text", text: message }] }];
    const usage: Usage = { inputTokens: 0, outputTokens: 0 };
    const toolCalls: ToolCallSummary[] = [];
    const toolProducts: ProductDto[] = [];
    let iterations = 0;

    // Metadata only: never the user's message, the reply or tool inputs.
    const log = (outcome: string) =>
      logger.info("agent_run", {
        companyId: ctx.companyId,
        userId: ctx.userId,
        outcome,
        iterations,
        tools: toolCalls.map((call) => call.name),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs: Date.now() - startedAt,
      });

    try {
      while (iterations < this.options.maxIterations) {
        // A client that went away stops the loop before the next paid call.
        signal?.throwIfAborted();
        iterations += 1;
        const request: LLMRequest = { system, messages, tools: this.tools.specs() };
        const response = stream
          ? await this.streamModel(request, signal, onEvent)
          : await this.provider.generate(request, { signal });
        usage.inputTokens += response.usage.inputTokens;
        usage.outputTokens += response.usage.outputTokens;

        const calls = response.content.filter((block): block is ToolUseBlock => block.type === "tool_use");
        if (response.stopReason !== "tool_use" || calls.length === 0) {
          const reply = textOf(response.content) || EMPTY_REPLY_FALLBACK;
          log(response.stopReason);
          return { reply, products: selectMentionedProducts(reply, toolProducts), toolCalls, usage, iterations };
        }

        messages.push({ role: "assistant", content: response.content });
        const executions = await Promise.all(calls.map((call) => this.runTool(call, ctx, onEvent)));

        // One result per call, in the order of the calls: Promise.all keeps the order
        // and each result carries its call id, which the provider API requires.
        messages.push({ role: "user", content: executions.map((execution) => execution.result) });
        for (const [index, execution] of executions.entries()) {
          toolCalls.push(summarize(calls[index]!, execution));
          toolProducts.push(...execution.products);
        }
      }
      throw new AgentIterationLimitError(this.options.maxIterations);
    } catch (error) {
      log(signal?.aborted ? "aborted" : error instanceof AppError ? error.code : "error");
      throw error;
    }
  }

  private async streamModel(
    request: LLMRequest,
    signal: AbortSignal | undefined,
    onEvent: AgentRunInput["onEvent"],
  ): Promise<LLMResponse> {
    for await (const event of this.provider.stream(request, { signal })) {
      if (event.type === "delta") onEvent?.({ type: "delta", text: event.text });
      else return event.response;
    }
    throw new Error("LLM stream ended without a response");
  }

  private async runTool(
    call: ToolUseBlock,
    ctx: ToolContext,
    onEvent: AgentRunInput["onEvent"],
  ): Promise<ToolExecution> {
    onEvent?.({ type: "tool_start", name: call.name, input: call.input });
    const execution = await this.tools.execute(call, ctx);
    onEvent?.({ type: "tool_end", ...summarize(call, execution) });
    return execution;
  }
}

function summarize(call: ToolUseBlock, execution: ToolExecution): ToolCallSummary {
  return {
    name: call.name,
    input: call.input,
    ...(execution.error === undefined ? { resultCount: execution.resultCount } : { error: execution.error }),
  };
}
