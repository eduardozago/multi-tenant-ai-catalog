import { cn } from "@multi-tenant-ai-catalog/ui/lib/utils";
import { Boxes } from "lucide-react";

export const PRODUCT_NAME = "Catálogo IA";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex size-8 items-center justify-center bg-primary text-primary-foreground">
        <Boxes className="size-4" aria-hidden />
      </div>
      <span className="text-base font-semibold">{PRODUCT_NAME}</span>
    </div>
  );
}
