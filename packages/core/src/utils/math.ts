import type { VenuePrice } from "../types.js";

/** Compute median of numeric venue prices; returns UNKNOWN if fewer than 1 valid price */
export function medianSpotReference(venues: VenuePrice[]): number | "UNKNOWN" {
  const prices = venues
    .map((v) => v.price)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p))
    .sort((a, b) => a - b);

  if (prices.length === 0) return "UNKNOWN";

  const mid = Math.floor(prices.length / 2);
  if (prices.length % 2 === 0) {
    return (prices[mid - 1]! + prices[mid]!) / 2;
  }
  return prices[mid]!;
}

/** Spread between highest and lowest venue price in basis points */
export function venueSpreadBps(venues: VenuePrice[]): number | "UNKNOWN" {
  const prices = venues
    .map((v) => v.price)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p));

  if (prices.length < 2) return "UNKNOWN";

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const mid = (min + max) / 2;
  if (mid === 0) return "UNKNOWN";

  return Math.round(((max - min) / mid) * 10_000);
}

/** Divergence of a price from reference in basis points */
export function divergenceBps(
  price: number | "UNKNOWN",
  reference: number | "UNKNOWN"
): number | "UNKNOWN" {
  if (price === "UNKNOWN" || reference === "UNKNOWN" || reference === 0) {
    return "UNKNOWN";
  }
  return Math.round((Math.abs(price - reference) / reference) * 10_000);
}

export function maxDivergenceBps(
  ...values: Array<number | "UNKNOWN">
): number | "UNKNOWN" {
  const nums = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  if (nums.length === 0) return "UNKNOWN";
  return Math.max(...nums);
}
