import type { Product } from "../../products/product.repository";

// Projection of a product for the model. Every field costs tokens on each following
// loop iteration, so only what an answer needs goes in: no imageUrl, dates or ids of
// other entities, and a short description in listings.

export const SHORT_DESCRIPTION_LENGTH = 200;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "R$ 189,90". Intl uses a non-breaking space after "R$"; a plain one is friendlier to the model. */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export type ProductView = {
  id: string;
  name: string;
  category: string;
  /** Formatted for the answer, so the model never does currency math. */
  price: string;
  priceCents: number;
  description: string;
};

export function toProductView(product: Product, { fullDescription = false } = {}): ProductView {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: formatBRL(product.priceCents),
    priceCents: product.priceCents,
    description: fullDescription
      ? product.description
      : truncate(product.description, SHORT_DESCRIPTION_LENGTH),
  };
}
