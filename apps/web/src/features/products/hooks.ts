import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/form-errors";

import {
  type CreateProductInput,
  createProduct,
  deleteProduct,
  getProduct,
  listCategories,
  listProducts,
  type Product,
  type ProductListFilters,
  type UpdateProductInput,
  updateProduct,
} from "./api";

// Hierarchical keys: invalidating `all` refreshes lists, details and categories at once,
// since any write can change all three (a new category, a renamed product, a new total).
export const productKeys = {
  all: ["products"] as const,
  list: (filters: ProductListFilters) => ["products", "list", filters] as const,
  detail: (id: string) => ["products", "detail", id] as const,
  categories: () => ["products", "categories"] as const,
};

export const productsQueryOptions = (filters: ProductListFilters) =>
  queryOptions({
    queryKey: productKeys.list(filters),
    queryFn: ({ signal }) => listProducts(filters, signal),
    // Keep showing the current page while the next filter/page loads, instead of
    // flashing the skeleton on every keystroke or page change.
    placeholderData: keepPreviousData,
  });

export function useProducts(filters: ProductListFilters) {
  return useQuery(productsQueryOptions(filters));
}

/**
 * `placeholder` is the product as the list already has it, so the detail sheet opens
 * instantly and is refreshed in the background. `id: null` disables the query.
 */
export function useProduct(id: string | null, placeholder?: Product) {
  return useQuery({
    queryKey: productKeys.detail(id ?? ""),
    queryFn: ({ signal }) => getProduct(id as string, signal),
    enabled: id !== null,
    placeholderData: placeholder,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: productKeys.categories(),
    queryFn: ({ signal }) => listCategories(signal),
  });
}

// Success toasts live here so every caller gets them. Create/update errors do not toast:
// the form shows them next to the fields (or in a banner). Delete has no form, so it toasts.

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: (product) => {
      toast.success("Produto criado", { description: `${product.name} já está no catálogo.` });
      return queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) => updateProduct(id, input),
    onSuccess: (product) => {
      toast.success("Alterações salvas", { description: product.name });
      queryClient.setQueryData(productKeys.detail(product.id), product);
      return queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: Product) => deleteProduct(product.id),
    onSuccess: (_data, product) => {
      toast.success("Produto excluído", { description: `${product.name} saiu do catálogo.` });
      // Drop the detail first so an open sheet does not refetch a product that is gone (404).
      queryClient.removeQueries({ queryKey: productKeys.detail(product.id) });
      // Not awaited: the caller's onSuccess (close the sheet, go back a page) runs right away.
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
    onError: (error) => {
      toast.error("Não foi possível excluir o produto", { description: getErrorMessage(error) });
      // Already deleted (another tab or admin): refresh so the stale card disappears.
      if (error instanceof ApiError && error.code === "PRODUCT_NOT_FOUND") {
        void queryClient.invalidateQueries({ queryKey: productKeys.all });
      }
    },
  });
}
