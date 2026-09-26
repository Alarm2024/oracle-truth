import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runLiveResolution, type PerpAsset } from "@oracle-truth/core";
import { handleOptions, queryString, setCors } from "../_lib/http";

const ASSETS: PerpAsset[] = ["SOL", "BTC", "ETH"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const asset = (queryString(req.query.asset, "SOL") ?? "SOL").toUpperCase() as PerpAsset;
  const strike = Number(queryString(req.query.strike, "0"));
  const time = queryString(req.query.time) ?? new Date().toISOString();
  const question =
    queryString(req.query.question) ?? `${asset} above $${strike} at ${time}?`;

  if (!ASSETS.includes(asset) || !Number.isFinite(strike)) {
    res.status(400).json({ error: "Invalid asset or strike" });
    return;
  }

  try {
    const evidence = await runLiveResolution({
      question,
      asset,
      strikePrice: strike,
      resolutionTime: time,
    });
    res.status(200).json(evidence);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
