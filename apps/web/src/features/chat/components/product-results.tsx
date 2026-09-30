import { Badge } from "@multi-tenant-ai-catalog/ui/components/badge";

import type { Product } from "@/features/products/api";
import { ProductImage } from "@/features/products/components/product-image";
import { formatBRL } from "@/lib/format";

/**
 * Products the answer mentions, as returned by the tools (real database records, never
 * text written by the model, see D-28). A horizontal row that scrolls on its own, so
 * six cards fit a phone without growing the message.
 */
export function ProductResults({ products, onOpen }: { products: Product[]; onOpen: (product: Product) => void }) {
  if (products.length === 0) return null;
  return (
    <ul
      aria-label="Produtos citados na resposta"
      className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-1 px-1 pt-1 pb-2 [scrollbar-width:thin]"
    >
      {products.map((product) => (
        <li key={product.id} className="w-40 shrink-0 snap-start sm:w-44">
          <button
            type="button"
            onClick={() => onOpen(product)}
            className="flex h-full w-full flex-col overflow-hidden border bg-card text-left text-card-foreground transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ProductImage src={product.imageUrl} alt="" />
            <span className="flex flex-1 flex-col gap-1.5 p-2.5">
              <span className="line-clamp-2 text-xs font-medium">{product.name}</span>
              <span className="mt-auto text-sm font-semibold tabular-nums">{formatBRL(product.priceCents)}</span>
              <Badge variant="secondary" className="max-w-full truncate">
                {product.category}
              </Badge>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
