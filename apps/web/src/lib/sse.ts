import { ApiError, apiRequest } from "@/lib/api-client";

/** One dispatched Server-Sent Event. `data` is the raw text; the caller parses it. */
export type SseEvent = { event: string; data: string };

/**
 * POSTs `body` as JSON and yields the Server-Sent Events of the response.
 *
 * `fetch` instead of `EventSource`, which can only GET and cannot send a body (D-30).
 * Errors before the stream opens (400, 401, 404, 429) go through `apiRequest`, so they
 * are the same `ApiError`s as any JSON call, and a 401 still ends the session.
 *
 * Aborting `signal` rejects the pending read with an `AbortError`, which is rethrown as
 * is so the caller can tell "stopped" from "failed". Leaving the loop early (break,
 * return, throw in the consumer) cancels the body, which closes the connection.
 */
export async function* streamEvents(
  path: string,
  options: { body: unknown; signal?: AbortSignal },
): AsyncGenerator<SseEvent> {
  const response = await apiRequest(path, { method: "POST", body: options.body, signal: options.signal });
  if (!response.body) throw new ApiError(response.status, "INVALID_STREAM", "Response has no body");

  const reader = response.body.getReader();
  const parser = new SseParser();
  // stream: true keeps a multi-byte character split across two chunks ("ç" is 2 bytes
  // in UTF-8) in the decoder until its second half arrives, instead of emitting U+FFFD.
  const decoder = new TextDecoder();
  let finished = false;

  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
        // The connection dropped mid-answer (network, server restart).
        throw new ApiError(0, "NETWORK_ERROR", "The connection was lost during the stream");
      }
      if (chunk.done) {
        finished = true;
        yield* parser.end(decoder.decode());
        return;
      }
      yield* parser.push(decoder.decode(chunk.value, { stream: true }));
    }
  } finally {
    // Reached when the consumer stops early or on an error: stop the download too.
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/**
 * Incremental parser for the `text/event-stream` format (WHATWG HTML, "Parsing an event
 * stream"). Text arrives in arbitrary chunks, so a line (or even a CRLF pair) can be
 * split between two pushes: only complete lines are processed, the rest is buffered.
 * Supports what the spec requires of a client: LF, CR and CRLF line endings, several
 * `data:` lines per event (joined with "\n"), `:` comments, and the optional space after
 * the colon. `id` and `retry` are ignored: there is no reconnection here.
 */
class SseParser {
  private buffer = "";
  private eventName = "";
  private dataLines: string[] = [];

  *push(text: string): Generator<SseEvent> {
    this.buffer += text;
    let start = 0;
    while (start < this.buffer.length) {
      const lineEnd = this.findLineEnd(start);
      if (lineEnd === -1) break;
      // A CR as the last character may be the first half of a CRLF: wait for the next
      // chunk, or the LF would later be read as an extra empty line (a spurious dispatch).
      if (this.buffer[lineEnd] === "\r" && lineEnd === this.buffer.length - 1) break;

      const event = this.processLine(this.buffer.slice(start, lineEnd));
      if (event) yield event;
      start = lineEnd + (this.buffer.startsWith("\r\n", lineEnd) ? 2 : 1);
    }
    this.buffer = this.buffer.slice(start);
  }

  /** End of stream. An event without its terminating blank line is discarded (per spec). */
  *end(text: string): Generator<SseEvent> {
    yield* this.push(text);
    // Only a lone trailing CR can remain as a complete line here.
    if (this.buffer.endsWith("\r")) {
      const event = this.processLine(this.buffer.slice(0, -1));
      if (event) yield event;
    }
    this.buffer = "";
  }

  private findLineEnd(from: number): number {
    const lf = this.buffer.indexOf("\n", from);
    const cr = this.buffer.indexOf("\r", from);
    if (lf === -1) return cr;
    if (cr === -1) return lf;
    return Math.min(lf, cr);
  }

  private processLine(line: string): SseEvent | null {
    if (line === "") return this.dispatch();
    if (line.startsWith(":")) return null;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") this.eventName = value;
    else if (field === "data") this.dataLines.push(value);
    return null;
  }

  private dispatch(): SseEvent | null {
    // A blank line with no data (e.g. after a comment-only keep-alive) dispatches nothing.
    const event =
      this.dataLines.length === 0 ? null : { event: this.eventName || "message", data: this.dataLines.join("\n") };
    this.eventName = "";
    this.dataLines = [];
    return event;
  }
}
