import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { LLMUnavailableError } from "../src/modules/chat/llm/errors";
import { FakeLLMProvider, MidStreamFailure, textResponse, toolUseResponse } from "./fakes/fake-llm-provider";
import { createProduct, createTestApp, registerCompany, type Session } from "./helpers";

const emptySearch = { query: null, category: null, minPrice: null, maxPrice: null, sort: null, limit: null };

type SseEvent = { event: string; data: Record<string, unknown> };

/** Parses a complete SSE body into events. */
function parseEvents(body: string): SseEvent[] {
  return body
    .split("\n\n")
    .filter((block) => block.trim() !== "")
    .map((block) => {
      const lines = block.split("\n");
      const event = lines.find((l) => l.startsWith("event: "))!.slice("event: ".length);
      const data = lines.find((l) => l.startsWith("data: "))!.slice("data: ".length);
      return { event, data: JSON.parse(data) };
    });
}

let provider: FakeLLMProvider;
let app: ReturnType<typeof createTestApp>;
let admin: Session;

beforeEach(async () => {
  provider = new FakeLLMProvider();
  app = createTestApp({ llmProvider: provider });
  admin = await registerCompany(app, "a");
});

function stream(body: object, session: Session = admin) {
  return request(app).post("/chat/stream").set("Cookie", session.cookie).send(body);
}

describe("POST /chat/stream", () => {
  it("streams meta, a tool round, text deltas and done, in order, and stores the answer", async () => {
    const bola = await createProduct(app, admin, { name: "Bola Mordedor", priceCents: 3990 });
    provider.push(
      toolUseResponse({ id: "call_1", name: "search_products", input: { ...emptySearch, query: "bola" } }),
      textResponse("Temos a Bola Mordedor por R$ 39,90."),
    );

    const res = await stream({ message: "Tem bola?" }).expect(200);

    expect(res.headers["content-type"]).toMatch(/^text\/event-stream/);
    expect(res.headers["cache-control"]).toContain("no-cache");
    const events = parseEvents(res.text);
    expect(events.map((e) => e.event)).toEqual(["meta", "tool_start", "tool_end", "delta", "delta", "done"]);

    const [meta, toolStart, toolEnd, delta1, delta2, done] = events;
    const conversationId = meta!.data.conversationId as string;
    expect(conversationId).toMatch(/^[a-f\d]{24}$/);
    expect(toolStart!.data).toEqual({ name: "search_products", input: { ...emptySearch, query: "bola" } });
    expect(toolEnd!.data).toEqual({ name: "search_products", resultCount: 1 });
    expect(`${delta1!.data.text}${delta2!.data.text}`).toBe("Temos a Bola Mordedor por R$ 39,90.");
    expect(done!.data).toEqual({
      reply: "Temos a Bola Mordedor por R$ 39,90.",
      products: [expect.objectContaining({ id: bola.id })],
      toolCalls: [{ name: "search_products", input: { ...emptySearch, query: "bola" }, resultCount: 1 }],
    });

    const stored = await request(app).get(`/chat/conversations/${conversationId}`).set("Cookie", admin.cookie);
    expect(stored.status).toBe(200);
    expect(stored.body.conversation.messages).toHaveLength(2);
  });

  it("reports a tool error in tool_end", async () => {
    provider.push(
      toolUseResponse({ id: "call_1", name: "get_product_details", input: { productId: "nope" } }),
      textResponse("Não encontrei esse produto."),
    );

    const events = parseEvents((await stream({ message: "detalhes" }).expect(200)).text);

    expect(events.find((e) => e.event === "tool_end")!.data).toEqual({
      name: "get_product_details",
      error: "product_not_found",
    });
  });

  it("sends an error event when the provider fails mid-stream, and stores nothing", async () => {
    provider.push(new MidStreamFailure("Temos ", new LLMUnavailableError(new Error("connection reset"))));

    const res = await stream({ message: "oi" }).expect(200);

    const events = parseEvents(res.text);
    expect(events.map((e) => e.event)).toEqual(["meta", "delta", "error"]);
    expect(events[2]!.data).toEqual({ code: "LLM_UNAVAILABLE", message: expect.any(String) });
    expect(res.text).not.toContain("connection reset");

    const list = await request(app).get("/chat/conversations").set("Cookie", admin.cookie);
    expect(list.body.conversations).toEqual([]);
  });

  it("hides unexpected errors behind INTERNAL_ERROR", async () => {
    provider.push(new Error("secret internal detail"));

    const res = await stream({ message: "oi" }).expect(200);

    const events = parseEvents(res.text);
    expect(events.at(-1)).toEqual({ event: "error", data: { code: "INTERNAL_ERROR", message: "Internal server error" } });
    expect(res.text).not.toContain("secret internal detail");
  });

  it("continues an existing conversation and reuses its id in meta", async () => {
    provider.push(textResponse("Primeira."), textResponse("Segunda."));
    const first = parseEvents((await stream({ message: "q1" }).expect(200)).text);
    const conversationId = first[0]!.data.conversationId;

    const second = parseEvents((await stream({ message: "q2", conversationId }).expect(200)).text);

    expect(second[0]!.data).toEqual({ conversationId });
    expect(provider.requests[1]!.messages).toHaveLength(3);
  });

  describe("errors before the stream opens are plain JSON", () => {
    it("400 for invalid input", async () => {
      const res = await stream({ message: "" }).expect(400);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("401 without a session", async () => {
      await request(app).post("/chat/stream").send({ message: "oi" }).expect(401);
    });

    it("404 for a conversation of another company, without calling the model", async () => {
      provider.push(textResponse("Privado."));
      const conversationId = parseEvents((await stream({ message: "q" }).expect(200)).text)[0]!.data.conversationId;
      const other = await registerCompany(app, "b");

      const res = await stream({ message: "continuar", conversationId }, other).expect(404);

      expect(res.body.error.code).toBe("CONVERSATION_NOT_FOUND");
      expect(provider.requests).toHaveLength(1);
    });
  });
});
