import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@multi-tenant-ai-catalog/ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multi-tenant-ai-catalog/ui/components/select";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useCategories } from "../hooks";
import { DEFAULT_SORT, PRODUCT_SORTS, type ProductSearch, SORT_LABELS } from "../schemas";

const SEARCH_DEBOUNCE_MS = 300;

/** Filter changes; any change except the page itself goes back to page 1 (see the route). */
export type FiltersPatch = Partial<Omit<ProductSearch, "page">>;

export function ProductsToolbar({
  filters,
  onChange,
  onClear,
}: {
  filters: ProductSearch;
  onChange: (patch: FiltersPatch, options?: { replace?: boolean }) => void;
  onClear: () => void;
}) {
  const hasAnyFilter =
    filters.search !== undefined || filters.category !== undefined || filters.sort !== undefined;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchInput value={filters.search} onCommit={(search) => onChange({ search }, { replace: true })} />
      <div className="flex gap-2">
        <CategorySelect value={filters.category} onChange={(category) => onChange({ category })} />
        <SortSelect value={filters.sort ?? DEFAULT_SORT} onChange={(sort) => onChange({ sort })} />
      </div>
      {hasAnyFilter && (
        <Button variant="ghost" onClick={onClear} className="self-start sm:self-auto">
          <X aria-hidden />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}

/**
 * Local text for instant typing; the URL (and the request) follows 300ms after the last
 * keystroke. `replace` keeps one history entry per search instead of one per letter.
 */
function SearchInput({
  value,
  onCommit,
}: {
  value: string | undefined;
  onCommit: (value: string | undefined) => void;
}) {
  const [text, setText] = useState(value ?? "");

  // Follow the URL when it changes from outside (Limpar filtros, back button). Compared
  // trimmed, because the URL drops the trailing space the user is still typing.
  useEffect(() => {
    setText((current) => (current.trim() === (value ?? "") ? current : (value ?? "")));
  }, [value]);

  useEffect(() => {
    const next = text.trim() || undefined;
    if (next === value) return;
    const timeout = setTimeout(() => onCommit(next), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [text, value, onCommit]);

  return (
    <InputGroup className="sm:max-w-xs sm:flex-1">
      <InputGroupAddon>
        <Search aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        placeholder="Buscar por nome ou descrição"
        aria-label="Buscar produtos"
        maxLength={100}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </InputGroup>
  );
}

function CategorySelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const categories = useCategories();
  // A copy: the array belongs to the query cache.
  const names = [...(categories.data ?? [])];
  // A shared link can name a category that no longer exists (or has not loaded yet):
  // keep it selectable so the trigger shows it instead of a blank value.
  if (value !== undefined && !names.includes(value)) names.push(value);
  // `null` is the "all" option; Base UI treats it as the empty value.
  const items = [
    { value: null, label: "Todas as categorias" },
    ...names.map((category) => ({ value: category, label: category })),
  ];

  return (
    <Select
      items={items}
      value={value ?? null}
      onValueChange={(next) => onChange(next ?? undefined)}
      disabled={categories.isError}
    >
      <SelectTrigger aria-label="Filtrar por categoria" className="min-w-0 flex-1 sm:w-48 sm:flex-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value ?? "all"} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: (typeof PRODUCT_SORTS)[number];
  onChange: (value: (typeof PRODUCT_SORTS)[number] | undefined) => void;
}) {
  return (
    <Select
      items={SORT_LABELS}
      value={value}
      // The default sort stays out of the URL.
      onValueChange={(next) => onChange(next && next !== DEFAULT_SORT ? next : undefined)}
    >
      <SelectTrigger aria-label="Ordenar por" className="min-w-0 flex-1 sm:w-40 sm:flex-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRODUCT_SORTS.map((sort) => (
          <SelectItem key={sort} value={sort}>
            {SORT_LABELS[sort]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
