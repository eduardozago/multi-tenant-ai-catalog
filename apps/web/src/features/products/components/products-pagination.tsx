import { buttonVariants } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@multi-tenant-ai-catalog/ui/components/pagination";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { ProductSearch } from "../schemas";

type PageItem = { kind: "page"; page: number } | { kind: "gap"; after: number };

/** 1 … 4 5 6 … 12: first, last and the neighbours of the current page. */
function pageWindow(page: number, totalPages: number): PageItem[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: PageItem[] = [];
  for (const [index, current] of sorted.entries()) {
    const previous = sorted[index - 1];
    if (previous !== undefined && current - previous > 1) result.push({ kind: "gap", after: previous });
    result.push({ kind: "page", page: current });
  }
  return result;
}

// Real links (not buttons): each page has a URL, so it can be opened in a new tab or shared.
// Page 1 is `undefined`, matching the URL schema that keeps defaults out of the query string.
const toPage = (page: number) => (prev: ProductSearch): ProductSearch => ({
  ...prev,
  page: page > 1 ? page : undefined,
});

export function ProductsPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <Pagination aria-label="Paginação dos produtos">
      <PaginationContent>
        <PaginationItem>
          {hasPrevious ? (
            <Link
              to="/products"
              search={toPage(page - 1)}
              aria-label="Página anterior"
              className={buttonVariants({ variant: "ghost" })}
            >
              <ChevronLeft aria-hidden />
              <span className="hidden sm:inline">Anterior</span>
            </Link>
          ) : (
            <span
              aria-disabled
              className={buttonVariants({ variant: "ghost", className: "pointer-events-none opacity-50" })}
            >
              <ChevronLeft aria-hidden />
              <span className="hidden sm:inline">Anterior</span>
            </span>
          )}
        </PaginationItem>

        {pageWindow(page, totalPages).map((item) =>
          item.kind === "gap" ? (
            <PaginationItem key={`gap-${item.after}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item.page}>
              <Link
                to="/products"
                search={toPage(item.page)}
                aria-label={`Página ${item.page}`}
                aria-current={item.page === page ? "page" : undefined}
                className={buttonVariants({
                  variant: item.page === page ? "outline" : "ghost",
                  size: "icon",
                })}
              >
                {item.page}
              </Link>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          {hasNext ? (
            <Link
              to="/products"
              search={toPage(page + 1)}
              aria-label="Próxima página"
              className={buttonVariants({ variant: "ghost" })}
            >
              <span className="hidden sm:inline">Próxima</span>
              <ChevronRight aria-hidden />
            </Link>
          ) : (
            <span
              aria-disabled
              className={buttonVariants({ variant: "ghost", className: "pointer-events-none opacity-50" })}
            >
              <span className="hidden sm:inline">Próxima</span>
              <ChevronRight aria-hidden />
            </span>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
