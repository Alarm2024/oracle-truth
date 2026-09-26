import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBinanceSpot,
  fetchCoinbaseSpot,
  fetchJupiterSpot,
  fetchKrakenSpot,
  fetchOkxSpot,
} from "../src/spot/fetchers.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("spot fetchers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { label: "zero", text: "0", numeric: 0 },
    { label: "negative", text: "-1.25", numeric: -1.25 },
  ])("maps a $label price to UNKNOWN on every venue", async ({ text, numeric }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("binance.com")) return json({ price: text });
        if (url.includes("okx.com")) return json({ data: [{ last: text }] });
        if (url.includes("kraken.com")) return json({ result: { PAIR: { c: [text] } } });
        if (url.includes("coinbase.com")) return json({ price: text });
        if (url.includes("jup.ag")) return json({ [SOL_MINT]: { usdPrice: numeric } });
        throw new Error(`unexpected url ${url}`);
      })
    );

    const quotes = await Promise.all([
      fetchBinanceSpot("SOL"),
      fetchOkxSpot("SOL"),
      fetchKrakenSpot("SOL"),
      fetchCoinbaseSpot("SOL"),
      fetchJupiterSpot("SOL"),
    ]);

    expect(quotes.map((quote) => quote.price)).toEqual([
      "UNKNOWN",
      "UNKNOWN",
      "UNKNOWN",
      "UNKNOWN",
      "UNKNOWN",
    ]);
  });
});
