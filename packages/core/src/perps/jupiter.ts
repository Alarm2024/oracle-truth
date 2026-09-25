import type { PerpAsset, PerpOracleSnapshot } from "../types.js";

/** Jupiter Perps pool keys (read-only) — public jup.ag perps API */
const JUPITER_PERP_SYMBOL: Partial<Record<PerpAsset, string>> = {
  SOL: "SOL",
  BTC: "BTC",
  ETH: "ETH",
};

interface JupiterPerpMarket {
  symbol?: string;
  markPrice?: number;
  oraclePrice?: number;
  lastUpdated?: string;
}

async function fetchJupiterPerps(): Promise<JupiterPerpMarket[] | "UNKNOWN"> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://perps-api.jup.ag/v1/markets", {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return "UNKNOWN";
    const body = (await res.json()) as { markets?: JupiterPerpMarket[] } | JupiterPerpMarket[];
    if (Array.isArray(body)) return body;
    return body.markets ?? "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

export async function fetchJupiterPerpSnapshot(asset: PerpAsset): Promise<PerpOracleSnapshot> {
  const fetchedAt = new Date().toISOString();
  const symbol = JUPITER_PERP_SYMBOL[asset];
  if (!symbol) {
    return {
      source: "jupiter",
      markPrice: "UNKNOWN",
      oraclePrice: "UNKNOWN",
      fetchedAt,
    };
  }

  const markets = await fetchJupiterPerps();
  if (markets === "UNKNOWN") {
    return {
      source: "jupiter",
      markPrice: "UNKNOWN",
      oraclePrice: "UNKNOWN",
      fetchedAt,
    };
  }

  const market = markets.find(
    (m) => m.symbol?.toUpperCase() === symbol.toUpperCase()
  );

  if (!market) {
    return {
      source: "jupiter",
      markPrice: "UNKNOWN",
      oraclePrice: "UNKNOWN",
      fetchedAt,
    };
  }

  const oracleUpdatedAt = market.lastUpdated;
  const oracleAgeMs =
    oracleUpdatedAt !== undefined
      ? Math.max(0, Date.now() - new Date(oracleUpdatedAt).getTime())
      : "UNKNOWN";

  return {
    source: "jupiter",
    markPrice:
      typeof market.markPrice === "number" ? market.markPrice : "UNKNOWN",
    oraclePrice:
      typeof market.oraclePrice === "number" ? market.oraclePrice : "UNKNOWN",
    oracleUpdatedAt,
    oracleAgeMs,
    fetchedAt,
  };
}
