import type OpenAI from "openai";
import { APIConnectionError, APIUserAbortError, InternalServerError, RateLimitError } from "openai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { describe, expect, it } from "vitest";

import { LLMUnavailableError } from "../../src/modules/chat/llm/errors";
import { normalizeError, OpenAIProvider } from "../../src/modules/chat/llm/openai.provider";
import type { LLMRequest, StreamEvent } from "../../src/modules/chat/llm/types";

const request: LLMRequest = { system: "s", messages: [{ role: "user", content: [{ type: "text", text: "oi" }] }], tools: [] };

/** Provider over a stub SDK client whose `create` does whatever the test says. */
function providerWith(
  create: (...args: unknown[]) => Promise<unknown>,
  options: Partial<ConstructorParameters<typeof OpenAIProvider>[0]> = {},
) {
  const client = { chat: { completions: { create } } } as unknown as OpenAI;
  return new OpenAIProvider({ apiKey: "unused", model: "m", client, ...options });
}

function textChunk(content: string): ChatCompletionChunk {
  return {
    id: "c",
    object: "chat.completion.chunk",
    created: 0,
    model: "m",
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  };
}

/** A stream that yields the chunks, then throws `error` (if given). */
async function* chunksThen(chunks: ChatCompletionChunk[], error?: unknown) {
  for (const chunk of chunks) yield chunk;
  if (error) throw error;
}

async function collect(stream: AsyncIterable<StreamEvent>) {
  const events: StreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe("normalizeError", () => {
  it.each([
    ["429", new RateLimitError(429, {}, "rate limited", new Headers())],
    ["5xx", new InternalServerError(503, {}, "unavailable", new Headers())],
    ["connection", new APIConnectionError({ message: "ECONNRESET" })],
  ])("maps a %s APIError to LLMUnavailableError, keeping it as cause", (_name, error) => {
    const normalized = normalizeError(error);
    expect(normalized).toBeInstanceOf(LLMUnavailableError);
    expect((normalized as LLMUnavailableError).cause).toBe(error);
  });

  it("rethrows a client abort unchanged", () => {
    const abort = new APIUserAbortError();
    expect(normalizeError(abort)).toBe(abort);
  });

  it("leaves non-SDK errors (our bugs) alone", () => {
    const bug = new TypeError("x is undefined");
    expect(normalizeError(bug)).toBe(bug);
  });
});

describe("OpenAIProvider.generate", () => {
  it("turns an API failure into LLMUnavailableError (502)", async () => {
    const provider = providerWith(async () => {
      throw new RateLimitError(429, {}, "rate limited", new Headers());
    });
    await expect(provider.generate(request)).rejects.toMatchObject({ status: 502, code: "LLM_UNAVAILABLE" });
  });
});

describe("OpenAIProvider.stream", () => {
  it("yields deltas and ends with the complete response", async () => {
    const provider = providerWith(async () => chunksThen([textChunk("Olá, "), textChunk("tudo bem?")]));

    const events = await collect(provider.stream(request));

    expect(events).toEqual([
      { type: "delta", text: "Olá, " },
      { type: "delta", text: "tudo bem?" },
      { type: "response", response: expect.objectContaining({ content: [{ type: "text", text: "Olá, tudo bem?" }] }) },
    ]);
  });

  it("sends stream options and the abort signal to the SDK", async () => {
    const calls: unknown[][] = [];
    const provider = providerWith(async (...args) => {
      calls.push(args);
      return chunksThen([]);
    });
    const signal = new AbortController().signal;

    await collect(provider.stream(request, { signal }));

    expect(calls[0]![0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(calls[0]![1]).toMatchObject({ signal, timeout: expect.any(Number) });
  });

  it("sends the configured reasoning effort in stream and generate requests", async () => {
    const params: unknown[] = [];
    const provider = providerWith(
      async (body) => {
        params.push(body);
        return (body as { stream?: boolean }).stream
          ? chunksThen([])
          : { id: "c", object: "chat.completion", created: 0, model: "m", choices: [] };
      },
      { reasoningEffort: "none" },
    );

    await collect(provider.stream(request));
    await provider.generate(request);

    expect(params).toEqual([
      expect.objectContaining({ reasoning_effort: "none", stream: true }),
      expect.objectContaining({ reasoning_effort: "none" }),
    ]);
  });

  it("maps a failure before the first chunk to LLMUnavailableError", async () => {
    const provider = providerWith(async () => {
      throw new InternalServerError(500, {}, "boom", new Headers());
    });
    await expect(collect(provider.stream(request))).rejects.toBeInstanceOf(LLMUnavailableError);
  });

  it("maps a dropped connection mid-stream (plain Error) to LLMUnavailableError", async () => {
    const provider = providerWith(async () => chunksThen([textChunk("Tem")], new TypeError("terminated")));

    const events: StreamEvent[] = [];
    await expect(
      (async () => {
        for await (const event of provider.stream(request)) events.push(event);
      })(),
    ).rejects.toBeInstanceOf(LLMUnavailableError);
    expect(events).toEqual([{ type: "delta", text: "Tem" }]);
  });

  it("rethrows an abort mid-stream unchanged", async () => {
    const controller = new AbortController();
    const abort = new APIUserAbortError();
    const provider = providerWith(async () => chunksThen([textChunk("Tem")], abort));
    controller.abort();

    await expect(collect(provider.stream(request, { signal: controller.signal }))).rejects.toBe(abort);
  });
});
