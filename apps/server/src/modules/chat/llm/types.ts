// Provider-neutral conversation model. The agent loop, the tools and the tests only
// speak these types; each LLMProvider maps them to and from its own API.

export type TextBlock = { type: "text"; text: string };

export type ToolUseBlock = {
  type: "tool_use";
  /** Provider id of the call; the matching tool_result must carry the same id. */
  id: string;
  name: string;
  input: unknown;
  /**
   * Set when the provider could not parse the model's arguments. The registry turns
   * it into a tool error for the model instead of executing (or throwing).
   */
  parseError?: string;
};

export type ToolResultBlock = {
  type: "tool_result";
  toolUseId: string;
  /** JSON-serialized result or error, exactly what the model will read. */
  content: string;
  isError: boolean;
};

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export type Message =
  | { role: "user"; content: Array<TextBlock | ToolResultBlock> }
  | { role: "assistant"; content: Array<TextBlock | ToolUseBlock> };

export type ToolSpec = {
  name: string;
  description: string;
  /** JSON Schema of the input object, strict-mode compatible (see tools/json-schema.ts). */
  inputSchema: Record<string, unknown>;
};

export type StopReason = "end_turn" | "tool_use" | "max_tokens";

export type Usage = { inputTokens: number; outputTokens: number };

export type LLMRequest = {
  system: string;
  messages: Message[];
  tools: ToolSpec[];
};

export type LLMResponse = {
  content: Array<TextBlock | ToolUseBlock>;
  stopReason: StopReason;
  usage: Usage;
};

export type StreamEvent = { type: "delta"; text: string } | { type: "response"; response: LLMResponse };

export type GenerateOptions = { signal?: AbortSignal };

export interface LLMProvider {
  generate(request: LLMRequest, options?: GenerateOptions): Promise<LLMResponse>;
  /** Yields text deltas as they arrive and ends with exactly one `response` event. */
  stream(request: LLMRequest, options?: GenerateOptions): AsyncIterable<StreamEvent>;
}
