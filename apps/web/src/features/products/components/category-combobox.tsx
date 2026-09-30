import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@multi-tenant-ai-catalog/ui/components/combobox";
import { Plus } from "lucide-react";
import { useState } from "react";

import { useCategories } from "../hooks";

const sameCategory = (a: string, b: string) =>
  a.localeCompare(b, "pt", { sensitivity: "base" }) === 0;

/**
 * Category picker: suggests the company's existing categories and offers "Criar «x»" for
 * a new one. The field value is always plain text, so typing a new name and tabbing away
 * also works. A name that matches an existing category ignoring case and accents
 * ("roupas" vs "Roupas") is snapped to the existing spelling, so the catalog does not
 * end up with near-duplicate categories.
 */
export function CategoryCombobox({
  id,
  value,
  onChange,
  onBlur,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
}) {
  const categories = useCategories();
  const [query, setQuery] = useState(value);

  // The current value is listed even when it is new (created in this form, not saved yet),
  // so it shows as a normal, selected item instead of "Criar".
  const saved = categories.data ?? [];
  const existing = value && !saved.some((c) => sameCategory(c, value)) ? [...saved, value] : saved;

  const typed = query.trim();
  const match = existing.find((category) => sameCategory(category, typed));
  // The typed text itself becomes an item, rendered as "Criar «…»"; the combobox filter
  // always keeps it, since it contains the query.
  const createCandidate = typed.length >= 2 && !match ? typed : null;
  const items = createCandidate ? [...existing, createCandidate] : existing;

  const commit = (next: string) => {
    const resolved = existing.find((category) => sameCategory(category, next.trim())) ?? next.trim();
    setQuery(resolved);
    onChange(resolved);
  };

  return (
    <Combobox
      items={items}
      value={value || null}
      onValueChange={(next) => commit((next as string | null) ?? "")}
      inputValue={query}
      onInputValueChange={setQuery}
      autoHighlight
    >
      <ComboboxInput
        id={id}
        className="w-full"
        placeholder="Selecione ou crie uma categoria"
        autoComplete="off"
        aria-invalid={invalid}
        onBlur={() => {
          if (typed !== value) commit(typed);
          onBlur();
        }}
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {categories.isPending ? "Carregando categorias…" : "Digite para criar uma categoria."}
        </ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item === createCandidate ? (
                <>
                  <Plus aria-hidden />
                  Criar “{item}”
                </>
              ) : (
                item
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
