// pt-BR copy for the agent's tools (apps/server/src/modules/chat/tools). The input shapes
// mirror the server's zod schemas; they arrive as `unknown` and are read defensively, since
// a field the server adds later must not break the chat.

import { formatBRL } from "@/lib/format";

type Input = Record<string, unknown>;

function asInput(input: unknown): Input {
  return typeof input === "object" && input !== null ? (input as Input) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The tool takes prices in reais (as the customer says them), not cents. */
function reais(value: number): string {
  return formatBRL(Math.round(value * 100));
}

const SORT_LABELS: Record<string, string> = {
  newest: "mais recentes",
  price_asc: "menor preço",
  price_desc: "maior preço",
  name_asc: "nome (A–Z)",
};

function priceRange(input: Input): string | null {
  const min = number(input.minPrice);
  const max = number(input.maxPrice);
  if (min !== null && max !== null) return `de ${reais(min)} a ${reais(max)}`;
  if (max !== null) return `até ${reais(max)}`;
  if (min !== null) return `a partir de ${reais(min)}`;
  return null;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Chip text while the call runs, e.g. "Buscando produtos: kit presente, até R$ 100,00". */
export function toolRunningLabel(name: string, rawInput: unknown): string {
  const input = asInput(rawInput);
  switch (name) {
    case "search_products": {
      const category = text(input.category);
      const parts = [text(input.query), category && `em ${category}`, priceRange(input)].filter(Boolean);
      return parts.length > 0 ? `Buscando produtos: ${parts.join(", ")}…` : "Buscando produtos…";
    }
    case "get_product_details":
      return "Consultando detalhes do produto…";
    case "list_categories":
      return "Consultando categorias…";
    default:
      return "Consultando o catálogo…";
  }
}

/** Chip text once the call finished. */
export function toolResultLabel(name: string, resultCount: number | undefined, error: string | undefined): string {
  if (error !== undefined) {
    // Not found is an answer ("that product does not exist"), not a failure.
    if (error === "product_not_found") return "Produto não encontrado";
    // invalid_input, invalid_arguments, unknown_tool: the model gets the error back and
    // usually corrects itself on the next step.
    return "Consulta recusada pelo servidor";
  }
  const count = resultCount ?? 0;
  switch (name) {
    case "search_products":
      return count === 0 ? "Nenhum produto encontrado" : `${plural(count, "produto encontrado", "produtos encontrados")}`;
    case "get_product_details":
      return "Detalhes do produto consultados";
    case "list_categories":
      return plural(count, "categoria", "categorias");
    default:
      return "Consulta concluída";
  }
}

/** Short name for the disclosure list. */
export function toolTitle(name: string): string {
  switch (name) {
    case "search_products":
      return "Busca de produtos";
    case "get_product_details":
      return "Detalhes do produto";
    case "list_categories":
      return "Lista de categorias";
    default:
      return name;
  }
}

/**
 * The validated input as label/value pairs, skipping the nulls (the tools require every
 * field and use null for "not informed"). Unknown fields are shown with their raw name.
 */
export function describeToolInput(rawInput: unknown): Array<{ label: string; value: string }> {
  const input = asInput(rawInput);
  const rows: Array<{ label: string; value: string }> = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    switch (key) {
      case "query":
        rows.push({ label: "Termo", value: `“${String(value)}”` });
        break;
      case "category":
        rows.push({ label: "Categoria", value: String(value) });
        break;
      case "minPrice":
      case "maxPrice": {
        const amount = number(value);
        rows.push({
          label: key === "minPrice" ? "Preço mínimo" : "Preço máximo",
          value: amount === null ? String(value) : reais(amount),
        });
        break;
      }
      case "sort":
        rows.push({ label: "Ordem", value: SORT_LABELS[String(value)] ?? String(value) });
        break;
      case "limit":
        rows.push({ label: "Limite", value: String(value) });
        break;
      case "productId":
        rows.push({ label: "Produto", value: String(value) });
        break;
      default:
        rows.push({ label: key, value: typeof value === "string" ? value : JSON.stringify(value) });
    }
  }
  return rows;
}
