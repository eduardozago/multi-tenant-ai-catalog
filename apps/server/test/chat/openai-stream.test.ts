import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { describe, expect, it } from "vitest";

import { StreamAccumulator } from "../../src/modules/chat/llm/openai.stream";

type Delta = ChatCompletionChunk.Choice.Delta;

function chunk(delta: Delta, finishReason: string | null = null): ChatCompletionChunk {
  return {
    id: "chunk",
    object: "chat.completion.chunk",
    created: 0,
    model: "test",
    choices: [{ index: 0, delta, finish_reason: finishReason as ChatCompletionChunk.Choice["finish_reason"] }],
  };
}

// With stream_options.include_usage the last chunk has no choices, only usage.
const usageChunk: ChatCompletionChunk = {
  id: "chunk",
  object: "chat.completion.chunk",
  created: 0,
  model: "test",
  choices: [],
  usage: { prompt_tokens: 200, completion_tokens: 40, total_tokens: 240 },
};

function feed(chunks: ChatCompletionChunk[]) {
  const accumulator = new StreamAccumulator();
  const deltas = chunks.map((c) => accumulator.push(c)).filter((d): d is string => d !== undefined);
  return { deltas, response: accumulator.finish() };
}

describe("StreamAccumulator", () => {
  it("returns text deltas and builds the final text response with usage", () => {
    const { deltas, response } = feed([
      chunk({ role: "assistant", content: "" }),
      chunk({ content: "Temos " }),
      chunk({ content: "3 produtos." }),
      chunk({}, "stop"),
      usageChunk,
    ]);

    expect(deltas).toEqual(["Temos ", "3 produtos."]);
    expect(response).toEqual({
      content: [{ type: "text", text: "Temos 3 produtos." }],
      stopReason: "end_turn",
      usage: { inputTokens: 200, outputTokens: 40 },
    });
  });

  it("rebuilds two parallel tool calls from interleaved argument fragments", () => {
    const { deltas, response } = feed([
      chunk({
        role: "assistant",
        tool_calls: [{ index: 0, id: "call_a", type: "function", function: { name: "search_products", arguments: "" } }],
      }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: '{"query":' } }] }),
      chunk({
        tool_calls: [{ index: 1, id: "call_b", type: "function", function: { name: "list_categories", arguments: "" } }],
      }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: '"ração"' } }] }),
      chunk({ tool_calls: [{ index: 1, function: { arguments: "{}" } }] }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: ',"limit":3}' } }] }),
      chunk({}, "tool_calls"),
      usageChunk,
    ]);

    expect(deltas).toEqual([]);
    expect(response).toEqual({
      content: [
        { type: "tool_use", id: "call_a", name: "search_products", input: { query: "ração", limit: 3 } },
        { type: "tool_use", id: "call_b", name: "list_categories", input: {} },
      ],
      stopReason: "tool_use",
      usage: { inputTokens: 200, outputTokens: 40 },
    });
  });

  it("orders tool calls by index even if a later index arrives first", () => {
    const { response } = feed([
      chunk({ tool_calls: [{ index: 1, id: "call_b", function: { name: "list_categories", arguments: "{}" } }] }),
      chunk({ tool_calls: [{ index: 0, id: "call_a", function: { name: "list_categories", arguments: "{}" } }] }),
      chunk({}, "tool_calls"),
    ]);
    expect(response.content.map((block) => block.type === "tool_use" && block.id)).toEqual(["call_a", "call_b"]);
  });

  it("flags truncated arguments instead of throwing", () => {
    const { response } = feed([
      chunk({ tool_calls: [{ index: 0, id: "call_a", function: { name: "search_products", arguments: '{"query":"ra' } }] }),
      chunk({}, "length"),
    ]);

    expect(response.stopReason).toBe("max_tokens");
    expect(response.content).toEqual([
      { type: "tool_use", id: "call_a", name: "search_products", input: null, parseError: expect.any(String) },
    ]);
  });

  it("keeps text written before tool calls", () => {
    const { response } = feed([
      chunk({ content: "Vou buscar." }),
      chunk({ tool_calls: [{ index: 0, id: "call_a", function: { name: "list_categories", arguments: "{}" } }] }),
      chunk({}, "tool_calls"),
    ]);
    expect(response.content[0]).toEqual({ type: "text", text: "Vou buscar." });
  });
});
