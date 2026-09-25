import type { PerpAsset, VenuePrice } from "../types.js";

const VENUE_SYMBOLS: Record<
  PerpAsset,
  { binance: string; okx: string; kraken: string; coinbase: string; jupiter: string }
> = {
  SOL: {
    binance: "SOLUSDT",
    okx: "SOL-USDT",
    kraken: "SOLUSD",
    coinbase: "SOL-USD",
    jupiter: "So11111111111111111111111111111111111111112",
  },
  BTC: {
    binance: "BTCUSDT",
    okx: "BTC-USDT",
    kraken: "XBTUSD",
    coinbase: "BTC-USD",
    jupiter: "UNKNOWN",
  },
  ETH: {
    binance: "ETHUSDT",
    okx: "ETH-USDT",
    kraken: "ETHUSD",
    coinbase: "ETH-USD",
    jupiter: "UNKNOWN",
  },
};

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | "UNKNOWN"> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return "UNKNOWN";
    return (await res.json()) as T;
  } catch {
    return "UNKNOWN";
  }
}

export async function fetchBinanceSpot(asset: PerpAsset): Promise<VenuePrice> {
  const symbol = VENUE_SYMBOLS[asset].binance;
  const data = await fetchJson<{ price: string }>(
    `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
  );
  if (data === "UNKNOWN") {
    return { venue: "binance", price: "UNKNOWN", error: "fetch failed" };
  }
  const price = parseFloat(data.price);
  return {
    venue: "binance",
    price: Number.isFinite(price) ? price : "UNKNOWN",
    timestamp: new Date().toISOString(),
  };
}

export async function fetchOkxSpot(asset: PerpAsset): Promise<VenuePrice> {
  const instId = VENUE_SYMBOLS[asset].okx;
  const data = await fetchJson<{ data?: Array<{ last: string }> }>(
    `https://www.okx.com/api/v5/market/ticker?instId=${instId}`
  );
  if (data === "UNKNOWN" || !data.data?.[0]) {
    return { venue: "okx", price: "UNKNOWN", error: "fetch failed" };
  }
  const price = parseFloat(data.data[0].last);
  return {
    venue: "okx",
    price: Number.isFinite(price) ? price : "UNKNOWN",
    timestamp: new Date().toISOString(),
  };
}

export async function fetchKrakenSpot(asset: PerpAsset): Promise<VenuePrice> {
  const pair = VENUE_SYMBOLS[asset].kraken;
  const data = await fetchJson<{ result?: Record<string, { c?: string[] }> }>(
    `https://api.kraken.com/0/public/Ticker?pair=${pair}`
  );
  if (data === "UNKNOWN" || !data.result) {
    return { venue: "kraken", price: "UNKNOWN", error: "fetch failed" };
  }
  const entry = Object.values(data.result)[0];
  const price = entry?.c?.[0] ? parseFloat(entry.c[0]) : NaN;
  return {
    venue: "kraken",
    price: Number.isFinite(price) ? price : "UNKNOWN",
    timestamp: new Date().toISOString(),
  };
}

export async function fetchCoinbaseSpot(asset: PerpAsset): Promise<VenuePrice> {
  const product = VENUE_SYMBOLS[asset].coinbase;
  const data = await fetchJson<{ price?: string }>(
    `https://api.exchange.coinbase.com/products/${product}/ticker`
  );
  if (data === "UNKNOWN") {
    return { venue: "coinbase", price: "UNKNOWN", error: "fetch failed" };
  }
  const price = data.price ? parseFloat(data.price) : NaN;
  return {
    venue: "coinbase",
    price: Number.isFinite(price) ? price : "UNKNOWN",
    timestamp: new Date().toISOString(),
  };
}

export async function fetchJupiterSpot(asset: PerpAsset): Promise<VenuePrice> {
  const mint = VENUE_SYMBOLS[asset].jupiter;
  if (mint === "UNKNOWN") {
    return { venue: "jupiter", price: "UNKNOWN", error: "no jupiter mint for asset" };
  }
  const data = await fetchJson<{ data?: Record<string, { price?: number }> }>(
    `https://api.jup.ag/price/v2?ids=${mint}`
  );
  if (data === "UNKNOWN" || !data.data?.[mint]) {
    return { venue: "jupiter", price: "UNKNOWN", error: "fetch failed" };
  }
  const price = data.data[mint].price;
  return {
    venue: "jupiter",
    price: typeof price === "number" && Number.isFinite(price) ? price : "UNKNOWN",
    timestamp: new Date().toISOString(),
  };
}

/** Fetch all spot venues in parallel; only responding venues contribute to median */
export async function fetchAllSpotVenues(asset: PerpAsset): Promise<VenuePrice[]> {
  const results = await Promise.all([
    fetchBinanceSpot(asset),
    fetchOkxSpot(asset),
    fetchKrakenSpot(asset),
    fetchCoinbaseSpot(asset),
    fetchJupiterSpot(asset),
  ]);
  return results;
}
