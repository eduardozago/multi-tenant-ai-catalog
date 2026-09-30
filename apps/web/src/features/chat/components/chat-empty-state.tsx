import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@multi-tenant-ai-catalog/ui/components/empty";
import { Skeleton } from "@multi-tenant-ai-catalog/ui/components/skeleton";
import { Sparkles } from "lucide-react";

import { useCategories } from "@/features/products/hooks";

const GENERIC_SUGGESTIONS = ["Qual o produto mais barato?", "Tem algo até R$ 100?"];
const CATEGORY_SUGGESTIONS = 2;

/**
 * Suggestions built from the tenant's own categories, so each company sees questions its
 * catalog can answer. Same query as the catalog filter (['products', 'categories']).
 */
function useSuggestions(): string[] | null {
  const categories = useCategories();
  if (categories.isPending) return null;
  // On error the generic questions still work; the chat itself does not depend on this.
  const fromCategories = (categories.data ?? [])
    .slice(0, CATEGORY_SUGGESTIONS)
    .map((category) => `Quais produtos de ${category} vocês têm?`);
  return [...fromCategories, ...GENERIC_SUGGESTIONS];
}

export function ChatEmptyState({
  userName,
  companyName,
  onPick,
}: {
  userName: string;
  companyName: string;
  onPick: (message: string) => void;
}) {
  const suggestions = useSuggestions();
  const firstName = userName.trim().split(/\s+/)[0];

  return (
    <Empty className="m-auto max-w-lg">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Sparkles />
        </EmptyMedia>
        <EmptyTitle className="text-base">Olá, {firstName}!</EmptyTitle>
        <EmptyDescription>
          Sou o assistente de <span className="font-medium text-foreground">{companyName}</span>. Respondo
          sobre produtos, preços e categorias com base no catálogo cadastrado.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <ul className="flex flex-wrap justify-center gap-2" aria-label="Sugestões de perguntas">
          {suggestions
            ? suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-7 py-1 text-left whitespace-normal"
                    onClick={() => onPick(suggestion)}
                  >
                    {suggestion}
                  </Button>
                </li>
              ))
            : ["w-52", "w-44", "w-40", "w-32"].map((width) => (
                <li key={width}>
                  <Skeleton className={`h-7 ${width}`} />
                </li>
              ))}
        </ul>
      </EmptyContent>
    </Empty>
  );
}
