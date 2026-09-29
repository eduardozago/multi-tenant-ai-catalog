import { apiFetch } from "@/lib/api-client";
import type { Role } from "@/lib/permissions";

import type { CreateUserInput } from "./schemas";

/** Mirrors toUserDto in apps/server/src/modules/users/user.controller.ts. */
export type CompanyUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};

export async function listUsers(): Promise<CompanyUser[]> {
  const { users } = await apiFetch<{ users: CompanyUser[] }>("/users");
  return users;
}

export async function createUser(input: CreateUserInput): Promise<CompanyUser> {
  const { user } = await apiFetch<{ user: CompanyUser }>("/users", { method: "POST", body: input });
  return user;
}
