import type { Response } from "express";

/**
 * Minimal Server-Sent Events writer. Each event is `event: <name>` + one `data:` line
 * of JSON (JSON.stringify never emits raw newlines, so one line is always enough).
 */
export function openEventStream(res: Response) {
  res.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Stops nginx-style proxies from buffering the whole response.
    "X-Accel-Buffering": "no",
  });
  // Sends status and headers now, so the client knows the stream is open before the
  // first model token (which can take seconds).
  res.flushHeaders();

  return {
    send(event: string, data: unknown) {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      if (!res.writableEnded) res.end();
    },
  };
}
