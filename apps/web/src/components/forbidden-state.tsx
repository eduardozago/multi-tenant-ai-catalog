import { buttonVariants } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@multi-tenant-ai-catalog/ui/components/empty";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { type Permission, usePermission } from "@/lib/permissions";

export function ForbiddenState() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock />
        </EmptyMedia>
        <EmptyTitle>Acesso restrito a administradores</EmptyTitle>
        <EmptyDescription>
          Seu papel não permite acessar esta página. Fale com um administrador da sua empresa se
          precisar de acesso.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          Voltar para o início
        </Link>
      </EmptyContent>
    </Empty>
  );
}

/**
 * Page-level guard: shows why access is denied instead of silently redirecting,
 * and does not mount (or fetch for) the page when the permission is missing.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  return usePermission(permission) ? children : <ForbiddenState />;
}
