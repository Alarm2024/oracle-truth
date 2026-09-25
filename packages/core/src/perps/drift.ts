import type { PerpAsset, PerpOracleSnapshot } from "../types.js";

/** Drift market index mapping (mainnet) — read-only stats API */
const DRIFT_MARKET_INDEX: Partial<Record<PerpAsset, number>> = {
  SOL: 0,
  BTC: 1,
  ETH: 2,
};

export interface DriftStatsResponse {
  marketIndex?: number;
  markPrice?: number;
  oraclePrice?: number;
  oracleSlot?: number;
  oracleTwap?: number;
  lastOracleUpdate?: number;
}

async function fetchDriftStats(marketIndex: number): Promise<DriftStatsResponse | "UNKNOWN"> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://mainnet-beta.api.drift.trade/stats/market/${marketIndex}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return "UNKNOWN";
    return (await res.json()) as DriftStatsResponse;
  } catch {
    return "UNKNOWN";
  }
}

export async function fetchDriftPerpSnapshot(asset: PerpAsset): Promise<PerpOracleSnapshot> {
  const fetchedAt = new Date().toISOString();
  const marketIndex = DRIFT_MARKET_INDEX[asset];
  if (marketIndex === undefined) {
    return {
      source: "drift",
      markPrice: "UNKNOWN",
      oraclePrice: "UNKNOWN",
      fetchedAt,
    };
  }

  const stats = await fetchDriftStats(marketIndex);
  if (stats === "UNKNOWN") {
    return {
      source: "drift",
      markPrice: "UNKNOWN",
      oraclePrice: "UNKNOWN",
      fetchedAt,
    };
  }

  const oracleUpdatedAt =
    stats.lastOracleUpdate !== undefined
      ? new Date(stats.lastOracleUpdate * 1000).toISOString()
      : undefined;

  const oracleAgeMs =
    stats.lastOracleUpdate !== undefined
      ? Math.max(0, Date.now() - stats.lastOracleUpdate * 1000)
      : "UNKNOWN";

  return {
    source: "drift",
    markPrice:
      typeof stats.markPrice === "number" ? stats.markPrice / 1e6 : "UNKNOWN",
    oraclePrice:
      typeof stats.oraclePrice === "number" ? stats.oraclePrice / 1e6 : "UNKNOWN",
    oracleUpdatedAt,
    oracleAgeMs,
    fetchedAt,
  };
}
