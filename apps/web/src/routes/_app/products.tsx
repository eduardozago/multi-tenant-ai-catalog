import { Alert, AlertDescription, AlertTitle } from "@multi-tenant-ai-catalog/ui/components/alert";
import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@multi-tenant-ai-catalog/ui/components/empty";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, Package, Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { RequirePermission } from "@/components/forbidden-state";
import { Can, usePermission } from "@/lib/permissions";

export const Route = createFileRoute("/_app/products")({
  head: () => ({ meta: [{ title: "Produtos · Catálogo IA" }] }),
  component: () => (
    <RequirePermission permission="products:read">
      <ProductsPage />
    </RequirePermission>
  ),
});

// Placeholder: the catalog is implemented in the next task.
function ProductsPage() {
  const canWrite = usePermission("products:write");

  return (
    <>
      <PageHeader
        title="Produtos"
        description="O catálogo da sua empresa."
        action={
          <Can permission="products:write">
            <Button disabled>
              <Plus aria-hidden />
              Novo produto
            </Button>
          </Can>
        }
      />

      {!canWrite && (
        <Alert>
          <Eye aria-hidden />
          <AlertTitle>Modo visualização</AlertTitle>
          <AlertDescription>
            Você pode consultar os produtos. Criar, editar e excluir é restrito a administradores.
          </AlertDescription>
        </Alert>
      )}

      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Package />
          </EmptyMedia>
          <EmptyTitle>Catálogo em construção</EmptyTitle>
          <EmptyDescription>A listagem de produtos chega na próxima etapa.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  );
}
