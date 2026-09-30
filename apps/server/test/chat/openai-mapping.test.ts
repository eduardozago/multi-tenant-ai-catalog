import type { ChatCompletion } from "openai/resources/chat/completions";
import { describe, expect, it } from "vitest";

import {
  fromOpenAIResponse,
  mapFinishReason,
  toOpenAIMessages,
  toOpenAIRequest,
  toOpenAITools,
} from "../../src/modules/chat/llm/openai.mapping";
import type { Message } from "../../src/modules/chat/llm/types";

function completion(message: Partial<ChatCompletion.Choice["message"]>, finishReason: string): ChatCompletion {
  return {
    id: "cmpl_1",
    object: "chat.completion",
    created: 0,
    model: "test",
    choices: [
      {
        index: 0,
        logprobs: null,
        finish_reason: finishReason as ChatCompletion.Choice["finish_reason"],
        message: { role: "assistant", content: null, refusal: null, ...message },
      },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
  };
}

describe("toOpenAIMessages", () => {
  it("puts the system prompt first and maps user text", () => {
    const messages = toOpenAIMessages("be helpful", [{ role: "user", content: [{ type: "text", text: "oi" }] }]);
    expect(messages).toEqual([
      { role: "system", content: "be helpful" },
      { role: "user", content: "oi" },
    ]);
  });

  it("places one tool message per call right after its assistant message, same ids and order", () => {
    const history: Message[] = [
      { role: "user", content: [{ type: "text", text: "rações e categorias?" }] },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Vou verificar." },
          { type: "tool_use", id: "call_a", name: "search_products", input: { query: "ração" } },
          { type: "tool_use", id: "call_b", name: "list_categories", input: {} },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", toolUseId: "call_a", content: '{"count":1}', isError: false },
          { type: "tool_result", toolUseId: "call_b", content: '{"categories":[]}', isError: false },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "Encontrei 1." }] },
    ];

    const messages = toOpenAIMessages("sys", history);

    expect(messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "rações e categorias?" },
      {
        role: "assistant",
        content: "Vou verificar.",
        tool_calls: [
          { id: "call_a", type: "function", function: { name: "search_products", arguments: '{"query":"ração"}' } },
          { id: "call_b", type: "function", function: { name: "list_categories", arguments: "{}" } },
        ],
      },
      { role: "tool", tool_call_id: "call_a", content: '{"count":1}' },
      { role: "tool", tool_call_id: "call_b", content: '{"categories":[]}' },
      { role: "assistant", content: "Encontrei 1." },
    ]);
  });

  it("sends an assistant turn with only tool calls with null content", () => {
    const [, assistant] = toOpenAIMessages("sys", [
      { role: "assistant", content: [{ type: "tool_use", id: "c1", name: "list_categories", input: {} }] },
    ]);
    expect(assistant).toMatchObject({ role: "assistant", content: null });
  });

  it("replays a call with unparseable arguments as {} so the history stays valid", () => {
    const [, assistant] = toOpenAIMessages("sys", [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "c1", name: "search_products", input: null, parseError: "bad" }],
      },
    ]);
    expect(assistant).toMatchObject({ tool_calls: [{ function: { arguments: "{}" } }] });
  });
});

describe("toOpenAITools", () => {
  it("declares function tools in strict mode", () => {
    const schema = { type: "object", properties: {}, required: [], additionalProperties: false };
    expect(toOpenAITools([{ name: "list_categories", description: "d", inputSchema: schema }])).toEqual([
      { type: "function", function: { name: "list_categories", description: "d", parameters: schema, strict: true } },
    ]);
  });
});

describe("fromOpenAIResponse", () => {
  it("maps text, tool calls and usage to neutral blocks", () => {
    const response = fromOpenAIResponse(
      completion(
        {
          content: "Buscando",
          tool_calls: [
            { id: "call_1", type: "function", function: { name: "search_products", arguments: '{"query":"bola"}' } },
          ],
        },
        "tool_calls",
      ),
    );

    expect(response).toEqual({
      content: [
        { type: "text", text: "Buscando" },
        { type: "tool_use", id: "call_1", name: "search_products", input: { query: "bola" } },
      ],
      stopReason: "tool_use",
      usage: { inputTokens: 120, outputTokens: 30 },
    });
  });

  it("flags invalid arguments JSON on the block instead of throwing", () => {
    const response = fromOpenAIResponse(
      completion(
        { tool_calls: [{ id: "call_1", type: "function", function: { name: "search_products", arguments: '{"q' } }] },
        "tool_calls",
      ),
    );

    expect(response.content).toEqual([
      { type: "tool_use", id: "call_1", name: "search_products", input: null, parseError: expect.any(String) },
    ]);
  });

  it("returns no blocks for an empty message", () => {
    expect(fromOpenAIResponse(completion({ content: null }, "stop")).content).toEqual([]);
  });
});

describe("mapFinishReason", () => {
  it.each([
    ["tool_calls", "tool_use"],
    ["stop", "end_turn"],
    ["length", "max_tokens"],
    ["content_filter", "end_turn"],
    [null, "end_turn"],
  ])("%s → %s", (reason, expected) => {
    expect(mapFinishReason(reason)).toBe(expected);
  });
});

describe("toOpenAIRequest", () => {
  const tool = {
    name: "list_categories",
    description: "d",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
  };
  const params = { model: "m", maxTokens: 100 };

  it("sends tool_choice none only when tools are forbidden", () => {
    const base = { system: "s", messages: [], tools: [tool] };
    expect(toOpenAIRequest({ ...base, toolChoice: "none" }, params)).toMatchObject({ tool_choice: "none" });
    expect(toOpenAIRequest(base, params)).not.toHaveProperty("tool_choice");
    expect(toOpenAIRequest({ ...base, toolChoice: "auto" }, params)).not.toHaveProperty("tool_choice");
  });

  it("uses max_completion_tokens and omits tools when there are none", () => {
    const request = toOpenAIRequest({ system: "s", messages: [], tools: [] }, params);
    expect(request).toMatchObject({ model: "m", max_completion_tokens: 100 });
    expect(request).not.toHaveProperty("tools");
  });
});
