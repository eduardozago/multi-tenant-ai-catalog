import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolUseBlock } from "../../src/modules/chat/llm/types";
import { toStrictJsonSchema } from "../../src/modules/chat/tools/json-schema";
import { createCatalogToolRegistry, type ToolRegistry } from "../../src/modules/chat/tools/registry";
import { reaisToCents } from "../../src/modules/chat/tools/search-products";
import type { CatalogReader, ToolContext } from "../../src/modules/chat/tools/tool";
import { type Product, ProductRepository } from "../../src/modules/products/product.repository";
import { z } from "zod";

const COMPANY_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const PRODUCT_ID = "cccccccccccccccccccccccc";
const ctx: ToolContext = { companyId: COMPANY_A, userId: "dddddddddddddddddddddddd" };

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: PRODUCT_ID,
    companyId: COMPANY_A,
    name: "Bola Mordedor de Borracha",
    description: "Bola resistente para cães.",
    priceCents: 3990,
    category: "Brinquedos",
    imageUrl: "https://example.com/bola.jpg",
    createdBy: ctx.userId,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function fakeRepository() {
  return {
    search: vi.fn<CatalogReader["search"]>(async () => ({ items: [product()], total: 1, page: 1, limit: 8 })),
    findById: vi.fn<CatalogReader["findById"]>(async () => product()),
    listCategories: vi.fn<CatalogReader["listCategories"]>(async () => ["Brinquedos", "Rações"]),
  };
}

let repo: ReturnType<typeof fakeRepository>;
let registry: ToolRegistry;

beforeEach(() => {
  repo = fakeRepository();
  registry = createCatalogToolRegistry(repo);
});

let callSeq = 0;
function call(name: string, input: unknown, extra: Partial<ToolUseBlock> = {}): ToolUseBlock {
  callSeq += 1;
  return { type: "tool_use", id: `call_${callSeq}`, name, input, ...extra };
}

const emptySearch = { query: null, category: null, minPrice: null, maxPrice: null, sort: null, limit: null };

function parsed(content: string) {
  return JSON.parse(content) as Record<string, unknown>;
}

describe("tool specs", () => {
  it("exposes the three catalog tools", () => {
    expect(registry.specs().map((spec) => spec.name)).toEqual([
      "search_products",
      "get_product_details",
      "list_categories",
    ]);
  });

  it("are strict-compatible: every property required, no additional properties", () => {
    for (const spec of registry.specs()) {
      const schema = spec.inputSchema as { properties: object; required: string[]; additionalProperties: boolean };
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort());
    }
  });

  it("contain no string length keywords, which strict mode rejects", () => {
    const serialized = JSON.stringify(registry.specs().map((spec) => spec.inputSchema));
    expect(serialized).not.toMatch(/minLength|maxLength/);
  });

  it("still enforce string limits through zod", async () => {
    const execution = await registry.execute(call("search_products", { ...emptySearch, query: "a".repeat(101) }), ctx);
    expect(execution.error).toBe("invalid_input");
  });

  it("never contain a tenant identifier", () => {
    const serialized = JSON.stringify(registry.specs().map((spec) => spec.inputSchema));
    expect(serialized).not.toMatch(/company/i);
  });

  it("rejects an optional (non-nullable) field when the schema is built", () => {
    expect(() => toStrictJsonSchema(z.object({ query: z.string().optional() }))).toThrow(/use \.nullable\(\)/);
  });
});

describe("tenant context", () => {
  it("passes ctx.companyId to the repository, whatever the model sends", async () => {
    const input = { ...emptySearch, company_id: COMPANY_B, companyId: COMPANY_B };

    const execution = await registry.execute(call("search_products", input), ctx);

    expect(execution.error).toBeUndefined();
    expect(repo.search).toHaveBeenCalledTimes(1);
    const [companyId, filters] = repo.search.mock.calls[0]!;
    expect(companyId).toBe(COMPANY_A);
    expect(JSON.stringify(filters)).not.toContain(COMPANY_B);
  });

  it("uses ctx.companyId for details and categories too", async () => {
    await registry.execute(call("get_product_details", { productId: PRODUCT_ID, company_id: COMPANY_B }), ctx);
    await registry.execute(call("list_categories", { companyId: COMPANY_B }), ctx);

    expect(repo.findById).toHaveBeenCalledWith(COMPANY_A, PRODUCT_ID);
    expect(repo.listCategories).toHaveBeenCalledWith(COMPANY_A);
  });
});

describe("search_products", () => {
  it("treats null fields as absent and applies the default limit", async () => {
    await registry.execute(call("search_products", emptySearch), ctx);

    expect(repo.search).toHaveBeenCalledWith(COMPANY_A, {
      search: undefined,
      category: undefined,
      minPriceCents: undefined,
      maxPriceCents: undefined,
      sort: undefined,
      limit: 8,
    });
  });

  it("converts reais to cents and passes the other filters", async () => {
    await registry.execute(
      call("search_products", {
        query: "ração",
        category: "Rações",
        minPrice: 49.9,
        maxPrice: 100,
        sort: "price_asc",
        limit: 5,
      }),
      ctx,
    );

    expect(repo.search).toHaveBeenCalledWith(COMPANY_A, {
      search: "ração",
      category: "Rações",
      minPriceCents: 4990,
      maxPriceCents: 10000,
      sort: "price_asc",
      limit: 5,
    });
  });

  it.each([
    [0, 0],
    [12.34, 1234],
    [0.1 + 0.2, 30],
    [19.999, 2000],
  ])("reaisToCents(%s) = %s", (reais, cents) => {
    expect(reaisToCents(reais)).toBe(cents);
  });

  it("caps the limit at 20", async () => {
    await registry.execute(call("search_products", { ...emptySearch, limit: 500 }), ctx);
    expect(repo.search.mock.calls[0]![1]).toMatchObject({ limit: 20 });
  });

  it("returns only projected fields, price in BRL and a truncated description", async () => {
    repo.search.mockResolvedValueOnce({
      items: [product({ description: "x".repeat(500) })],
      total: 12,
      page: 1,
      limit: 8,
    });

    const execution = await registry.execute(call("search_products", emptySearch), ctx);
    const content = parsed(execution.result.content) as { total: number; count: number; products: object[] };

    expect(content.total).toBe(12);
    expect(content.count).toBe(1);
    const [view] = content.products as Array<Record<string, unknown>>;
    expect(Object.keys(view!).sort()).toEqual(["category", "description", "id", "name", "price", "priceCents"]);
    expect(view!.price).toBe("R$ 39,90");
    expect((view!.description as string).length).toBeLessThanOrEqual(200);
    expect(execution.resultCount).toBe(1);
    // Full DTO (with imageUrl) goes to the UI, not to the model.
    expect(execution.products[0]).toMatchObject({ id: PRODUCT_ID, imageUrl: "https://example.com/bola.jpg" });
    expect(execution.result.content).not.toContain("imageUrl");
    expect(execution.result.content).not.toContain(COMPANY_A);
  });

  it("rejects minPrice greater than maxPrice as a tool error", async () => {
    const execution = await registry.execute(call("search_products", { ...emptySearch, minPrice: 100, maxPrice: 10 }), ctx);
    expect(execution.error).toBe("invalid_input");
    expect(repo.search).not.toHaveBeenCalled();
  });
});

describe("get_product_details", () => {
  it("returns the full description", async () => {
    repo.findById.mockResolvedValueOnce(product({ description: "y".repeat(500) }));

    const execution = await registry.execute(call("get_product_details", { productId: PRODUCT_ID }), ctx);

    const { product: view } = parsed(execution.result.content) as { product: { description: string } };
    expect(view.description).toHaveLength(500);
  });

  it("returns product_not_found for an unknown id", async () => {
    repo.findById.mockResolvedValueOnce(null);

    const execution = await registry.execute(call("get_product_details", { productId: PRODUCT_ID }), ctx);

    expect(execution.error).toBe("product_not_found");
    expect(execution.result).toMatchObject({ isError: true, content: '{"error":"product_not_found"}' });
  });

  it("returns product_not_found for a malformed id without querying", async () => {
    const execution = await registry.execute(call("get_product_details", { productId: "not-an-id" }), ctx);

    expect(execution.error).toBe("product_not_found");
    expect(repo.findById).not.toHaveBeenCalled();
  });
});

describe("list_categories", () => {
  it("returns the categories and their count", async () => {
    const execution = await registry.execute(call("list_categories", {}), ctx);

    expect(parsed(execution.result.content)).toEqual({ categories: ["Brinquedos", "Rações"] });
    expect(execution.resultCount).toBe(2);
  });
});

describe("tool errors instead of exceptions", () => {
  it("invalid input becomes invalid_input with details", async () => {
    const execution = await registry.execute(call("search_products", { ...emptySearch, limit: "ten" }), ctx);

    expect(execution.error).toBe("invalid_input");
    expect(execution.result.isError).toBe(true);
    expect(parsed(execution.result.content).details).toEqual([{ path: "limit", message: expect.any(String) }]);
    expect(repo.search).not.toHaveBeenCalled();
  });

  it("unparseable arguments become invalid_arguments", async () => {
    const execution = await registry.execute(
      call("search_products", null, { parseError: "Arguments are not valid JSON" }),
      ctx,
    );
    expect(execution.error).toBe("invalid_arguments");
    expect(repo.search).not.toHaveBeenCalled();
  });

  it("an unknown tool becomes unknown_tool and lists the available ones", async () => {
    const execution = await registry.execute(call("delete_everything", {}), ctx);

    expect(execution.error).toBe("unknown_tool");
    expect(parsed(execution.result.content).details).toEqual({
      available: ["search_products", "get_product_details", "list_categories"],
    });
  });

  it("keeps the call id on error results", async () => {
    const toolCall = call("delete_everything", {});
    const execution = await registry.execute(toolCall, ctx);
    expect(execution.result.toolUseId).toBe(toolCall.id);
  });

  it("rethrows unexpected failures instead of hiding them from the logs", async () => {
    repo.listCategories.mockRejectedValueOnce(new Error("connection lost"));
    await expect(registry.execute(call("list_categories", {}), ctx)).rejects.toThrow("connection lost");
  });
});

describe("isolation against the real repository", () => {
  it("a tenant A context never sees tenant B products, even when the model asks for them", async () => {
    const products = new ProductRepository();
    const shared = { description: "", category: "Garrafas", createdBy: ctx.userId };
    const mine = await products.create(COMPANY_A, { ...shared, name: "Garrafa Térmica A", priceCents: 1000 });
    const theirs = await products.create(COMPANY_B, { ...shared, name: "Garrafa Térmica B", priceCents: 2000 });
    const realRegistry = createCatalogToolRegistry(products);

    const search = await realRegistry.execute(
      call("search_products", { ...emptySearch, query: "Garrafa", company_id: COMPANY_B }),
      ctx,
    );
    const details = await realRegistry.execute(call("get_product_details", { productId: theirs.id }), ctx);
    const categories = await realRegistry.execute(call("list_categories", {}), ctx);

    expect(search.products.map((p) => p.id)).toEqual([mine.id]);
    expect(search.result.content).not.toContain(theirs.id);
    expect(details.error).toBe("product_not_found");
    expect(parsed(categories.result.content)).toEqual({ categories: ["Garrafas"] });
  });
});
