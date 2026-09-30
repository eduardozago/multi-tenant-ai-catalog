import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { ConversationModel } from "../src/modules/chat/conversation.model";
import { ProductModel } from "../src/modules/products/product.model";
import { UserModel } from "../src/modules/users/user.model";
import { UserRepository } from "../src/modules/users/user.repository";
import { TenantScopeError } from "../src/shared/errors";
import {
  createMember,
  createProduct,
  createTestApp,
  PASSWORD,
  type ProductBody,
  registerCompany,
  type Session,
} from "./helpers";

const app = createTestApp();

describe("tenant isolation through the API", () => {
  let adminA: Session;
  let adminB: Session;

  beforeEach(async () => {
    adminA = await registerCompany(app, "a");
    adminB = await registerCompany(app, "b");
    await createMember(app, adminA, "user@a.test");
    await createMember(app, adminB, "user@b.test");
  });

  it("admin A lists only company A users", async () => {
    const res = await request(app).get("/users").set("Cookie", adminA.cookie).expect(200);
    const emails = res.body.users.map((u: { email: string }) => u.email).sort();
    expect(emails).toEqual(["admin@a.test", "user@a.test"]);
  });

  it("ignores a company id in the body: the user is created in the caller's company", async () => {
    const companyB = adminB.user.company.id;
    await request(app)
      .post("/users")
      .set("Cookie", adminA.cookie)
      .send({
        name: "Intruder",
        email: "intruder@a.test",
        password: PASSWORD,
        role: "admin",
        company_id: companyB,
        companyId: companyB,
      })
      .expect(201);

    const created = await UserModel.findOne({ email: "intruder@a.test", company_id: adminA.user.company.id }).lean();
    expect(created?.company_id.toString()).toBe(adminA.user.company.id);

    const listB = await request(app).get("/users").set("Cookie", adminB.cookie).expect(200);
    expect(listB.body.users.map((u: { email: string }) => u.email)).not.toContain("intruder@a.test");
  });

  it("repository id lookups do not cross tenants", async () => {
    const repo = new UserRepository();
    expect(await repo.findById(adminB.user.company.id, adminA.user.id)).toBeNull();
    expect(await repo.findById(adminA.user.company.id, adminA.user.id)).not.toBeNull();
  });
});

describe("product isolation through the API", () => {
  let adminA: Session;
  let adminB: Session;
  let productB: ProductBody;

  beforeEach(async () => {
    adminA = await registerCompany(app, "a");
    adminB = await registerCompany(app, "b");
    productB = await createProduct(app, adminB, { name: "Kit Presente B", priceCents: 5000 });
  });

  async function expectProductBUnchanged() {
    const res = await request(app).get(`/products/${productB.id}`).set("Cookie", adminB.cookie).expect(200);
    expect(res.body.product).toEqual(productB);
  }

  it("returns 404 PRODUCT_NOT_FOUND when admin A reads, updates or deletes a company B product", async () => {
    const responses = [
      await request(app).get(`/products/${productB.id}`).set("Cookie", adminA.cookie),
      await request(app).patch(`/products/${productB.id}`).set("Cookie", adminA.cookie).send({ priceCents: 1 }),
      await request(app).delete(`/products/${productB.id}`).set("Cookie", adminA.cookie),
    ];
    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
    }

    await expectProductBUnchanged();
  });

  it("ignores company_id in a PATCH body: the product stays in its company", async () => {
    const productA = await createProduct(app, adminA);

    await request(app)
      .patch(`/products/${productA.id}`)
      .set("Cookie", adminA.cookie)
      .send({ name: "Renomeado", company_id: adminB.user.company.id, companyId: adminB.user.company.id })
      .expect(200);

    const stored = await ProductModel.findOne({ _id: productA.id, company_id: adminA.user.company.id }).lean();
    expect(stored?.name).toBe("Renomeado");
    await request(app).get(`/products/${productA.id}`).set("Cookie", adminB.cookie).expect(404);
  });

  it("ignores company_id in a POST body: the product is created in the caller's company", async () => {
    const created = await createProduct(app, adminA, { company_id: adminB.user.company.id });

    const stored = await ProductModel.findOne({ _id: created.id, company_id: adminA.user.company.id }).lean();
    expect(stored?.createdBy.toString()).toBe(adminA.user.id);
    await request(app).get(`/products/${created.id}`).set("Cookie", adminB.cookie).expect(404);
  });
});

describe("tenantScoped plugin", () => {
  let companyA: string;
  let companyB: string;

  beforeEach(async () => {
    companyA = (await registerCompany(app, "a")).user.company.id;
    companyB = (await registerCompany(app, "b")).user.company.id;
  });

  it.each([
    ["find", () => UserModel.find({})],
    ["findOne by email", () => UserModel.findOne({ email: "admin@a.test" })],
    ["findById", () => UserModel.findById("0".repeat(24))],
    ["countDocuments", () => UserModel.countDocuments({})],
    ["estimatedDocumentCount", () => UserModel.estimatedDocumentCount()],
    ["distinct", () => UserModel.distinct("email")],
    ["updateOne", () => UserModel.updateOne({ email: "admin@a.test" }, { name: "x" })],
    ["updateMany", () => UserModel.updateMany({}, { name: "x" })],
    ["findOneAndUpdate", () => UserModel.findOneAndUpdate({}, { name: "x" })],
    ["replaceOne", () => UserModel.replaceOne({}, { name: "x" })],
    ["deleteOne", () => UserModel.deleteOne({})],
    ["deleteMany", () => UserModel.deleteMany({})],
    ["findOneAndDelete", () => UserModel.findOneAndDelete({})],
  ])("throws on %s without company_id", async (_name, run) => {
    await expect(run()).rejects.toBeInstanceOf(TenantScopeError);
  });

  // Conversations are filtered by userId too, which must not count as a tenant filter.
  it.each([
    ["find by owner", () => ConversationModel.find({ userId: new Types.ObjectId() })],
    ["findOne by id and owner", () => ConversationModel.findOne({ _id: new Types.ObjectId(), userId: new Types.ObjectId() })],
    [
      "updateOne $push",
      () => ConversationModel.updateOne({ _id: new Types.ObjectId() }, { $push: { messages: { role: "user" } } }),
    ],
    ["deleteMany", () => ConversationModel.deleteMany({})],
  ])("throws on Conversation %s without company_id", async (_name, run) => {
    await expect(run()).rejects.toBeInstanceOf(TenantScopeError);
  });

  it("does not accept operators that match other tenants as a tenant filter", async () => {
    await expect(UserModel.find({ company_id: { $ne: companyA } })).rejects.toBeInstanceOf(TenantScopeError);
    await expect(UserModel.find({ company_id: { $exists: true } })).rejects.toBeInstanceOf(TenantScopeError);
    await expect(UserModel.find({ company_id: undefined })).rejects.toBeInstanceOf(TenantScopeError);
  });

  it("requires aggregations to start with a $match on company_id", async () => {
    await expect(UserModel.aggregate([{ $match: {} }])).rejects.toBeInstanceOf(TenantScopeError);
    await expect(
      UserModel.aggregate([{ $sort: { email: 1 } }, { $match: { company_id: companyA } }]),
    ).rejects.toBeInstanceOf(TenantScopeError);

    const rows = await UserModel.aggregate([{ $match: { company_id: new Types.ObjectId(companyA) } }]);
    expect(rows).toHaveLength(1);
  });

  it("allows scoped queries", async () => {
    expect(await UserModel.countDocuments({ company_id: companyA })).toBe(1);
  });

  it("allows an unscoped query only when bypassTenantScope is explicitly true", async () => {
    await expect(UserModel.find({}).setOptions({ bypassTenantScope: false })).rejects.toBeInstanceOf(
      TenantScopeError,
    );
    await expect(UserModel.find({}).setOptions({ bypassTenantScope: "true" })).rejects.toBeInstanceOf(
      TenantScopeError,
    );

    const all = await UserModel.find({}).setOptions({ bypassTenantScope: true }).lean();
    expect(all).toHaveLength(2);
  });

  describe("writes never move or upsert a document into another tenant", () => {
    const newUser = { name: "N", email: "n@a.test", passwordHash: "x", role: "user" };

    it.each([
      ["$set", () => UserModel.updateOne({ company_id: companyA }, { $set: { company_id: companyB } })],
      ["implicit $set", () => UserModel.updateOne({ company_id: companyA }, { company_id: companyB })],
      ["$unset", () => UserModel.updateOne({ company_id: companyA }, { $unset: { company_id: 1 } })],
      [
        "upsert with $set",
        () =>
          UserModel.updateOne(
            { company_id: companyA, email: "n@a.test" },
            { $set: { ...newUser, company_id: companyB } },
            { upsert: true },
          ),
      ],
      [
        "upsert with $setOnInsert",
        () =>
          UserModel.findOneAndUpdate(
            { company_id: companyA, email: "n@a.test" },
            { $setOnInsert: { ...newUser, company_id: companyB } },
            { upsert: true },
          ),
      ],
      [
        "overwriteImmutable",
        () =>
          UserModel.updateOne(
            { company_id: companyA },
            { $set: { company_id: companyB } },
            { overwriteImmutable: true },
          ),
      ],
      [
        "pipeline update",
        () =>
          UserModel.updateOne({ company_id: companyA }, [{ $set: { company_id: companyB } }], {
            updatePipeline: true,
          }),
      ],
      [
        "replaceOne",
        () => UserModel.replaceOne({ company_id: companyA }, { ...newUser, company_id: companyB }),
      ],
      [
        "findOneAndReplace",
        () => UserModel.findOneAndReplace({ company_id: companyA }, { ...newUser, company_id: companyB }),
      ],
    ])("rejects %s targeting another tenant", async (_name, run) => {
      await expect(run()).rejects.toBeInstanceOf(TenantScopeError);

      const all = await UserModel.find({}).setOptions({ bypassTenantScope: true }).lean();
      expect(all.map((d) => [d.email, d.company_id.toString()])).toEqual(
        expect.arrayContaining([
          ["admin@a.test", companyA],
          ["admin@b.test", companyB],
        ]),
      );
      expect(all).toHaveLength(2);
    });

    it("allows updates and upserts within the same tenant", async () => {
      await UserModel.updateOne({ company_id: companyA }, { $set: { name: "Renamed" } });
      await UserModel.updateOne(
        { company_id: companyA, email: "n@a.test" },
        { $setOnInsert: newUser },
        { upsert: true },
      );

      const docs = await UserModel.find({ company_id: companyA }).sort({ email: 1 }).lean();
      expect(docs.map((d) => [d.email, d.name])).toEqual([
        ["admin@a.test", "Renamed"],
        ["n@a.test", "N"],
      ]);
    });

    it("pins company_id on a replacement that omits it", async () => {
      await UserModel.replaceOne({ company_id: companyA, email: "admin@a.test" }, { ...newUser });

      const doc = await UserModel.findOne({ company_id: companyA, email: "n@a.test" }).lean();
      expect(doc?.company_id.toString()).toBe(companyA);
    });
  });

  it("requires company_id on insert", async () => {
    await expect(
      UserModel.create({ name: "No tenant", email: "none@x.test", passwordHash: "x", role: "user" }),
    ).rejects.toThrow(/company_id/);
  });
});

describe("tenantScoped plugin on products", () => {
  let companyA: string;
  let companyB: string;

  beforeEach(async () => {
    const adminA = await registerCompany(app, "a");
    const adminB = await registerCompany(app, "b");
    companyA = adminA.user.company.id;
    companyB = adminB.user.company.id;
    const product = (companyId: string, createdBy: string, category: string) => ({
      company_id: companyId,
      createdBy,
      name: `Product ${category}`,
      priceCents: 1000,
      category,
    });
    await ProductModel.create([
      product(companyA, adminA.user.id, "Brinquedos"),
      product(companyA, adminA.user.id, "Rações"),
      product(companyB, adminB.user.id, "Notebooks"),
    ]);
  });

  it("throws on distinct without company_id", async () => {
    await expect(ProductModel.distinct("category")).rejects.toBeInstanceOf(TenantScopeError);
  });

  it("throws on estimatedDocumentCount, which cannot be filtered by tenant", async () => {
    await expect(ProductModel.estimatedDocumentCount()).rejects.toBeInstanceOf(TenantScopeError);
  });

  it("returns only the tenant's values from a scoped distinct", async () => {
    const categories = await ProductModel.distinct("category", { company_id: companyA });
    expect(categories.sort()).toEqual(["Brinquedos", "Rações"]);
    expect(await ProductModel.distinct("category", { company_id: companyB })).toEqual(["Notebooks"]);
  });
});
