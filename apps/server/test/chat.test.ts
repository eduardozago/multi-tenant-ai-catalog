import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { LLMUnavailableError } from "../src/modules/chat/llm/errors";
import type { LLMRequest } from "../src/modules/chat/llm/types";
import { FakeLLMProvider, textResponse, toolUseResponse } from "./fakes/fake-llm-provider";
import { createMember, createProduct, createTestApp, type ProductBody, registerCompany, type Session } from "./helpers";

const emptySearch = { query: null, category: null, minPrice: null, maxPrice: null, sort: null, limit: null };

let provider: FakeLLMProvider;
let app: ReturnType<typeof createTestApp>;
let adminA: Session;
let userA: Session;
let adminB: Session;

beforeEach(async () => {
  provider = new FakeLLMProvider();
  app = createTestApp({ llmProvider: provider });
  adminA = await registerCompany(app, "a");
  adminB = await registerCompany(app, "b");
  userA = await createMember(app, adminA, "user@a.test");
});

function send(session: Session, body: object) {
  return request(app).post("/chat").set("Cookie", session.cookie).send(body);
}

/** The tool_result contents the model received in a request. */
function toolResultsOf(req: LLMRequest): string[] {
  return req.messages.flatMap((message) =>
    message.content.flatMap((block) => (block.type === "tool_result" ? [block.content] : [])),
  );
}

describe("POST /chat", () => {
  it("answers with data from the caller's company only, even for a name both companies use", async () => {
    const bottleA = await createProduct(app, adminA, { name: "Garrafa Térmica 500ml", priceCents: 5990 });
    const bottleB: ProductBody = await createProduct(app, adminB, { name: "Garrafa Térmica 500ml", priceCents: 9990 });
    provider.push(
      toolUseResponse({
        id: "call_1",
        name: "search_products",
        // A prompt-injected model tries to point the tool at company B.
        input: { ...emptySearch, query: "Garrafa Térmica", company_id: adminB.user.company.id },
      }),
      textResponse("Temos a Garrafa Térmica 500ml por R$ 59,90."),
    );

    const res = await send(userA, { message: "Quanto custa a garrafa térmica?" }).expect(200);

    const [toolResult] = toolResultsOf(provider.requests[1]!);
    expect(toolResult).toContain(bottleA.id);
    expect(toolResult).toContain("R$ 59,90");
    expect(toolResult).not.toContain(bottleB.id);
    expect(toolResult).not.toContain("99,90");

    expect(res.body).toEqual({
      conversationId: expect.stringMatching(/^[a-f\d]{24}$/),
      reply: "Temos a Garrafa Térmica 500ml por R$ 59,90.",
      products: [expect.objectContaining({ id: bottleA.id, priceCents: 5990, imageUrl: bottleA.imageUrl })],
      toolCalls: [
        // The validated input: the injected company_id is not echoed back or stored.
        { name: "search_products", input: { ...emptySearch, query: "Garrafa Térmica" }, resultCount: 1 },
      ],
    });
  });

  it("puts the caller's company name in the system prompt", async () => {
    provider.push(textResponse("Olá!"));
    await send(userA, { message: "oi" }).expect(200);
    expect(provider.requests[0]!.system).toContain('"Company a"');
  });

  it("stores the exchange and continues it with conversationId", async () => {
    provider.push(textResponse("Primeira resposta."), textResponse("Segunda resposta."));

    const first = await send(userA, { message: "Primeira pergunta" }).expect(200);
    const { conversationId } = first.body;
    const second = await send(userA, { message: "Segunda pergunta", conversationId }).expect(200);

    expect(second.body.conversationId).toBe(conversationId);
    expect(provider.requests[1]!.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "Primeira pergunta" }] },
      { role: "assistant", content: [{ type: "text", text: "Primeira resposta." }] },
      { role: "user", content: [{ type: "text", text: "Segunda pergunta" }] },
    ]);

    const res = await request(app).get(`/chat/conversations/${conversationId}`).set("Cookie", userA.cookie).expect(200);
    expect(res.body.conversation).toMatchObject({ id: conversationId, title: "Primeira pergunta" });
    expect(res.body.conversation.messages.map((m: { role: string; content: string }) => [m.role, m.content])).toEqual([
      ["user", "Primeira pergunta"],
      ["assistant", "Primeira resposta."],
      ["user", "Segunda pergunta"],
      ["assistant", "Segunda resposta."],
    ]);
    expect(res.body.conversation).not.toHaveProperty("company_id");
    expect(res.body.conversation).not.toHaveProperty("userId");
  });

  it("sends only the last 10 messages as history", async () => {
    provider.push(textResponse("r1"));
    const { conversationId } = (await send(userA, { message: "q1" }).expect(200)).body;
    for (let i = 2; i <= 6; i++) {
      provider.push(textResponse(`r${i}`));
      await send(userA, { message: `q${i}`, conversationId }).expect(200);
    }
    provider.push(textResponse("r7"));
    await send(userA, { message: "q7", conversationId }).expect(200);

    const texts = provider.requests[6]!.messages.map((m) => (m.content[0]?.type === "text" ? m.content[0].text : ""));
    // 12 stored messages: the oldest exchange (q1, r1) is dropped, then the new question.
    expect(texts).toEqual(["q2", "r2", "q3", "r3", "q4", "r4", "q5", "r5", "q6", "r6", "q7"]);
  });

  it("truncates long titles", async () => {
    provider.push(textResponse("ok"));
    const { conversationId } = (await send(userA, { message: "a".repeat(200) }).expect(200)).body;
    const res = await request(app).get(`/chat/conversations/${conversationId}`).set("Cookie", userA.cookie);
    expect(res.body.conversation.title.length).toBeLessThanOrEqual(60);
  });

  it.each([
    ["empty message", { message: "   " }],
    ["message over 2000 characters", { message: "a".repeat(2001) }],
    ["missing message", {}],
    ["malformed conversationId", { message: "oi", conversationId: "123" }],
  ])("rejects %s with 400 without calling the model", async (_case, body) => {
    const res = await send(userA, body).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(provider.requests).toHaveLength(0);
  });

  it("requires authentication", async () => {
    await request(app).post("/chat").send({ message: "oi" }).expect(401);
  });

  it("returns 502 LLM_UNAVAILABLE when the provider fails, and stores nothing", async () => {
    provider.push(new LLMUnavailableError(new Error("429 rate limited")));

    const res = await send(userA, { message: "oi" }).expect(502);

    expect(res.body).toEqual({
      error: { code: "LLM_UNAVAILABLE", message: expect.any(String) },
    });
    expect(res.body.error.message).not.toContain("429");
    const list = await request(app).get("/chat/conversations").set("Cookie", userA.cookie).expect(200);
    expect(list.body.conversations).toEqual([]);
  });

  it("rate limits per user", async () => {
    const limited = createTestApp({ llmProvider: provider, chatRateLimit: { windowMs: 60_000, limit: 2 } });
    provider.push(textResponse("1"), textResponse("2"), textResponse("3"));
    const post = (session: Session) =>
      request(limited).post("/chat").set("Cookie", session.cookie).send({ message: "oi" });

    await post(userA).expect(200);
    await post(userA).expect(200);
    const res = await post(userA).expect(429);
    expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");
    // Another user (same IP in tests) still has their own budget.
    await post(adminA).expect(200);
  });
});

describe("conversation ownership", () => {
  let conversationId: string;

  beforeEach(async () => {
    provider.push(textResponse("Resposta privada."));
    conversationId = (await send(userA, { message: "Pergunta privada" }).expect(200)).body.conversationId;
  });

  it("another user of the same company gets 404 reading, continuing or listing it", async () => {
    const otherUserA = await createMember(app, adminA, "other@a.test");

    const read = await request(app)
      .get(`/chat/conversations/${conversationId}`)
      .set("Cookie", otherUserA.cookie)
      .expect(404);
    expect(read.body.error.code).toBe("CONVERSATION_NOT_FOUND");
    await send(otherUserA, { message: "continuar", conversationId }).expect(404);
    const list = await request(app).get("/chat/conversations").set("Cookie", otherUserA.cookie).expect(200);
    expect(list.body.conversations).toEqual([]);
    // Ownership is checked before the model is called.
    expect(provider.requests).toHaveLength(1);
  });

  it("a user of another company gets 404 reading, continuing or listing it", async () => {
    await request(app).get(`/chat/conversations/${conversationId}`).set("Cookie", adminB.cookie).expect(404);
    await send(adminB, { message: "continuar", conversationId }).expect(404);
    const list = await request(app).get("/chat/conversations").set("Cookie", adminB.cookie).expect(200);
    expect(list.body.conversations).toEqual([]);
  });

  it("an unknown id is 404 and a malformed one is 400", async () => {
    await request(app).get("/chat/conversations/ffffffffffffffffffffffff").set("Cookie", userA.cookie).expect(404);
    await request(app).get("/chat/conversations/nope").set("Cookie", userA.cookie).expect(400);
  });
});

describe("GET /chat/conversations", () => {
  it("lists the caller's conversations, newest activity first, without messages", async () => {
    provider.push(textResponse("a"), textResponse("b"), textResponse("c"));
    const first = (await send(userA, { message: "Primeira" }).expect(200)).body.conversationId;
    const second = (await send(userA, { message: "Segunda" }).expect(200)).body.conversationId;
    // Continuing the first one moves it to the top.
    await send(userA, { message: "De novo", conversationId: first }).expect(200);

    const res = await request(app).get("/chat/conversations").set("Cookie", userA.cookie).expect(200);

    expect(res.body.conversations.map((c: { id: string }) => c.id)).toEqual([first, second]);
    expect(Object.keys(res.body.conversations[0]).sort()).toEqual(["id", "title", "updatedAt"]);
  });
});
