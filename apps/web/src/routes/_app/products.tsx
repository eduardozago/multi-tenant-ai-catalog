import { Alert, AlertDescription, AlertTitle } from "@multi-tenant-ai-catalog/ui/components/alert";
import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import { cn } from "@multi-tenant-ai-catalog/ui/lib/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { RequirePermission } from "@/components/forbidden-state";
import { PageHeader } from "@/components/page-header";
import type { Product } from "@/features/products/api";
import {
  CatalogEmpty,
  CatalogError,
  CatalogNoResults,
  PRODUCT_GRID_CLASS,
  ProductGridSkeleton,
} from "@/features/products/components/catalog-states";
import { type ProductActions, ProductCard } from "@/features/products/components/product-card";
import { ProductDetailSheet } from "@/features/products/components/product-detail-sheet";
import { ProductFormSheet } from "@/features/products/components/product-form-sheet";
import { ProductsPagination } from "@/features/products/components/products-pagination";
import { type FiltersPatch, ProductsToolbar } from "@/features/products/components/products-toolbar";
import { useProducts } from "@/features/products/hooks";
import { productSearchSchema } from "@/features/products/schemas";
import { Can, usePermission } from "@/lib/permissions";

export const Route = createFileRoute("/_app/products")({
  // Filters live in the URL: a filtered view survives refresh and can be shared.
  validateSearch: productSearchSchema,
  head: () => ({ meta: [{ title: "Produtos · Catálogo IA" }] }),
  component: () => (
    <RequirePermission permission="products:read">
      <ProductsPage />
    </RequirePermission>
  ),
});

function productCountLabel(total: number, filtered: boolean): string {
  const noun = total === 1 ? "produto" : "produtos";
  if (filtered) return `${total} ${noun} ${total === 1 ? "encontrado" : "encontrados"}`;
  return `${total} ${noun} no catálogo`;
}

function ProductsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const canWrite = usePermission("products:write");

  const page = search.page ?? 1;
  const products = useProducts({
    search: search.search,
    category: search.category,
    sort: search.sort,
    page,
  });
  // Sort orders the results but never hides any, so it does not count as a filter here.
  const isFiltered = search.search !== undefined || search.category !== undefined;

  const [detail, setDetail] = useState<{ product: Product | null; open: boolean }>({
    product: null,
    open: false,
  });
  // `key` grows on every open so the form remounts with fresh values (see ProductFormSheet).
  const [form, setForm] = useState<{ product: Product | null; open: boolean; key: number }>({
    product: null,
    open: false,
    key: 0,
  });

  const openForm = (product: Product | null) => {
    // One panel at a time: editing from the detail sheet replaces it with the form.
    setDetail((current) => ({ ...current, open: false }));
    setForm((current) => ({ product, open: true, key: current.key + 1 }));
  };

  // Stable, so the debounced search effect in the toolbar is not restarted on every render.
  const changeFilters = useCallback(
    (patch: FiltersPatch, options?: { replace?: boolean }) =>
      navigate({
        // A new filter changes the result set, so page 3 of the old one means nothing.
        search: (prev) => ({ ...prev, ...patch, page: undefined }),
        replace: options?.replace,
      }),
    [navigate],
  );
  const clearFilters = useCallback(() => navigate({ search: {} }), [navigate]);

  // A shared or stale link can point past the last page (products were deleted since):
  // move to the last page that exists instead of showing an empty page.
  const totalPages = products.data?.meta.totalPages;
  useEffect(() => {
    if (products.isPlaceholderData || totalPages === undefined) return;
    const lastPage = Math.max(totalPages, 1);
    if (page > lastPage) {
      void navigate({
        search: (prev) => ({ ...prev, page: lastPage > 1 ? lastPage : undefined }),
        replace: true,
      });
    }
  }, [page, totalPages, products.isPlaceholderData, navigate]);

  // Delete is wired in the next step (confirmation dialog).
  const actions: ProductActions = { onEdit: openForm, onDelete: () => {} };

  const newProductButton = (
    <Button onClick={() => openForm(null)}>
      <Plus aria-hidden />
      Novo produto
    </Button>
  );

  const isEmptyCatalog = products.data?.meta.total === 0 && !isFiltered;

  return (
    <>
      <PageHeader
        title="Produtos"
        description={
          products.data ? productCountLabel(products.data.meta.total, isFiltered) : "O catálogo da sua empresa."
        }
        action={<Can permission="products:write">{newProductButton}</Can>}
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

      {!isEmptyCatalog && <ProductsToolbar filters={search} onChange={changeFilters} onClear={clearFilters} />}

      {products.isPending ? (
        <ProductGridSkeleton />
      ) : products.isError ? (
        <CatalogError
          error={products.error}
          onRetry={() => products.refetch()}
          retrying={products.isRefetching}
        />
      ) : isEmptyCatalog ? (
        <CatalogEmpty action={canWrite ? newProductButton : null} />
      ) : products.data.data.length === 0 ? (
        <CatalogNoResults onClear={clearFilters} />
      ) : (
        <>
          <ul
            className={cn(PRODUCT_GRID_CLASS, "transition-opacity", products.isPlaceholderData && "opacity-60")}
            aria-busy={products.isPlaceholderData}
          >
            {products.data.data.map((product) => (
              <li key={product.id}>
                <ProductCard
                  product={product}
                  onOpen={(selected) => setDetail({ product: selected, open: true })}
                  actions={actions}
                />
              </li>
            ))}
          </ul>
          <ProductsPagination page={page} totalPages={products.data.meta.totalPages} />
        </>
      )}

      <ProductDetailSheet
        product={detail.product}
        open={detail.open}
        onOpenChange={(open) => setDetail((current) => ({ ...current, open }))}
        actions={actions}
      />

      <Can permission="products:write">
        <ProductFormSheet
          open={form.open}
          product={form.product}
          formKey={form.key}
          onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        />
      </Can>
    </>
  );
}
