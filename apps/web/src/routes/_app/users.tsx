import { createFileRoute } from "@tanstack/react-router";

import { RequirePermission } from "@/components/forbidden-state";
import { PageHeader } from "@/components/page-header";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import { UsersList } from "@/features/users/components/users-list";

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "Usuários · Catálogo IA" }] }),
  // The guard wraps the page so a `user` sees why, and the list query never fires for them.
  component: () => (
    <RequirePermission permission="users:manage">
      <UsersPage />
    </RequirePermission>
  ),
});

function UsersPage() {
  return (
    <>
      <PageHeader
        title="Usuários"
        description="Pessoas com acesso ao catálogo da sua empresa."
        action={<CreateUserDialog />}
      />
      <UsersList emptyAction={<CreateUserDialog />} />
    </>
  );
}
