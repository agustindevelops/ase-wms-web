export type PackageMedia = {
  id: string;
  fileId: string;
  type: "image" | "video";
  contentType: string;
  url: string | null;
};

export const PACKAGE_SUMMARY_MAX_LENGTH = 1024;

export type PackageDetail = {
  id: string;
  name: string;
  summary: string | null;
  description: string | null;
  basePriceCents: number;
  items: Array<{ id: string; itemId: string; name: string; quantity: number }>;
  media: PackageMedia[];
};

export type PackagePayload = {
  name: string;
  summary: string | null;
  description: string | null;
  basePriceCents: number;
  items: Array<{ itemId: string; quantity: number }>;
  media: Array<{ fileId: string }>;
};

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function centsToInput(cents: number | null | undefined): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

/** "12.5" → 1250. Empty → null. Invalid → NaN so callers can reject it. */
export function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) {
    return Number.NaN;
  }
  return Math.round(Number(trimmed) * 100);
}
