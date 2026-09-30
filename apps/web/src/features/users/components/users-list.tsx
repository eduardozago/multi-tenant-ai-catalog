import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import { Card, CardContent } from "@multi-tenant-ai-catalog/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@multi-tenant-ai-catalog/ui/components/empty";
import { Skeleton } from "@multi-tenant-ai-catalog/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multi-tenant-ai-catalog/ui/components/table";
import { TriangleAlert, Users } from "lucide-react";
import type { ReactNode } from "react";

import { RoleBadge } from "@/components/role-badge";
import { getErrorMessage } from "@/lib/form-errors";

import type { CompanyUser } from "../api";
import { useUsers } from "../hooks";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

const SKELETON_ROWS = ["a", "b", "c"];

export function UsersList({ emptyAction }: { emptyAction: ReactNode }) {
  const { data: users, isPending, isError, error, refetch, isRefetching } = useUsers();

  if (isPending) return <UsersSkeleton />;

  if (isError) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>Não foi possível carregar os usuários</EmptyTitle>
          <EmptyDescription>{getErrorMessage(error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            Tentar novamente
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  // The admin viewing this page is a user too, so this only happens if the list is filtered in the future.
  if (users.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>Nenhum usuário ainda</EmptyTitle>
          <EmptyDescription>Convide pessoas da sua empresa para usar o catálogo.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{emptyAction}</EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      {/* Mobile: one card per user, since a 4-column table does not fit 375px. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {users.map((user) => (
          <li key={user.id}>
            <UserCard user={user} />
          </li>
        ))}
      </ul>

      <div className="hidden border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function UserCard({ user }: { user: CompanyUser }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate font-medium">{user.name}</span>
          <RoleBadge role={user.role} />
        </div>
        <span className="truncate text-muted-foreground">{user.email}</span>
        <span className="text-xs text-muted-foreground">Criado em {formatDate(user.createdAt)}</span>
      </CardContent>
    </Card>
  );
}

function UsersSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando usuários" className="flex flex-col gap-3">
      {SKELETON_ROWS.map((key) => (
        <Skeleton key={key} className="h-16 w-full md:h-10" />
      ))}
    </div>
  );
}
