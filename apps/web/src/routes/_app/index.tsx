import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multi-tenant-ai-catalog/ui/components/card";
import { cn } from "@multi-tenant-ai-catalog/ui/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck, Lock } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { RoleBadge } from "@/components/role-badge";
import { useSession } from "@/features/auth/hooks";
import { ALL_PERMISSIONS, PERMISSION_DETAILS, can } from "@/lib/permissions";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Início · Catálogo IA" }] }),
  component: HomePage,
});

function HomePage() {
  const { user, role } = useSession();
  if (!user) return null;

  const firstName = user.name.split(/\s+/)[0];

  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} description={`Você está em ${user.company.name}.`} />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        Seu papel: <RoleBadge role={user.role} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>O que você pode fazer</CardTitle>
          <CardDescription>
            As permissões vêm do seu papel na empresa. O servidor aplica as mesmas regras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Generated from the permission map: locked items make the model visible, not just absent. */}
          <ul className="grid gap-3 sm:grid-cols-2">
            {ALL_PERMISSIONS.map((permission) => {
              const allowed = can(role, permission);
              const { label, description } = PERMISSION_DETAILS[permission];
              const Icon = allowed ? CircleCheck : Lock;
              return (
                <li
                  key={permission}
                  className={cn("flex gap-3 border p-3", !allowed && "border-dashed")}
                >
                  <Icon
                    className={cn("mt-0.5 size-4 shrink-0", allowed ? "text-primary" : "text-muted-foreground")}
                    aria-hidden
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className={cn("text-sm font-medium", !allowed && "text-muted-foreground")}>
                      {label}
                      <span className="sr-only">{allowed ? " (permitido)" : " (bloqueado)"}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {allowed ? description : "Disponível para administradores"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
