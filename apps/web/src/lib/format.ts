// Money is integer cents end to end (D-13). Division by 100 happens only to display a
// value; parsing and the input mask work on digit strings, so no float reaches a payload.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integerPtBR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

// 15 digits of cents stay below Number.MAX_SAFE_INTEGER (16 digits).
const MAX_CENTS_DIGITS = 15;

/** 123456 → "R$ 1.234,56" */
export function formatBRL(priceCents: number): string {
  return brl.format(priceCents / 100);
}

/** 123456 → "1.234,56": the price input's text, without the "R$" (shown as an addon). */
export function centsToPriceInput(priceCents: number): string {
  const reais = Math.trunc(priceCents / 100);
  const cents = String(priceCents % 100).padStart(2, "0");
  return `${integerPtBR.format(reais)},${cents}`;
}

/**
 * Input mask, cash-register style: digits fill from the right, so typing "1", "2", "3"
 * shows "0,01", "0,12", "1,23". The field always holds a well-formed value and the
 * user never has to type the comma. Anything that is not a digit is ignored.
 */
export function maskPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const cents = Number(digits.replace(/^0+/, "").slice(0, MAX_CENTS_DIGITS) || "0");
  // Typing "0" gives "0,00" (free products are valid). A formatted value always has 3+
  // digits, so a comma with fewer means the user is erasing "0,00": clear the field.
  if (digits === "" || (cents === 0 && digits.length < 3 && raw.includes(","))) return "";
  return centsToPriceInput(cents);
}

// "1.234,56", "1234,56", "12", "12,5". Thousands dots are optional but, when present,
// must group by three: "1.23,00" is rejected instead of guessed.
const PRICE_PT_BR = /^(\d{1,3}(\.\d{3})*|\d+)(,\d{1,2})?$/;

/** "1.234,56" → 123456; returns null for anything that is not a pt-BR amount. */
export function parseBRLToCents(input: string): number | null {
  const value = input.replace(/^R\$\s*/, "").trim();
  if (!PRICE_PT_BR.test(value)) return null;

  const [reais, cents = ""] = value.replace(/\./g, "").split(",");
  const digits = `${reais}${cents.padEnd(2, "0")}`;
  const result = Number(digits);
  return Number.isSafeInteger(result) ? result : null;
}

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const shortDateWithYear = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * ISO date → "agora", "há 5 minutos", "há 3 horas", "ontem", "há 4 dias", then a short
 * date ("12 de set.", with the year when it is not the current one). Computed at render:
 * a list left open for hours shows stale labels until its next refetch, which is fine
 * for a history sidebar.
 */
export function formatRelativeDate(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  const diff = now - date.getTime();
  if (diff < MINUTE) return "agora";
  if (diff < HOUR) return relative.format(-Math.floor(diff / MINUTE), "minute");
  if (diff < DAY) return relative.format(-Math.floor(diff / HOUR), "hour");
  if (diff < 7 * DAY) return relative.format(-Math.floor(diff / DAY), "day");
  return date.getFullYear() === new Date(now).getFullYear() ? shortDate.format(date) : shortDateWithYear.format(date);
}
