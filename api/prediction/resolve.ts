import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runLiveResolution, type PerpAsset } from "@oracle-truth/core";
import { handleOptions, queryString, setCors } from "../_lib/http";

const ASSETS: PerpAsset[] = ["SOL", "BTC", "ETH"];
const PLAIN_STRIKE = /^\d+(\.\d+)?$/;
const OBSERVATION_WINDOW_MS = 60_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const asset = (queryString(req.query.asset, "SOL") ?? "SOL").toUpperCase() as PerpAsset;
  const strikeRaw = queryString(req.query.strike);
  const timeRaw = queryString(req.query.time);

  if (!ASSETS.includes(asset)) {
    res.status(400).json({ error: "Invalid asset or strike" });
    return;
  }

  if (
    strikeRaw === undefined ||
    !PLAIN_STRIKE.test(strikeRaw) ||
    !(Number(strikeRaw) > 0)
  ) {
    res.status(400).json({ error: "strike required" });
    return;
  }
  const strike = Number(strikeRaw);

  const nowMs = Date.now();
  let resolutionTime: string;
  if (timeRaw === undefined) {
    resolutionTime = new Date(nowMs).toISOString();
  } else {
    const parsed = Date.parse(timeRaw);
    if (!Number.isFinite(parsed) || Math.abs(parsed - nowMs) > OBSERVATION_WINDOW_MS) {
      res.status(400).json({ error: "only current observations are supported" });
      return;
    }
    resolutionTime = timeRaw;
  }

  const question =
    queryString(req.query.question) ?? `${asset} above $${strike} at ${resolutionTime}?`;

  try {
    const evidence = await runLiveResolution({
      question,
      asset,
      strikePrice: strike,
      resolutionTime,
    });
    res.status(200).json(evidence);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
}
