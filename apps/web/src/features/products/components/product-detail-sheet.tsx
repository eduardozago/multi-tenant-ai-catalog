import { Alert, AlertDescription } from "@multi-tenant-ai-catalog/ui/components/alert";
import { Badge } from "@multi-tenant-ai-catalog/ui/components/badge";
import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@multi-tenant-ai-catalog/ui/components/sheet";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";

import { getErrorMessage } from "@/lib/form-errors";
import { formatBRL } from "@/lib/format";
import { Can } from "@/lib/permissions";

import type { Product } from "../api";
import { useProduct } from "../hooks";
import type { ProductActions } from "./product-card";
import { ProductImage } from "./product-image";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * `product` is the list's copy and stays set while the sheet animates closed, so the
 * content does not blank out mid-transition; `open` alone controls visibility.
 * Without `actions` the sheet is read-only (the chat opens it that way): edit and delete
 * belong to the catalog page, which owns the form and the delete dialog.
 */
export function ProductDetailSheet({
  product,
  open,
  onOpenChange,
  actions,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions?: ProductActions;
}) {
  // Refreshes in the background (the list may be a few minutes old); disabled while closed.
  const detail = useProduct(open && product ? product.id : null, product ?? undefined);
  const current = detail.data ?? product;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {current && (
          <>
            <ProductImage src={current.imageUrl} alt={current.name} />
            <SheetHeader className="gap-2 pr-12">
              <Badge variant="secondary" className="max-w-full truncate">
                {current.category}
              </Badge>
              <SheetTitle className="text-lg font-semibold">{current.name}</SheetTitle>
              <SheetDescription className="text-base font-semibold text-foreground tabular-nums">
                {formatBRL(current.priceCents)}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-4">
              {detail.isError && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{getErrorMessage(detail.error)}</AlertDescription>
                </Alert>
              )}
              {current.description ? (
                // pre-line keeps the admin's line breaks without rendering any markup.
                <p className="text-sm whitespace-pre-line">{current.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Sem descrição.</p>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
                <dt>Criado em</dt>
                <dd>{dateFormatter.format(new Date(current.createdAt))}</dd>
                <dt>Atualizado em</dt>
                <dd>{dateFormatter.format(new Date(current.updatedAt))}</dd>
              </dl>
            </div>

            {actions && (
              <Can permission="products:write">
                <SheetFooter className="flex-row border-t">
                  <Button variant="outline" className="flex-1" onClick={() => actions.onEdit(current)}>
                    <Pencil aria-hidden />
                    Editar
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => actions.onDelete(current)}>
                    <Trash2 aria-hidden />
                    Excluir
                  </Button>
                </SheetFooter>
              </Can>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
