import { apiFetch } from "@/lib/api-client";

import type { ProductSort } from "./schemas";

/** Mirrors ProductDto in apps/server/src/modules/products/product.dto.ts (dates arrive as ISO strings). */
export type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Paginated envelope of GET /products (D-18). */
export type ProductPage = {
  data: Product[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type ProductListFilters = {
  search?: string;
  category?: string;
  sort?: ProductSort;
  page?: number;
};

export type CreateProductInput = {
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl?: string;
};

/** Partial update; `imageUrl: null` removes the image. */
export type UpdateProductInput = Partial<Omit<CreateProductInput, "imageUrl">> & {
  imageUrl?: string | null;
};

export async function listProducts(filters: ProductListFilters, signal?: AbortSignal): Promise<ProductPage> {
  // Only filters that are set: the server treats `?search=` as "no filter" anyway, but
  // a clean query string keeps request logs readable.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return apiFetch<ProductPage>(query ? `/products?${query}` : "/products", { signal });
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  const { product } = await apiFetch<{ product: Product }>(`/products/${encodeURIComponent(id)}`, {
    signal,
  });
  return product;
}

export async function listCategories(signal?: AbortSignal): Promise<string[]> {
  const { categories } = await apiFetch<{ categories: string[] }>("/products/categories", { signal });
  return categories;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { product } = await apiFetch<{ product: Product }>("/products", { method: "POST", body: input });
  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const { product } = await apiFetch<{ product: Product }>(`/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
  return product;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiFetch<void>(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}
