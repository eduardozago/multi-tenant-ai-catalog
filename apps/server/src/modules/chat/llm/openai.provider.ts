import OpenAI, { APIError, APIUserAbortError } from "openai";

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

  constructor({ apiKey, model, maxTokens = 1024, timeoutMs = 30_000 }: OpenAIProviderOptions) {
    // The SDK retries 429/5xx/connection errors twice with backoff before throwing.
    this.client = new OpenAI({ apiKey });
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
    const accumulator = new StreamAccumulator();
    try {
      const chunks = await this.client.chat.completions.create(
        {
          ...toOpenAIRequest(request, { model: this.model, maxTokens: this.maxTokens }),
          stream: true,
          // Adds a final chunk with token usage, so streamed runs are measured too.
          stream_options: { include_usage: true },
        },
        { signal, timeout: this.timeoutMs },
      );
      for await (const chunk of chunks) {
        const text = accumulator.push(chunk);
        if (text) yield { type: "delta", text };
      }
    } catch (error) {
      // Covers failures before the first chunk and in the middle of the stream. A dropped
      // connection mid-stream surfaces as a plain Error from the HTTP client, not an
      // APIError, so anything that is not our own abort counts as upstream failure.
      if (error instanceof APIUserAbortError || signal?.aborted) throw error;
      throw error instanceof LLMUnavailableError ? error : new LLMUnavailableError(error);
    }
    yield { type: "response", response: accumulator.finish() };
  }
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
