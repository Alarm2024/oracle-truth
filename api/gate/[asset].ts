import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  evaluateGate,
  runLiveGateCheck,
  type PerpAsset,
} from "@oracle-truth/core";
import { loadFixtureGate } from "../_lib/fixtures";
import { handleOptions, queryString, setCors } from "../_lib/http";

const ASSETS: PerpAsset[] = ["SOL", "BTC", "ETH"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const assetParam = queryString(req.query.asset)?.toUpperCase();
  if (!assetParam || !ASSETS.includes(assetParam as PerpAsset)) {
    res.status(400).json({ error: "Invalid asset — use SOL, BTC, or ETH" });
    return;
  }
  const asset = assetParam as PerpAsset;
  const mode = queryString(req.query.mode);
  const fixture = queryString(req.query.fixture, "allow-clean") ?? "allow-clean";

  try {
    const result =
      mode === "fixture"
        ? evaluateGate(loadFixtureGate(asset, fixture))
        : await runLiveGateCheck(asset);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
