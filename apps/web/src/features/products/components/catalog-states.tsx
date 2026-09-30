import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import { Card, CardContent, CardHeader } from "@multi-tenant-ai-catalog/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@multi-tenant-ai-catalog/ui/components/empty";
import { Skeleton } from "@multi-tenant-ai-catalog/ui/components/skeleton";
import { Package, SearchX, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { getErrorMessage } from "@/lib/form-errors";

// Same breakpoints for the skeleton and the real grid, so nothing jumps when data arrives.
export const PRODUCT_GRID_CLASS = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

const SKELETON_CARDS = Array.from({ length: 8 }, (_, index) => `skeleton-${index}`);

export function ProductGridSkeleton() {
  return (
    <div className={PRODUCT_GRID_CLASS} aria-busy="true" aria-label="Carregando produtos">
      {SKELETON_CARDS.map((key) => (
        <Card key={key} className="gap-3 pt-0">
          <Skeleton className="aspect-4/3 w-full" />
          <CardHeader>
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Nothing in the catalog at all; `action` is the admin's call to action (null for users). */
export function CatalogEmpty({ action }: { action: ReactNode }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Package />
        </EmptyMedia>
        <EmptyTitle>Nenhum produto no catálogo</EmptyTitle>
        <EmptyDescription>
          {action
            ? "Cadastre o primeiro produto para que sua equipe e o agente de IA possam consultá-lo."
            : "Sua empresa ainda não cadastrou produtos. Quando um administrador cadastrar, eles aparecem aqui."}
        </EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

export function CatalogNoResults({ onClear }: { onClear: () => void }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>Nenhum produto encontrado</EmptyTitle>
        <EmptyDescription>Nenhum produto corresponde aos filtros atuais.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onClear}>
          Limpar filtros
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export function CatalogError({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlert />
        </EmptyMedia>
        <EmptyTitle>Não foi possível carregar os produtos</EmptyTitle>
        <EmptyDescription>{getErrorMessage(error)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          Tentar novamente
        </Button>
      </EmptyContent>
    </Empty>
  );
}
