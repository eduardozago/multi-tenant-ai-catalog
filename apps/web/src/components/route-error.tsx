import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@multi-tenant-ai-catalog/ui/components/empty";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

import { getErrorMessage } from "@/lib/form-errors";

/** Fallback when a route guard or loader fails (e.g. the server is unreachable). */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Empty className="max-w-md border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>Não foi possível carregar a página</EmptyTitle>
          <EmptyDescription>{getErrorMessage(error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            onClick={() => {
              reset();
              void router.invalidate();
            }}
          >
            Tentar novamente
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
