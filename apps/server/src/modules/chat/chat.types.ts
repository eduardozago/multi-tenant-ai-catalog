// Types shared by the agent, the chat service, the controller and the conversation
// model. Kept apart from agent.service.ts so the data layer does not depend on a service.

/** One tool call as shown to the user ("searched products: 3 results"). */
export type ToolCallSummary = {
  name: string;
  input: unknown;
  resultCount?: number;
  error?: string;
};

/** Progress events for streaming clients. */
export type AgentEvent =
  | { type: "tool_start"; name: string; input: unknown }
  | ({ type: "tool_end" } & ToolCallSummary)
  /** Text as the model writes it (stream mode only). */
  | { type: "delta"; text: string };
