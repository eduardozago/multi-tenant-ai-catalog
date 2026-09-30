import type { Express } from "express";
import request from "supertest";
import { expect } from "vitest";

import { type AppOptions, createApp } from "../src/app";

export const PASSWORD = "password123";

export function createTestApp(options: AppOptions = {}): Express {
  // High limit so the suite is not throttled; the rate limit has its own test.
  return createApp({ credentialsRateLimit: { windowMs: 60_000, limit: 1000 }, ...options });
}

/** Returns the `access_token=...` pair from a response, ready for a Cookie header. */
export function authCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const cookie = cookies.find((c) => c.startsWith("access_token="));
  expect(cookie, "response should set access_token").toBeDefined();
  return cookie!.split(";")[0]!;
}

export type Session = {
  cookie: string;
  user: { id: string; name: string; email: string; role: string; company: { id: string; name: string } };
};

export async function registerCompany(app: Express, slug: string): Promise<Session> {
  const res = await request(app)
    .post("/auth/register")
    .send({ companyName: `Company ${slug}`, name: `Admin ${slug}`, email: `admin@${slug}.test`, password: PASSWORD })
    .expect(201);
  return { cookie: authCookie(res), user: res.body.user };
}

export async function login(app: Express, email: string, password = PASSWORD): Promise<Session> {
  const res = await request(app).post("/auth/login").send({ email, password }).expect(200);
  return { cookie: authCookie(res), user: res.body.user };
}

/** Admin creates a user in their own company, then that user logs in. */
export async function createMember(
  app: Express,
  admin: Session,
  email: string,
  role: "admin" | "user" = "user",
): Promise<Session> {
  await request(app)
    .post("/users")
    .set("Cookie", admin.cookie)
    .send({ name: email, email, password: PASSWORD, role })
    .expect(201);
  return login(app, email);
}

export const validProduct = {
  name: "Ração Premium Cães Adultos 15kg",
  description: "Ração completa para cães adultos de porte médio.",
  priceCents: 18990,
  category: "Rações",
  imageUrl: "https://picsum.photos/seed/racao-premium/640/480",
};

export type ProductBody = { id: string } & Record<string, unknown>;

/** Admin creates a product through the API; `overrides` replace fields of `validProduct`. */
export async function createProduct(
  app: Express,
  admin: Session,
  overrides: Record<string, unknown> = {},
): Promise<ProductBody> {
  const res = await request(app)
    .post("/products")
    .set("Cookie", admin.cookie)
    .send({ ...validProduct, ...overrides })
    .expect(201);
  return res.body.product;
}
