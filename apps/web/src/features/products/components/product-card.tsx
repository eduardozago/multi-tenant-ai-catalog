import { Badge } from "@multi-tenant-ai-catalog/ui/components/badge";
import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import { Card, CardAction, CardContent, CardHeader } from "@multi-tenant-ai-catalog/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@multi-tenant-ai-catalog/ui/components/dropdown-menu";
import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";

import { formatBRL } from "@/lib/format";
import { Can } from "@/lib/permissions";

import type { Product } from "../api";
import { ProductImage } from "./product-image";

export type ProductActions = {
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

export function ProductCard({
  product,
  onOpen,
  actions,
}: {
  product: Product;
  onOpen: (product: Product) => void;
  actions: ProductActions;
}) {
  return (
    // The whole card is clickable through the name button's ::after overlay, not by
    // making the card a <button>: the actions menu inside would be a nested button.
    <Card className="relative h-full gap-3 pt-0 transition-shadow hover:ring-foreground/25 has-[button:focus-visible]:ring-ring">
      <ProductImage src={product.imageUrl} alt="" />
      <CardHeader>
        <h3 className="line-clamp-2 text-sm font-medium">
          <button
            type="button"
            onClick={() => onOpen(product)}
            className="text-left outline-none after:absolute after:inset-0 after:content-['']"
          >
            {product.name}
          </button>
        </h3>
        <Can permission="products:write">
          {/* z-10 lifts the menu above the overlay, so it does not open the details. */}
          <CardAction className="relative z-10">
            <ProductActionsMenu product={product} actions={actions} />
          </CardAction>
        </Can>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="secondary" className="max-w-full truncate">
            {product.category}
          </Badge>
          <span className="text-sm font-semibold tabular-nums">{formatBRL(product.priceCents)}</span>
        </div>
        {product.description && (
          <p className="line-clamp-2 text-muted-foreground">{product.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ProductActionsMenu({
  product,
  actions,
}: {
  product: Product;
  actions: ProductActions;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Ações para ${product.name}`} />}
      >
        <EllipsisVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => actions.onEdit(product)}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => actions.onDelete(product)}>
          <Trash2 />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
