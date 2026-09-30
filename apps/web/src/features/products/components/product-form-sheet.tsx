import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multi-tenant-ai-catalog/ui/components/alert-dialog";
import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@multi-tenant-ai-catalog/ui/components/sheet";
import { useState } from "react";

import type { Product } from "../api";
import { ProductForm, ProductFormSubmit } from "./product-form";

/**
 * Side panel for create (`product` null) and edit. `formKey` changes on every open, so
 * each opening mounts a fresh form with the current values; `product` stays set while
 * the panel animates closed so the content does not blank out.
 */
export function ProductFormSheet({
  open,
  product,
  formKey,
  onOpenChange,
}: {
  open: boolean;
  product: Product | null;
  formKey: number;
  onOpenChange: (open: boolean) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const isEdit = product !== null;

  // Every way of closing (Esc, overlay, X, Cancelar) goes through here.
  const requestClose = () => {
    if (pending) return; // the request is in flight; let it finish and close on success
    if (dirty) setConfirmDiscard(true);
    else onOpenChange(false);
  };

  const close = () => {
    setConfirmDiscard(false);
    setDirty(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="border-b pr-12">
            <SheetTitle className="text-base font-semibold">
              {isEdit ? "Editar produto" : "Novo produto"}
            </SheetTitle>
            <SheetDescription>
              {isEdit
                ? "As alterações aparecem no catálogo e nas respostas do agente."
                : "O produto fica visível para toda a sua empresa e para o agente de IA."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <ProductForm
              key={formKey}
              product={product}
              onDirtyChange={setDirty}
              onPendingChange={setPending}
              onSaved={close}
            />
          </div>

          <SheetFooter className="flex-row border-t">
            <Button type="button" variant="outline" className="flex-1" onClick={requestClose} disabled={pending}>
              Cancelar
            </Button>
            <ProductFormSubmit isEdit={isEdit} pending={pending} />
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              {isEdit
                ? "As alterações feitas neste produto não foram salvas e serão perdidas."
                : "Os dados preenchidos não foram salvos e serão perdidos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={close}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
