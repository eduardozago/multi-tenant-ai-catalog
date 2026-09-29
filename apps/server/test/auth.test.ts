import request from "supertest";
import { describe, expect, it } from "vitest";

import { CompanyModel } from "../src/modules/companies/company.model";
import { UserModel } from "../src/modules/users/user.model";
import { authCookie, createTestApp, PASSWORD, registerCompany } from "./helpers";

const app = createTestApp();

describe("POST /auth/register", () => {
  it("creates the company and its admin, sets an httpOnly cookie and returns no token", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ companyName: "Acme", name: "Ana", email: "  Ana@Acme.TEST ", password: PASSWORD })
      .expect(201);

    const setCookie = ([] as string[]).concat(res.headers["set-cookie"] ?? []).join(";");
    expect(setCookie).toMatch(/access_token=[^;]+/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(/Max-Age=3600/); // JWT_EXPIRES_IN=1h in vitest.config
    expect(setCookie).not.toMatch(/Secure/i); // only in production

    expect(res.body).toEqual({
      user: {
        id: expect.any(String),
        name: "Ana",
        email: "ana@acme.test",
        role: "admin",
        company: { id: expect.any(String), name: "Acme" },
      },
    });
    const token = authCookie(res).split("=")[1]!;
    expect(JSON.stringify(res.body)).not.toContain(token);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("rejects a duplicate email (case-insensitive) with 409 and leaves no orphan company", async () => {
    await registerCompany(app, "acme");

    const res = await request(app)
      .post("/auth/register")
      .send({ companyName: "Other", name: "X", email: "ADMIN@acme.test", password: PASSWORD })
      .expect(409);

    expect(res.body.error.code).toBe("EMAIL_TAKEN");
    expect(await CompanyModel.countDocuments()).toBe(1);
  });

  it("validates input with the standard error shape", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ companyName: "", name: "X", email: "not-an-email", password: "short" })
      .expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["companyName", "email", "password"]));
  });
});

describe("POST /auth/login", () => {
  it("sets the cookie and returns the user", async () => {
    await registerCompany(app, "acme");

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "Admin@Acme.test", password: PASSWORD })
      .expect(200);

    expect(authCookie(res)).toMatch(/^access_token=.+/);
    expect(res.body.user.email).toBe("admin@acme.test");
    expect(res.body.user.company.name).toBe("Company acme");
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    await registerCompany(app, "acme");

    const wrongPassword = await request(app)
      .post("/auth/login")
      .send({ email: "admin@acme.test", password: "wrong-password" })
      .expect(401);
    const unknownEmail = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@acme.test", password: PASSWORD })
      .expect(401);

    expect(wrongPassword.body).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(wrongPassword.headers["set-cookie"]).toBeUndefined();
    expect(unknownEmail.headers["set-cookie"]).toBeUndefined();
  });
});

describe("GET /auth/me", () => {
  it("returns the user with the cookie", async () => {
    const session = await registerCompany(app, "acme");

    const res = await request(app).get("/auth/me").set("Cookie", session.cookie).expect(200);

    expect(res.body.user).toEqual(session.user);
  });

  it("returns 401 UNAUTHENTICATED without the cookie", async () => {
    const res = await request(app).get("/auth/me").expect(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 when the user no longer exists", async () => {
    const session = await registerCompany(app, "acme");
    await UserModel.deleteOne({ _id: session.user.id, company_id: session.user.company.id });

    await request(app).get("/auth/me").set("Cookie", session.cookie).expect(401);
  });
});

describe("POST /auth/logout", () => {
  it("clears the cookie with the same attributes", async () => {
    const session = await registerCompany(app, "acme");

    const res = await request(app)
      .post("/auth/logout")
      .set("Cookie", session.cookie)
      .set("Content-Type", "application/json")
      .expect(204);

    const setCookie = ([] as string[]).concat(res.headers["set-cookie"] ?? []).join(";");
    expect(setCookie).toMatch(/access_token=;/);
    expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Path=\//);
  });
});

describe("CSRF and transport hardening", () => {
  it("rejects state-changing requests that are not application/json with 415", async () => {
    const form = await request(app)
      .post("/auth/login")
      .type("form")
      .send({ email: "a@a.test", password: PASSWORD })
      .expect(415);
    expect(form.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    await request(app).post("/auth/login").set("Content-Type", "text/plain").send("{}").expect(415);
    // Bodyless logout must declare JSON too: no exception to the preflight rule.
    await request(app).post("/auth/logout").expect(415);
  });

  it("answers CORS only for the configured origin, with credentials", async () => {
    const allowed = await request(app)
      .options("/auth/login")
      .set("Origin", "http://localhost:3001")
      .set("Access-Control-Request-Method", "POST");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3001");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await request(app)
      .options("/auth/login")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "POST");
    expect(denied.headers["access-control-allow-origin"]).not.toBe("https://evil.example");
  });

  it("rate limits credential endpoints with the standard error shape", async () => {
    const limited = createTestApp({ credentialsRateLimit: { windowMs: 60_000, limit: 2 } });
    const attempt = () =>
      request(limited).post("/auth/login").send({ email: "x@x.test", password: "whatever1" });

    await attempt().expect(401);
    await attempt().expect(401);
    const res = await attempt().expect(429);
    expect(res.body).toEqual({
      error: { code: "TOO_MANY_REQUESTS", message: "Too many requests, try again later" },
    });
  });

  it("returns 404 in the standard shape for unknown routes", async () => {
    const res = await request(app).get("/nope").expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 INVALID_JSON for a malformed body", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad json")
      .expect(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});
