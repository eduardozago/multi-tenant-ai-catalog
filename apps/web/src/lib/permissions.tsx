import type { ReactNode } from "react";

import { useSession } from "@/features/auth/hooks";

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Single source for what each role may do in the UI. Mirrors the server's
 * `authorize(...)` guards; it only shapes the interface, the server enforces.
 */
export const PERMISSIONS = {
  admin: ["products:read", "products:write", "chat:use", "users:manage"],
  user: ["products:read", "chat:use"],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof PERMISSIONS)[Role][number];

/** Human description of each permission; drives the "O que você pode fazer" panel. */
export const PERMISSION_DETAILS: Record<Permission, { label: string; description: string }> = {
  "products:read": {
    label: "Consultar produtos",
    description: "Ver o catálogo da sua empresa.",
  },
  "products:write": {
    label: "Gerenciar produtos",
    description: "Criar, editar e excluir produtos do catálogo.",
  },
  "chat:use": {
    label: "Conversar com o agente de IA",
    description: "Tirar dúvidas sobre o catálogo com respostas baseadas nos dados reais.",
  },
  "users:manage": {
    label: "Gerenciar usuários",
    description: "Convidar pessoas da sua empresa e definir o papel de cada uma.",
  },
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_DETAILS) as Permission[];

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[role] as readonly Permission[]).includes(permission);
}

export function usePermission(permission: Permission): boolean {
  const { role } = useSession();
  return can(role, permission);
}

export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return usePermission(permission) ? children : fallback;
}
