import { ApiError, apiFetch } from "@/lib/api-client";
import type { Role } from "@/lib/permissions";

import type { LoginInput, RegisterInput } from "./schemas";

/** Mirrors AuthUserDto in apps/server/src/modules/auth/user.dto.ts. */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  company: { id: string; name: string };
};

type UserResponse = { user: AuthUser };

export async function login(input: LoginInput): Promise<AuthUser> {
  const { user } = await apiFetch<UserResponse>("/auth/login", { method: "POST", body: input });
  return user;
}

export async function register(input: RegisterInput): Promise<AuthUser> {
  const { user } = await apiFetch<UserResponse>("/auth/register", {
    method: "POST",
    body: input,
  });
  return user;
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

/** "No session" is a normal state, not an error: 401 resolves to null. */
export async function me(): Promise<AuthUser | null> {
  try {
    const { user } = await apiFetch<UserResponse>("/auth/me");
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
