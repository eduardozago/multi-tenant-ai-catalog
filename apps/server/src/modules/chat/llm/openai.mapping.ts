import type {
  ChatCompletion,
  ChatCompletionFunctionTool,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import type { ReasoningEffort } from "openai/resources/shared";

import type { LLMRequest, LLMResponse, Message, StopReason, TextBlock, ToolSpec, ToolUseBlock } from "./types";

// Pure translation between the neutral types and Chat Completions. No SDK client and
// no network here, so every rule below is unit tested (test/chat/openai-mapping.test.ts).

function joinText(blocks: ReadonlyArray<{ type: string }>): string {
  return blocks
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/**
 * Neutral history → OpenAI messages. An assistant turn with tool_use blocks becomes one
 * message with `tool_calls`; the following user turn's tool_result blocks become one
 * `tool` message each, in the same order. The API rejects a request where any
 * tool_call_id lacks its tool message, so the order of `messages` is preserved as is.
 */
export function toOpenAIMessages(system: string, messages: Message[]): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = [{ role: "system", content: system }];

  for (const message of messages) {
    if (message.role === "assistant") {
      const toolUses = message.content.filter((block): block is ToolUseBlock => block.type === "tool_use");
      const text = joinText(message.content);
      result.push({
        role: "assistant",
        content: text || null,
        ...(toolUses.length > 0 && {
          tool_calls: toolUses.map((call) => ({
            id: call.id,
            type: "function" as const,
            // An unparseable input is sent back as {} so the history stays valid JSON;
            // the tool error that follows tells the model what went wrong.
            function: { name: call.name, arguments: JSON.stringify(call.parseError ? {} : (call.input ?? {})) },
          })),
        }),
      });
      continue;
    }

    for (const block of message.content) {
      if (block.type === "tool_result") {
        result.push({ role: "tool", tool_call_id: block.toolUseId, content: block.content });
      }
    }
    const text = joinText(message.content);
    if (text) result.push({ role: "user", content: text });
  }

  return result;
}

export function toOpenAITools(tools: ToolSpec[]): ChatCompletionFunctionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      // Strict: the model's arguments always match the schema's shape. zod still
      // validates values (ranges, lengths) in the registry.
      strict: true,
    },
  }));
}

/** Parses `function.arguments` without throwing; a failure is reported on the block. */
export function toToolUseBlock(id: string, name: string, rawArguments: string): ToolUseBlock {
  try {
    return { type: "tool_use", id, name, input: JSON.parse(rawArguments || "{}") };
  } catch {
    return { type: "tool_use", id, name, input: null, parseError: "Arguments are not valid JSON" };
  }
}

export function mapFinishReason(reason: string | null | undefined): StopReason {
  switch (reason) {
    case "tool_calls":
      return "tool_use";
    case "length":
      return "max_tokens";
    default:
      // "stop", plus "content_filter" and the legacy "function_call", which this
      // integration never requests: the turn is over.
      return "end_turn";
  }
}

function toolCallBlocks(toolCalls: ChatCompletionMessageToolCall[] | undefined): ToolUseBlock[] {
  return (toolCalls ?? [])
    .filter((call) => call.type === "function")
    .map((call) => toToolUseBlock(call.id, call.function.name, call.function.arguments));
}

export function fromOpenAIResponse(completion: ChatCompletion): LLMResponse {
  const choice = completion.choices[0];
  const content: LLMResponse["content"] = [];
  if (choice?.message.content) content.push({ type: "text", text: choice.message.content });
  content.push(...toolCallBlocks(choice?.message.tool_calls));

  return {
    content,
    stopReason: mapFinishReason(choice?.finish_reason),
    usage: {
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

export type ChatRequestParams = {
  model: string;
  maxTokens: number;
  /** Omitted from the request when undefined, so the model's default applies. */
  reasoningEffort?: ReasoningEffort;
};

export function toOpenAIRequest(request: LLMRequest, { model, maxTokens, reasoningEffort }: ChatRequestParams) {
  return {
    model,
    messages: toOpenAIMessages(request.system, request.messages),
    ...(request.tools.length > 0 && {
      tools: toOpenAITools(request.tools),
      ...(request.toolChoice === "none" && { tool_choice: "none" as const }),
    }),
    max_completion_tokens: maxTokens,
    ...(reasoningEffort !== undefined && { reasoning_effort: reasoningEffort }),
  };
}
