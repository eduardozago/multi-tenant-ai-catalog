import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createMember, createTestApp, PASSWORD, registerCompany, type Session } from "./helpers";

const app = createTestApp();

describe("roles on /users", () => {
  let admin: Session;
  let member: Session;

  beforeEach(async () => {
    admin = await registerCompany(app, "acme");
    member = await createMember(app, admin, "user@acme.test", "user");
  });

  it("forbids a user from listing users", async () => {
    const res = await request(app).get("/users").set("Cookie", member.cookie).expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("forbids a user from creating users", async () => {
    const res = await request(app)
      .post("/users")
      .set("Cookie", member.cookie)
      .send({ name: "X", email: "x@acme.test", password: PASSWORD, role: "admin" })
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lets an admin list users", async () => {
    const res = await request(app).get("/users").set("Cookie", admin.cookie).expect(200);
    expect(res.body.users.map((u: { email: string }) => u.email)).toEqual([
      "admin@acme.test",
      "user@acme.test",
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("lets an admin create users", async () => {
    const res = await request(app)
      .post("/users")
      .set("Cookie", admin.cookie)
      .send({ name: "Bia", email: "bia@acme.test", password: PASSWORD, role: "user" })
      .expect(201);
    expect(res.body.user).toMatchObject({ name: "Bia", email: "bia@acme.test", role: "user" });
  });

  it("returns 409 EMAIL_TAKEN when an admin reuses an email from any tenant", async () => {
    await registerCompany(app, "other");
    const res = await request(app)
      .post("/users")
      .set("Cookie", admin.cookie)
      .send({ name: "Dup", email: "admin@other.test", password: PASSWORD, role: "user" })
      .expect(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("requires authentication before authorization", async () => {
    const res = await request(app).get("/users").expect(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
