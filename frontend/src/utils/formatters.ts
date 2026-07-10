export function displayText(value: string | number | null | undefined, fallback = "Not recorded"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
}

export function formatCurrencyAmount(amount: string | number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "Not recorded";
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numericAmount) || !currency) return `${amount} ${currency ?? ""}`.trim();
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(numericAmount);
}
