import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type AgentEvent,
  AgentIterationLimitError,
  AgentService,
  selectMentionedProducts,
} from "../../src/modules/chat/agent.service";
import { LLMUnavailableError } from "../../src/modules/chat/llm/errors";
import type { Message } from "../../src/modules/chat/llm/types";
import { createCatalogToolRegistry } from "../../src/modules/chat/tools/registry";
import type { CatalogReader, ToolContext } from "../../src/modules/chat/tools/tool";
import type { ProductDto } from "../../src/modules/products/product.dto";
import type { Product } from "../../src/modules/products/product.repository";
import { logger } from "../../src/shared/logger";
import { FakeLLMProvider, textResponse, toolUseResponse } from "../fakes/fake-llm-provider";

const ctx: ToolContext = { companyId: "aaaaaaaaaaaaaaaaaaaaaaaa", userId: "dddddddddddddddddddddddd" };
const emptySearch = { query: null, category: null, minPrice: null, maxPrice: null, sort: null, limit: null };

function product(id: string, name: string, priceCents = 1000): Product {
  return {
    id,
    companyId: ctx.companyId,
    name,
    description: `Descrição de ${name}`,
    priceCents,
    category: "Brinquedos",
    imageUrl: null,
    createdBy: ctx.userId,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

const BOLA = product("111111111111111111111111", "Bola Mordedor", 3990);
const CORDA = product("222222222222222222222222", "Corda Cabo de Guerra", 2490);

function fakeRepository(overrides: Partial<CatalogReader> = {}): CatalogReader {
  return {
    search: async () => ({ items: [BOLA, CORDA], total: 2, page: 1, limit: 8 }),
    findById: async (_companyId, id) => [BOLA, CORDA].find((p) => p.id === id) ?? null,
    listCategories: async () => ["Brinquedos"],
    ...overrides,
  };
}

function setup(steps: ConstructorParameters<typeof FakeLLMProvider>[0], repo = fakeRepository(), maxIterations = 5) {
  const provider = new FakeLLMProvider(steps);
  const agent = new AgentService(provider, createCatalogToolRegistry(repo), { maxIterations });
  return { provider, agent };
}

const run = (agent: AgentService, extra: { history?: Message[]; onEvent?: (e: AgentEvent) => void } = {}) =>
  agent.run({ ctx, companyName: "Pet Feliz", history: [], message: "Quais brinquedos vocês têm?", ...extra });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AgentService.run", () => {
  it("answers directly when the model needs no tool", async () => {
    const { agent, provider } = setup([textResponse("Olá! Posso ajudar com o catálogo.")]);

    const result = await run(agent);

    expect(result).toMatchObject({ reply: "Olá! Posso ajudar com o catálogo.", iterations: 1, toolCalls: [] });
    const [request] = provider.requests;
    expect(request!.system).toContain('"Pet Feliz"');
    expect(request!.tools.map((tool) => tool.name)).toEqual([
      "search_products",
      "get_product_details",
      "list_categories",
    ]);
  });

  it("runs a tool round, sends the result back and returns the final answer", async () => {
    const { agent, provider } = setup([
      toolUseResponse({ id: "call_1", name: "search_products", input: { ...emptySearch, query: "brinquedo" } }),
      textResponse("Temos a **Bola Mordedor** por R$ 39,90."),
    ]);

    const result = await run(agent);

    expect(result.reply).toBe("Temos a **Bola Mordedor** por R$ 39,90.");
    expect(result.iterations).toBe(2);
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 10 });
    expect(result.toolCalls).toEqual([
      { name: "search_products", input: { ...emptySearch, query: "brinquedo" }, resultCount: 2 },
    ]);

    // Second call: user message, assistant tool_use turn, then its tool_result.
    const second = provider.requests[1]!;
    expect(second.messages).toHaveLength(3);
    expect(second.messages[1]).toMatchObject({ role: "assistant", content: [{ type: "tool_use", id: "call_1" }] });
    const toolTurn = second.messages[2]!;
    expect(toolTurn.role).toBe("user");
    expect(toolTurn.content).toEqual([
      { type: "tool_result", toolUseId: "call_1", isError: false, content: expect.stringContaining("Bola Mordedor") },
    ]);
  });

  it("runs two tool calls of the same turn in parallel and returns both results with matching ids", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const tracked =
      <T>(value: T) =>
      async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight -= 1;
        return value;
      };
    const repo = fakeRepository({
      search: tracked({ items: [BOLA], total: 1, page: 1, limit: 8 }),
      listCategories: tracked(["Brinquedos"]),
    });
    const { agent, provider } = setup(
      [
        toolUseResponse(
          { id: "call_search", name: "search_products", input: emptySearch },
          { id: "call_categories", name: "list_categories", input: {} },
        ),
        textResponse("Pronto."),
      ],
      repo,
    );

    const result = await run(agent);

    expect(maxInFlight).toBe(2);
    expect(result.toolCalls.map((call) => call.name)).toEqual(["search_products", "list_categories"]);
    const toolTurn = provider.requests[1]!.messages[2]!;
    expect(toolTurn.content.map((block) => block.type === "tool_result" && block.toolUseId)).toEqual([
      "call_search",
      "call_categories",
    ]);
  });

  it("sends a tool error back to the model and keeps looping", async () => {
    const { agent, provider } = setup([
      toolUseResponse({ id: "call_1", name: "get_product_details", input: { productId: "999999999999999999999999" } }),
      toolUseResponse({ id: "call_2", name: "search_products", input: { ...emptySearch, query: "bola" } }),
      textResponse("Encontrei a Bola Mordedor."),
    ]);

    const result = await run(agent);

    expect(result.iterations).toBe(3);
    expect(result.toolCalls).toEqual([
      { name: "get_product_details", input: { productId: "999999999999999999999999" }, error: "product_not_found" },
      { name: "search_products", input: { ...emptySearch, query: "bola" }, resultCount: 2 },
    ]);
    expect(provider.requests[1]!.messages[2]!.content).toEqual([
      { type: "tool_result", toolUseId: "call_1", isError: true, content: '{"error":"product_not_found"}' },
    ]);
  });

  it("throws AgentIterationLimitError when the model keeps calling tools", async () => {
    const keepCalling = () => toolUseResponse({ id: "call", name: "list_categories", input: {} });
    const { agent, provider } = setup([keepCalling, keepCalling, keepCalling, keepCalling], fakeRepository(), 3);

    await expect(run(agent)).rejects.toBeInstanceOf(AgentIterationLimitError);
    expect(provider.requests).toHaveLength(3);
  });

  it("only returns products whose name appears in the reply", async () => {
    const { agent } = setup([
      toolUseResponse({ id: "call_1", name: "search_products", input: emptySearch }),
      textResponse("Recomendo a corda cabo de guerra, ótima para brincar."),
    ]);

    const result = await run(agent);

    expect(result.products.map((p) => p.id)).toEqual([CORDA.id]);
  });

  it("passes the history before the new message", async () => {
    const history: Message[] = [
      { role: "user", content: [{ type: "text", text: "oi" }] },
      { role: "assistant", content: [{ type: "text", text: "Olá!" }] },
    ];
    const { agent, provider } = setup([textResponse("Claro.")]);

    await run(agent, { history });

    expect(provider.requests[0]!.messages).toEqual([
      ...history,
      { role: "user", content: [{ type: "text", text: "Quais brinquedos vocês têm?" }] },
    ]);
    expect(history).toHaveLength(2);
  });

  it("emits tool_start and tool_end for each call", async () => {
    const events: AgentEvent[] = [];
    const { agent } = setup([
      toolUseResponse({ id: "call_1", name: "list_categories", input: {} }),
      textResponse("Temos Brinquedos."),
    ]);

    await run(agent, { onEvent: (event) => events.push(event) });

    expect(events).toEqual([
      { type: "tool_start", name: "list_categories", input: {} },
      { type: "tool_end", name: "list_categories", input: {}, resultCount: 1 },
    ]);
  });

  it("uses a fallback reply when the model returns no text", async () => {
    const { agent } = setup([{ content: [], stopReason: "max_tokens", usage: { inputTokens: 1, outputTokens: 1 } }]);
    expect((await run(agent)).reply).toMatch(/reformular/);
  });

  it("propagates provider failures", async () => {
    const { agent } = setup([new LLMUnavailableError()]);
    await expect(run(agent)).rejects.toBeInstanceOf(LLMUnavailableError);
  });

  it("logs run metadata without message content", async () => {
    const info = vi.spyOn(logger, "info");
    const { agent } = setup([
      toolUseResponse({ id: "call_1", name: "list_categories", input: {} }),
      textResponse("Temos Brinquedos."),
    ]);

    await run(agent);

    expect(info).toHaveBeenCalledWith("agent_run", {
      companyId: ctx.companyId,
      userId: ctx.userId,
      outcome: "end_turn",
      iterations: 2,
      tools: ["list_categories"],
      inputTokens: 20,
      outputTokens: 10,
      latencyMs: expect.any(Number),
    });
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).not.toContain("Quais brinquedos");
    expect(logged).not.toContain("Temos Brinquedos");
  });
});

describe("selectMentionedProducts", () => {
  const dto = (p: Product): ProductDto => ({ ...p });

  it("matches case-insensitively, deduplicates and keeps the order of mention", () => {
    const reply = "A CORDA CABO DE GUERRA custa menos que a bola mordedor.";
    const selected = selectMentionedProducts(reply, [dto(BOLA), dto(CORDA), dto(BOLA)]);
    expect(selected.map((p) => p.name)).toEqual(["Corda Cabo de Guerra", "Bola Mordedor"]);
  });

  it("returns at most 6 products", () => {
    const many = Array.from({ length: 8 }, (_, i) => dto(product(String(i).repeat(24), `Produto ${i}X`)));
    const reply = many.map((p) => p.name).join(", ");
    expect(selectMentionedProducts(reply, many)).toHaveLength(6);
  });
});
