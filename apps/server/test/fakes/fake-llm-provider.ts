import type {
  GenerateOptions,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  StreamEvent,
  ToolUseBlock,
} from "../../src/modules/chat/llm/types";

/** In stream mode: yields `text` as a delta, then throws `error`. In generate mode: throws. */
export class MidStreamFailure {
  constructor(
    readonly text: string,
    readonly error: Error,
  ) {}
}

/**
 * Hangs until the request's AbortSignal fires, then rejects with its reason, like the
 * real SDK. `started` resolves when the provider is reached, `observed` when the abort
 * arrives, so a test can cut the client connection at the right moment.
 */
export class WaitForAbort {
  private markStarted!: () => void;
  private markObserved!: () => void;
  readonly started = new Promise<void>((resolve) => {
    this.markStarted = resolve;
  });
  readonly observed = new Promise<void>((resolve) => {
    this.markObserved = resolve;
  });

  wait(signal: AbortSignal | undefined): Promise<never> {
    this.markStarted();
    return new Promise((_resolve, reject) => {
      if (!signal) return; // never settles: a test without a signal would time out
      const onAbort = () => {
        this.markObserved();
        reject(signal.reason);
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}

/** One scripted step: a response, an error to throw, a mid-stream failure, an abort wait, or a function of the request. */
export type ScriptedStep =
  | LLMResponse
  | Error
  | MidStreamFailure
  | WaitForAbort
  | ((request: LLMRequest) => LLMResponse);

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

  private next(request: LLMRequest): Exclude<ScriptedStep, Error> {
    this.requests.push(structuredClone(request));
    const step = this.steps.shift();
    if (!step) throw new Error(`FakeLLMProvider: no scripted response for call #${this.requests.length}`);
    if (step instanceof Error) throw step;
    return step;
  }

  async generate(request: LLMRequest, options?: GenerateOptions): Promise<LLMResponse> {
    const step = this.next(request);
    if (step instanceof MidStreamFailure) throw step.error;
    if (step instanceof WaitForAbort) return step.wait(options?.signal);
    return typeof step === "function" ? step(request) : step;
  }

  /** Streams the text of the scripted response in two chunks, then the response. */
  async *stream(request: LLMRequest, options?: GenerateOptions): AsyncIterable<StreamEvent> {
    const step = this.next(request);
    if (step instanceof WaitForAbort) {
      await step.wait(options?.signal); // always rejects
      return;
    }
    if (step instanceof MidStreamFailure) {
      yield { type: "delta", text: step.text };
      throw step.error;
    }
    const response = typeof step === "function" ? step(request) : step;
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
