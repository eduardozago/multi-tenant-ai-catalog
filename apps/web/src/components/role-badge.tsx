import { Badge } from "@multi-tenant-ai-catalog/ui/components/badge";

import type { Role } from "@/lib/permissions";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  user: "Usuário",
};

const ROLE_VARIANTS = { admin: "default", user: "secondary" } as const satisfies Record<Role, string>;

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={ROLE_VARIANTS[role]}>{ROLE_LABELS[role]}</Badge>;
}
