import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createTestApp, registerCompany, type Session } from "./helpers";

const app = createTestApp();
const SECRET = process.env.JWT_SECRET!;

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function meWith(token: string) {
  return request(app).get("/auth/me").set("Cookie", `access_token=${token}`);
}

describe("JWT verification", () => {
  let session: Session;
  let claims: { sub: string; companyId: string; role: string };

  beforeEach(async () => {
    session = await registerCompany(app, "acme");
    claims = { sub: session.user.id, companyId: session.user.company.id, role: "admin" };
  });

  it("accepts the token issued at login (sanity check)", async () => {
    const token = session.cookie.split("=")[1]!;
    expect((await meWith(token)).status).toBe(200);
  });

  it("rejects a token with a tampered payload", async () => {
    const [header, , signature] = session.cookie.split("=")[1]!.split(".");
    // Same signature, payload promoted to another tenant.
    const forged = `${header}.${base64url({ ...claims, companyId: "0".repeat(24) })}.${signature}`;

    const res = await meWith(forged);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects a token signed with another secret", async () => {
    const token = jwt.sign(claims, "another-secret-with-at-least-32-characters!!", { algorithm: "HS256" });
    const res = await meWith(token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects an expired token", async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const token = jwt.sign({ ...claims, iat: past - 3600, exp: past }, SECRET, { algorithm: "HS256" });
    const res = await meWith(token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it('rejects an unsigned "alg: none" token', async () => {
    const token = `${base64url({ alg: "none", typ: "JWT" })}.${base64url(claims)}.`;
    const res = await meWith(token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects a correctly signed token with an unexpected payload shape", async () => {
    const token = jwt.sign({ ...claims, role: "superadmin" }, SECRET, { algorithm: "HS256" });
    const res = await meWith(token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});
