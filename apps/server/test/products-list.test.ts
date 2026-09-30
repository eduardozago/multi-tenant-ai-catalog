import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { ProductRepository } from "../src/modules/products/product.repository";
import { createMember, createProduct, createTestApp, registerCompany, type Session } from "./helpers";

const app = createTestApp();

// Created in this order, so "newest" is the reverse of it.
const CATALOG_A = [
  { name: "Bola de Borracha", description: "Brinquedo resistente", priceCents: 2990, category: "Brinquedos" },
  { name: "Água Mineral Pet 500ml", description: "Hidratação", priceCents: 490, category: "Acessórios" },
  { name: "Ração Premium 15kg", description: "Para cães adultos", priceCents: 18990, category: "Rações" },
  { name: "Kit Presente (Filhote)", description: "Kit com 3 itens", priceCents: 8990, category: "Kits" },
  { name: "Coleira Ajustável", description: "Nylon com fivela", priceCents: 3990, category: "Acessórios" },
  { name: "Ração Light 3kg", description: "Controle de peso: 50% menos gordura", priceCents: 6990, category: "Rações" },
];

type ListBody = {
  data: { name: string; priceCents: number; category: string }[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

describe("GET /products", () => {
  let adminA: Session;
  let userA: Session;
  let adminB: Session;

  beforeEach(async () => {
    adminA = await registerCompany(app, "a");
    adminB = await registerCompany(app, "b");
    userA = await createMember(app, adminA, "user@a.test", "user");
    for (const product of CATALOG_A) await createProduct(app, adminA, product);
    await createProduct(app, adminB, { name: "Ração Importada B", priceCents: 500, category: "Rações" });
    await createProduct(app, adminB, { name: "Notebook Pro", priceCents: 899000, category: "Notebooks" });
  });

  async function list(query: Record<string, string | number> = {}, session = userA): Promise<ListBody> {
    const res = await request(app).get("/products").query(query).set("Cookie", session.cookie).expect(200);
    return res.body;
  }
  const names = (body: ListBody) => body.data.map((p) => p.name);

  it("lists only the caller's company products, newest first, for any role", async () => {
    const body = await list();
    expect(names(body)).toEqual(CATALOG_A.map((p) => p.name).reverse());
    expect(body.meta).toEqual({ page: 1, limit: 12, total: 6, totalPages: 1 });

    const bodyB = await list({}, adminB);
    expect(names(bodyB)).toEqual(["Notebook Pro", "Ração Importada B"]);
  });

  it("requires authentication", async () => {
    await request(app).get("/products").expect(401);
  });

  it("does not return other tenants' products even when every filter matches them", async () => {
    const body = await list({ search: "Importada", category: "Rações", maxPriceCents: 500 });
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  describe("filters", () => {
    it("searches name and description, case-insensitively", async () => {
      expect(names(await list({ search: "RAÇÃO" }))).toEqual(["Ração Light 3kg", "Ração Premium 15kg"]);
      expect(names(await list({ search: "fivela" }))).toEqual(["Coleira Ajustável"]);
    });

    it("filters by exact category", async () => {
      expect(names(await list({ category: "Acessórios" }))).toEqual(["Coleira Ajustável", "Água Mineral Pet 500ml"]);
      expect(await list({ category: "Acess" })).toMatchObject({ data: [], meta: { total: 0 } });
    });

    it("filters by an inclusive price range", async () => {
      expect(names(await list({ minPriceCents: 3990, maxPriceCents: 8990, sort: "price_asc" }))).toEqual([
        "Coleira Ajustável",
        "Ração Light 3kg",
        "Kit Presente (Filhote)",
      ]);
      expect(names(await list({ minPriceCents: 18990 }))).toEqual(["Ração Premium 15kg"]);
      expect(names(await list({ maxPriceCents: 490 }))).toEqual(["Água Mineral Pet 500ml"]);
    });

    it("combines filters", async () => {
      expect(names(await list({ category: "Rações", maxPriceCents: 10000 }))).toEqual(["Ração Light 3kg"]);
    });

    it("treats empty params as absent", async () => {
      const body = await list({ search: "", category: " ", minPriceCents: "" });
      expect(body.meta.total).toBe(6);
    });
  });

  describe("search input is matched literally", () => {
    it.each([".*", "^", "a+", "[a-z]", "\\", "$where", "(a+)+$", "Kit.*Filhote"])(
      "treats %s as text: no error and no broader match",
      async (search) => {
        expect(await list({ search })).toMatchObject({ data: [], meta: { total: 0 } });
      },
    );

    it("matches metacharacters that are really in the text", async () => {
      expect(names(await list({ search: "(Filhote)" }))).toEqual(["Kit Presente (Filhote)"]);
      expect(names(await list({ search: "50%" }))).toEqual(["Ração Light 3kg"]);
      expect(names(await list({ search: "Pet 500ml" }))).toEqual(["Água Mineral Pet 500ml"]);
    });
  });

  describe("sort", () => {
    it("sorts by price in both directions", async () => {
      const asc = (await list({ sort: "price_asc" })).data.map((p) => p.priceCents);
      expect(asc).toEqual([...asc].sort((a, b) => a - b));
      const desc = (await list({ sort: "price_desc" })).data.map((p) => p.priceCents);
      expect(desc).toEqual([...asc].reverse());
    });

    it("sorts by name with Portuguese collation (accented names are not pushed to the end)", async () => {
      expect(names(await list({ sort: "name_asc" }))).toEqual([
        "Água Mineral Pet 500ml",
        "Bola de Borracha",
        "Coleira Ajustável",
        "Kit Presente (Filhote)",
        "Ração Light 3kg",
        "Ração Premium 15kg",
      ]);
    });
  });

  describe("pagination", () => {
    it("pages through results with consistent meta", async () => {
      const page1 = await list({ limit: 4, sort: "price_asc" });
      const page2 = await list({ limit: 4, page: 2, sort: "price_asc" });
      expect(page1.meta).toEqual({ page: 1, limit: 4, total: 6, totalPages: 2 });
      expect(page2.meta).toEqual({ page: 2, limit: 4, total: 6, totalPages: 2 });
      expect(page1.data).toHaveLength(4);
      expect(page2.data).toHaveLength(2);

      const all = [...names(page1), ...names(page2)];
      expect(new Set(all).size).toBe(6);
    });

    it("returns an empty page past the end instead of an error", async () => {
      expect(await list({ page: 3, limit: 4 })).toEqual({
        data: [],
        meta: { page: 3, limit: 4, total: 6, totalPages: 2 },
      });
    });
  });

  describe("invalid query → 400", () => {
    it.each([
      ["limit above 50", { limit: 51 }],
      ["limit 0", { limit: 0 }],
      ["page 0", { page: 0 }],
      ["non-numeric page", { page: "abc" }],
      ["unknown sort", { sort: "popular" }],
      ["negative price", { minPriceCents: -1 }],
      ["decimal price", { maxPriceCents: 10.5 }],
      ["min above max", { minPriceCents: 1000, maxPriceCents: 999 }],
      ["search too long", { search: "x".repeat(101) }],
    ])("%s", async (_name, query) => {
      const res = await request(app).get("/products").query(query).set("Cookie", userA.cookie).expect(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a repeated param", async () => {
      await request(app).get("/products?search=a&search=b").set("Cookie", userA.cookie).expect(400);
    });
  });

  describe("ProductRepository.search (reused by agent tools)", () => {
    it("clamps page size and page even when called without the HTTP schema", async () => {
      const repo = new ProductRepository();
      const result = await repo.search(adminA.user.company.id, { limit: 1000, page: -5 });
      expect(result).toMatchObject({ page: 1, limit: 50, total: 6 });
      expect(result.items).toHaveLength(6);
    });

    it("applies defaults and stays in the given tenant", async () => {
      const result = await new ProductRepository().search(adminB.user.company.id);
      expect(result).toMatchObject({ page: 1, limit: 12, total: 2 });
      expect(result.items.every((p) => p.companyId === adminB.user.company.id)).toBe(true);
    });
  });
});

describe("GET /products/categories", () => {
  it("returns each tenant's own distinct categories, sorted", async () => {
    const adminA = await registerCompany(app, "a");
    const adminB = await registerCompany(app, "b");
    const userA = await createMember(app, adminA, "user@a.test", "user");
    for (const category of ["Rações", "Brinquedos", "Acessórios", "Rações"]) {
      await createProduct(app, adminA, { category });
    }
    for (const category of ["Notebooks", "Áudio", "Brinquedos"]) {
      await createProduct(app, adminB, { category });
    }

    const resA = await request(app).get("/products/categories").set("Cookie", userA.cookie).expect(200);
    expect(resA.body).toEqual({ categories: ["Acessórios", "Brinquedos", "Rações"] });

    const resB = await request(app).get("/products/categories").set("Cookie", adminB.cookie).expect(200);
    expect(resB.body).toEqual({ categories: ["Áudio", "Brinquedos", "Notebooks"] });
  });

  it("returns an empty list for a company without products", async () => {
    const admin = await registerCompany(app, "empty");
    const res = await request(app).get("/products/categories").set("Cookie", admin.cookie).expect(200);
    expect(res.body).toEqual({ categories: [] });
  });

  it("requires authentication", async () => {
    await request(app).get("/products/categories").expect(401);
  });
});
