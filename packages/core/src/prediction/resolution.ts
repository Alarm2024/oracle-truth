import type { PerpAsset, ResolutionEvidence, ResolutionSourceRecord, VenuePrice } from "../types.js";
import { hashRaw } from "../utils/hash.js";
import { medianSpotReference, venueSpreadBps } from "../utils/math.js";

export interface ResolutionInput {
  question: string;
  asset: PerpAsset;
  strikePrice: number;
  resolutionTime: string;
  sources: Array<{
    source: string;
    price: number | "UNKNOWN";
    fetchedAt: string;
    raw?: string;
    error?: string;
  }>;
  /** Max spread in bps for sources to agree (default 100) */
  maxConsensusBps?: number;
}

export function buildResolutionEvidence(input: ResolutionInput): ResolutionEvidence {
  const maxConsensusBps = input.maxConsensusBps ?? 100;

  const sourceRecords: ResolutionSourceRecord[] = input.sources.map((s) => ({
    source: s.source,
    price: s.price,
    fetchedAt: s.fetchedAt,
    rawHash: hashRaw(s.raw ?? JSON.stringify({ source: s.source, price: s.price, at: s.fetchedAt })),
    error: s.error,
  }));

  const venuePrices: VenuePrice[] = input.sources.map((s) => ({
    venue: s.source,
    price: s.price,
    timestamp: s.fetchedAt,
  }));

  const medianPrice = medianSpotReference(venuePrices);
  const consensusBps = venueSpreadBps(venuePrices);

  let agreeAboveStrike: boolean | "UNKNOWN" = "UNKNOWN";
  let agreeBelowStrike: boolean | "UNKNOWN" = "UNKNOWN";

  const numericPrices = input.sources
    .map((s) => s.price)
    .filter((p): p is number => typeof p === "number");

  if (numericPrices.length > 0) {
    agreeAboveStrike = numericPrices.every((p) => p > input.strikePrice);
    agreeBelowStrike = numericPrices.every((p) => p < input.strikePrice);
  }

  const spreadOk =
    consensusBps !== "UNKNOWN" && consensusBps <= maxConsensusBps;

  let canResolve = false;
  let resolveDirection: "yes" | "no" | "ambiguous" | undefined;
  const notes: string[] = [];

  if (consensusBps === "UNKNOWN") {
    notes.push("Insufficient source data for consensus measurement");
  } else if (!spreadOk) {
    notes.push(`Source spread ${consensusBps} bps exceeds ${maxConsensusBps} bps threshold`);
  }

  if (spreadOk && agreeAboveStrike) {
    canResolve = true;
    resolveDirection = "yes";
  } else if (spreadOk && agreeBelowStrike) {
    canResolve = true;
    resolveDirection = "no";
  } else if (spreadOk && !agreeAboveStrike && !agreeBelowStrike) {
    canResolve = false;
    resolveDirection = "ambiguous";
    notes.push("Sources agree with each other but straddle the strike");
  }

  return {
    question: input.question,
    asset: input.asset,
    strikePrice: input.strikePrice,
    resolutionTime: input.resolutionTime,
    sources: sourceRecords,
    medianPrice,
    agreeAboveStrike,
    agreeBelowStrike,
    consensusBps,
    canResolve,
    resolveDirection,
    notes: notes.length ? notes : undefined,
  };
}
