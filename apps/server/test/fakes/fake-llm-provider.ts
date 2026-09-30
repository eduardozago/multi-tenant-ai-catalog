import type {
  GenerateOptions,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  StreamEvent,
  ToolUseBlock,
} from "../../src/modules/chat/llm/types";

/** One scripted step: a response, an error to throw, or a function of the request. */
export type ScriptedStep = LLMResponse | Error | ((request: LLMRequest) => LLMResponse);

/**
 * Deterministic LLMProvider for tests: returns the scripted steps in order, one per
 * call, and records every request (deep-copied, since the agent keeps appending to its
 * message array) so tests can assert exactly what the model would have seen.
 */
export class FakeLLMProvider implements LLMProvider {
  readonly requests: LLMRequest[] = [];
  private readonly steps: ScriptedStep[];

  constructor(steps: ScriptedStep[] = []) {
    this.steps = [...steps];
  }

  /** Appends steps, e.g. before each HTTP call in an end-to-end test. */
  push(...steps: ScriptedStep[]) {
    this.steps.push(...steps);
  }

  async generate(request: LLMRequest, _options?: GenerateOptions): Promise<LLMResponse> {
    this.requests.push(structuredClone(request));
    const step = this.steps.shift();
    if (!step) throw new Error(`FakeLLMProvider: no scripted response for call #${this.requests.length}`);
    if (step instanceof Error) throw step;
    return typeof step === "function" ? step(request) : step;
  }

  /** Streams the text of the scripted response in two chunks, then the response. */
  async *stream(request: LLMRequest, options?: GenerateOptions): AsyncIterable<StreamEvent> {
    const response = await this.generate(request, options);
    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    if (text) {
      const middle = Math.ceil(text.length / 2);
      yield { type: "delta", text: text.slice(0, middle) };
      if (text.length > middle) yield { type: "delta", text: text.slice(middle) };
    }
    yield { type: "response", response };
  }
}

const usage = { inputTokens: 10, outputTokens: 5 };

/** Final answer turn. */
export function textResponse(text: string): LLMResponse {
  return { content: [{ type: "text", text }], stopReason: "end_turn", usage };
}

/** Turn that requests one or more tool calls. */
export function toolUseResponse(...calls: Array<{ id: string; name: string; input: unknown }>): LLMResponse {
  return {
    content: calls.map((call): ToolUseBlock => ({ type: "tool_use", ...call })),
    stopReason: "tool_use",
    usage,
  };
}
