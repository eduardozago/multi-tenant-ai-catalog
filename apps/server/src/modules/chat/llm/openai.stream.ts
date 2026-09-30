import type { ChatCompletionChunk } from "openai/resources/chat/completions";

import { mapFinishReason, toToolUseBlock } from "./openai.mapping";
import type { LLMResponse, Usage } from "./types";

type PartialToolCall = { id: string; name: string; arguments: string };

/**
 * Rebuilds a complete LLMResponse from Chat Completions stream chunks. Pure: fed chunk
 * by chunk, returns each text delta, and `finish()` builds the response.
 *
 * Tool calls arrive fragmented and keyed by `index` (several can be in flight in the
 * same turn): the first fragment carries id and name, later ones only pieces of the
 * `arguments` JSON, which is parsed once, in finish(), when it is complete. With
 * `include_usage`, the last chunk has empty `choices` and only `usage`.
 */
export class StreamAccumulator {
  private text = "";
  private readonly toolCalls = new Map<number, PartialToolCall>();
  private finishReason: string | null = null;
  private usage: Usage = { inputTokens: 0, outputTokens: 0 };

  /** Returns the text delta of this chunk, if any. */
  push(chunk: ChatCompletionChunk): string | undefined {
    if (chunk.usage) {
      this.usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens };
    }

    const choice = chunk.choices[0];
    if (!choice) return undefined;
    if (choice.finish_reason) this.finishReason = choice.finish_reason;

    for (const fragment of choice.delta.tool_calls ?? []) {
      const call = this.toolCalls.get(fragment.index) ?? { id: "", name: "", arguments: "" };
      if (fragment.id) call.id = fragment.id;
      if (fragment.function?.name) call.name += fragment.function.name;
      if (fragment.function?.arguments) call.arguments += fragment.function.arguments;
      this.toolCalls.set(fragment.index, call);
    }

    const delta = choice.delta.content;
    if (delta) this.text += delta;
    return delta || undefined;
  }

  finish(): LLMResponse {
    const content: LLMResponse["content"] = [];
    if (this.text) content.push({ type: "text", text: this.text });
    const calls = [...this.toolCalls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);
    for (const call of calls) content.push(toToolUseBlock(call.id, call.name, call.arguments));
    return { content, stopReason: mapFinishReason(this.finishReason), usage: this.usage };
  }
}
