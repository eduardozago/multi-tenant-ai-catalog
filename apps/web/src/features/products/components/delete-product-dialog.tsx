import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@multi-tenant-ai-catalog/ui/components/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";

import { ApiError } from "@/lib/api-client";

import type { Product } from "../api";
import { useDeleteProduct } from "../hooks";

/**
 * Confirmation before a permanent delete (D-15: there is no undo). `product` stays set
 * while the dialog animates closed, so the name does not vanish mid-transition.
 */
export function DeleteProductDialog({
  product,
  open,
  onOpenChange,
  onDeleted,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (product: Product) => void;
}) {
  const deleteProduct = useDeleteProduct();

  const confirm = () => {
    if (!product) return;
    // Success and error toasts come from the hook. On other errors the dialog stays open
    // so the admin can retry or cancel.
    const done = () => {
      onOpenChange(false);
      onDeleted(product);
    };
    deleteProduct.mutate(product, {
      onSuccess: done,
      // Someone else deleted it first: the outcome the admin wanted, so close like a success
      // (the hook still toasts why, and refreshes the list).
      onError: (error) => {
        if (error instanceof ApiError && error.code === "PRODUCT_NOT_FOUND") done();
      },
    });
  };

  return (
    <AlertDialog
      open={open}
      // Esc and Cancelar are ignored while the request is in flight: closing would hide
      // whether the delete happened.
      onOpenChange={(next) => {
        if (!deleteProduct.isPending) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="font-medium text-foreground">{product?.name}</strong> será removido do
            catálogo e deixará de aparecer nas respostas do agente. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteProduct.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={deleteProduct.isPending}>
            {deleteProduct.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
