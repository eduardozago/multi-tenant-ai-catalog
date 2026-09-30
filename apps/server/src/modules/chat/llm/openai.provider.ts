import OpenAI, { APIError, APIUserAbortError } from "openai";

import { LLMUnavailableError } from "./errors";
import { fromOpenAIResponse, toOpenAIRequest } from "./openai.mapping";
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

  // Non-incremental for now: one delta with the full text, then the response.
  // Token-by-token streaming replaces this in the SSE step.
  async *stream(request: LLMRequest, options: GenerateOptions = {}): AsyncIterable<StreamEvent> {
    const response = await this.generate(request, options);
    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    if (text) yield { type: "delta", text };
    yield { type: "response", response };
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
