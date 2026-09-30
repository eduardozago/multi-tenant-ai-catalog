import OpenAI, { APIError, APIUserAbortError } from "openai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";

import { LLMUnavailableError } from "./errors";
import { fromOpenAIResponse, toOpenAIRequest } from "./openai.mapping";
import { StreamAccumulator } from "./openai.stream";
import type { GenerateOptions, LLMProvider, LLMRequest, LLMResponse, StreamEvent } from "./types";

export type OpenAIProviderOptions = {
  apiKey: string;
  model: string;
  /** Output cap per call: bounds cost and latency of a single turn. */
  maxTokens?: number;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
  /** Tests pass a stub client to exercise error handling without network. */
  client?: OpenAI;
};

/**
 * Chat Completions implementation of LLMProvider (see D-26). All translation lives in
 * openai.mapping.ts; this class only calls the SDK and normalizes its errors.
 */
export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;

  constructor({ apiKey, model, maxTokens = 1024, timeoutMs = 30_000, client }: OpenAIProviderOptions) {
    // The SDK retries 429/5xx/connection errors twice with backoff before throwing.
    this.client = client ?? new OpenAI({ apiKey });
    this.model = model;
    this.maxTokens = maxTokens;
    this.timeoutMs = timeoutMs;
  }

  async generate(request: LLMRequest, { signal }: GenerateOptions = {}): Promise<LLMResponse> {
    try {
      const completion = await this.client.chat.completions.create(
        toOpenAIRequest(request, { model: this.model, maxTokens: this.maxTokens }),
        { signal, timeout: this.timeoutMs },
      );
      return fromOpenAIResponse(completion);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async *stream(request: LLMRequest, { signal }: GenerateOptions = {}): AsyncIterable<StreamEvent> {
    // Built outside any try: a bug in our mapping is a 500, not "provider unavailable".
    const params = {
      ...toOpenAIRequest(request, { model: this.model, maxTokens: this.maxTokens }),
      stream: true as const,
      // Adds a final chunk with token usage, so streamed runs are measured too.
      stream_options: { include_usage: true },
    };

    let chunks: AsyncIterable<ChatCompletionChunk>;
    try {
      chunks = await this.client.chat.completions.create(params, { signal, timeout: this.timeoutMs });
    } catch (error) {
      throw normalizeError(error);
    }

    // Only reading the next chunk is wrapped (network I/O); the accumulator runs outside.
    const accumulator = new StreamAccumulator();
    const iterator = chunks[Symbol.asyncIterator]();
    while (true) {
      let next: IteratorResult<ChatCompletionChunk>;
      try {
        next = await iterator.next();
      } catch (error) {
        throw normalizeStreamError(error, signal);
      }
      if (next.done) break;
      const text = accumulator.push(next.value);
      if (text) yield { type: "delta", text };
    }
    yield { type: "response", response: accumulator.finish() };
  }
}

/**
 * Error while reading an open stream. Besides APIError, a dropped connection surfaces as
 * a plain Error from the HTTP client ("terminated"), so anything that is not our own
 * abort is an upstream failure here. Unlike generate(), where a non-APIError can only
 * come from our code.
 */
export function normalizeStreamError(error: unknown, signal?: AbortSignal): unknown {
  if (error instanceof APIUserAbortError || signal?.aborted) return error;
  return error instanceof LLMUnavailableError ? error : new LLMUnavailableError(error);
}

/**
 * A client abort (user closed the connection) is rethrown as is: it is not an upstream
 * failure. Every other SDK error (429, 5xx, timeout, network, invalid key) becomes 502.
 */
export function normalizeError(error: unknown): unknown {
  if (error instanceof APIUserAbortError) return error;
  if (error instanceof APIError) return new LLMUnavailableError(error);
  return error;
}
