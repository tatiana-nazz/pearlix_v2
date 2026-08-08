export type InvoiceDatePreset = "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "ALL_TIME" | "CUSTOM";

const invoiceQueryKeys = ["status", "currency", "search", "date_from", "date_to", "patient_id", "page"] as const;

export function invoiceQueryFromSearch(searchParams: URLSearchParams) {
  return Object.fromEntries(
    invoiceQueryKeys
      .map((key) => [key, searchParams.get(key) || undefined] as const)
      .filter((entry): entry is readonly [typeof invoiceQueryKeys[number], string] => Boolean(entry[1])),
  );
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function dateRangeForPreset(preset: Exclude<InvoiceDatePreset, "CUSTOM">, clinicDate: string) {
  if (preset === "ALL_TIME") return { date_from: "", date_to: "" };
  if (preset === "TODAY") return { date_from: clinicDate, date_to: clinicDate };
  return {
    date_from: shiftIsoDate(clinicDate, preset === "LAST_7_DAYS" ? -6 : -29),
    date_to: clinicDate,
  };
}

export function activeDatePreset(dateFrom: string, dateTo: string, clinicDate: string): InvoiceDatePreset {
  if (!dateFrom && !dateTo) return "ALL_TIME";
  for (const preset of ["TODAY", "LAST_7_DAYS", "LAST_30_DAYS"] as const) {
    const range = dateRangeForPreset(preset, clinicDate);
    if (range.date_from === dateFrom && range.date_to === dateTo) return preset;
  }
  return "CUSTOM";
}
