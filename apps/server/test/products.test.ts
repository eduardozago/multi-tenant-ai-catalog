import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { ProductRepository } from "../src/modules/products/product.repository";
import {
  createMember,
  createProduct,
  createTestApp,
  registerCompany,
  type Session,
  validProduct,
} from "./helpers";

const app = createTestApp();

describe("products CRUD", () => {
  let admin: Session;
  let member: Session;

  beforeEach(async () => {
    admin = await registerCompany(app, "acme");
    member = await createMember(app, admin, "user@acme.test", "user");
  });

  const createOwnProduct = (overrides: Record<string, unknown> = {}) => createProduct(app, admin, overrides);

  it("lets an admin create, read, update and delete a product", async () => {
    const created = await createOwnProduct();
    expect(created).toEqual({
      id: expect.any(String),
      ...validProduct,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const read = await request(app).get(`/products/${created.id}`).set("Cookie", admin.cookie).expect(200);
    expect(read.body.product).toEqual(created);

    const updated = await request(app)
      .patch(`/products/${created.id}`)
      .set("Cookie", admin.cookie)
      .send({ priceCents: 15990, name: "  Ração Premium 15kg  " })
      .expect(200);
    expect(updated.body.product).toMatchObject({
      ...validProduct,
      priceCents: 15990,
      name: "Ração Premium 15kg",
    });

    await request(app).delete(`/products/${created.id}`).set("Cookie", admin.cookie).expect(204);
    const gone = await request(app).get(`/products/${created.id}`).set("Cookie", admin.cookie).expect(404);
    expect(gone.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("does not expose internal fields", async () => {
    const created = await createOwnProduct();
    const res = await request(app).get(`/products/${created.id}`).set("Cookie", admin.cookie).expect(200);
    expect(Object.keys(res.body.product).sort()).toEqual(
      ["category", "createdAt", "description", "id", "imageUrl", "name", "priceCents", "updatedAt"].sort(),
    );
  });

  it("returns imageUrl null when the product has no image, and PATCH null removes it", async () => {
    const noImage = await createOwnProduct({ imageUrl: undefined });
    expect(noImage.imageUrl).toBeNull();

    const withImage = await createOwnProduct();
    const res = await request(app)
      .patch(`/products/${withImage.id}`)
      .set("Cookie", admin.cookie)
      .send({ imageUrl: null })
      .expect(200);
    expect(res.body.product.imageUrl).toBeNull();
  });

  describe("roles", () => {
    it("lets a user read a product", async () => {
      const created = await createOwnProduct();
      await request(app).get(`/products/${created.id}`).set("Cookie", member.cookie).expect(200);
    });

    it("forbids a user from creating, updating or deleting", async () => {
      const created = await createOwnProduct();

      const responses = [
        await request(app).post("/products").set("Cookie", member.cookie).send(validProduct),
        await request(app).patch(`/products/${created.id}`).set("Cookie", member.cookie).send({ priceCents: 1 }),
        await request(app).delete(`/products/${created.id}`).set("Cookie", member.cookie),
      ];
      for (const res of responses) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN");
      }

      const after = await request(app).get(`/products/${created.id}`).set("Cookie", admin.cookie).expect(200);
      expect(after.body.product).toEqual(created);
    });

    it("requires authentication", async () => {
      await request(app).get(`/products/${"a".repeat(24)}`).expect(401);
    });
  });

  describe("validation", () => {
    it.each([
      ["negative price", { priceCents: -1 }],
      ["non-integer price", { priceCents: 10.5 }],
      ["price as string", { priceCents: "100" }],
      ["invalid URL", { imageUrl: "not a url" }],
      ["non-http URL", { imageUrl: "javascript:alert(1)" }],
      // Accepted by z.url() alone but rejected by the model: used to surface as a 500.
      ["URL with a space", { imageUrl: "https://a.com/foo bar.png" }],
      ["empty name", { name: "   " }],
      ["name too short", { name: "A" }],
      ["missing category", { category: undefined }],
    ])("rejects %s on create with 400", async (_name, override) => {
      const res = await request(app)
        .post("/products")
        .set("Cookie", admin.cookie)
        .send({ ...validProduct, ...override })
        .expect(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it.each([
      ["negative price", { priceCents: -1 }],
      ["non-integer price", { priceCents: 0.1 }],
      ["invalid URL", { imageUrl: "ftp://example.com/a.png" }],
      ["URL with a space", { imageUrl: "https://a.com/foo bar.png" }],
      ["empty name", { name: "" }],
      ["empty body", {}],
      ["only unknown fields", { company_id: "a".repeat(24) }],
    ])("rejects %s on update with 400", async (_name, body) => {
      const created = await createOwnProduct();
      const res = await request(app)
        .patch(`/products/${created.id}`)
        .set("Cookie", admin.cookie)
        .send(body)
        .expect(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for a malformed id and 404 for an unknown one", async () => {
      for (const method of ["get", "patch", "delete"] as const) {
        const bad = await request(app)[method]("/products/not-an-id").set("Cookie", admin.cookie).send({ name: "Novo nome" });
        expect(bad.status).toBe(400);

        const missing = await request(app)
          [method](`/products/${"a".repeat(24)}`)
          .set("Cookie", admin.cookie)
          .send({ name: "Novo nome" });
        expect(missing.status).toBe(404);
        expect(missing.body.error.code).toBe("PRODUCT_NOT_FOUND");
      }
    });
  });

  it("enforces schema validators on repository updates, below the zod layer", async () => {
    const created = await createOwnProduct();
    const repo = new ProductRepository();
    const companyId = admin.user.company.id;

    await expect(repo.update(companyId, created.id, { priceCents: -1 })).rejects.toThrow(/priceCents/);
    await expect(repo.update(companyId, created.id, { priceCents: 1.5 })).rejects.toThrow(/integer/);
    await expect(repo.update(companyId, created.id, { imageUrl: "ftp://x" })).rejects.toThrow(/imageUrl/);
  });
});
