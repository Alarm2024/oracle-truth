import type { GateInput, GateResult, PerpAsset, ResolutionEvidence } from "./types.js";
import { evaluateGate } from "./gate.js";
import { fetchDriftPerpSnapshot } from "./perps/drift.js";
import { fetchJupiterPerpSnapshot } from "./perps/jupiter.js";
import { fetchAllSpotVenues } from "./spot/fetchers.js";
import { enrichRpcWithOracleSlot, fetchRpcSnapshot } from "./rpc/solana.js";
import { buildResolutionEvidence, type ResolutionInput } from "./prediction/resolution.js";

export async function runLiveGateCheck(asset: PerpAsset): Promise<GateResult> {
  const [venuePrices, drift, jupiter, rpcBase] = await Promise.all([
    fetchAllSpotVenues(asset),
    fetchDriftPerpSnapshot(asset),
    fetchJupiterPerpSnapshot(asset),
    fetchRpcSnapshot(),
  ]);

  const perpSnapshots = [drift, jupiter];
  const rpc = await enrichRpcWithOracleSlot(rpcBase, "UNKNOWN");

  const input: GateInput = {
    asset,
    venuePrices,
    perpSnapshots,
    rpc,
  };

  return evaluateGate(input);
}

export async function runLiveResolution(
  input: Omit<ResolutionInput, "sources"> & { asset: PerpAsset }
): Promise<ResolutionEvidence> {
  const venues = await fetchAllSpotVenues(input.asset);
  const sources = venues.map((v) => ({
    source: v.venue,
    price: v.price,
    fetchedAt: v.timestamp ?? new Date().toISOString(),
    raw: JSON.stringify(v),
    error: v.error,
  }));

  return buildResolutionEvidence({ ...input, sources });
}

export { evaluateGate, buildResolutionEvidence };
export * from "./types.js";
export * from "./gate.js";
export * from "./spot/fetchers.js";
export * from "./perps/drift.js";
export * from "./perps/jupiter.js";
export * from "./rpc/solana.js";
export * from "./prediction/resolution.js";
export * from "./utils/math.js";
export * from "./utils/hash.js";
