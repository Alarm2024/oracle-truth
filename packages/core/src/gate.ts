import type {
  GateEvidence,
  GateInput,
  GateResult,
  GateThresholds,
  PerpOracleSnapshot,
  ReasonCode,
} from "./types.js";
import { DEFAULT_THRESHOLDS } from "./types.js";
import {
  divergenceBps,
  maxDivergenceBps,
  medianSpotReference,
  venueSpreadBps,
} from "./utils/math.js";

function pickPrimaryPerp(snapshots: PerpOracleSnapshot[]): PerpOracleSnapshot | undefined {
  return snapshots.find((s) => s.source === "drift") ?? snapshots[0];
}

function oracleAgeMs(
  snapshot: PerpOracleSnapshot | undefined,
  now: Date
): number | "UNKNOWN" {
  if (!snapshot?.oracleUpdatedAt) return snapshot?.oracleAgeMs ?? "UNKNOWN";
  const updated = new Date(snapshot.oracleUpdatedAt).getTime();
  if (Number.isNaN(updated)) return "UNKNOWN";
  return Math.max(0, now.getTime() - updated);
}

export function evaluateGate(input: GateInput): GateResult {
  const thresholds: GateThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...input.thresholds,
  };
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();

  const spotReference = medianSpotReference(input.venuePrices);
  const spread = venueSpreadBps(input.venuePrices);
  const primary = pickPrimaryPerp(input.perpSnapshots);

  const markPrice = primary?.markPrice ?? "UNKNOWN";
  const oraclePrice = primary?.oraclePrice ?? "UNKNOWN";
  const age =
    primary?.oracleAgeMs !== undefined && primary.oracleAgeMs !== "UNKNOWN"
      ? primary.oracleAgeMs
      : oracleAgeMs(primary, now);

  const markDiv = divergenceBps(markPrice, spotReference);
  const oracleDiv = divergenceBps(oraclePrice, spotReference);
  const maxDiv = maxDivergenceBps(markDiv, oracleDiv);

  const evidence: GateEvidence = {
    asset: input.asset,
    timestamp,
    spotReference,
    venuePrices: input.venuePrices,
    venueSpreadBps: spread,
    perpSnapshots: input.perpSnapshots,
    markPrice,
    oraclePrice,
    divergenceBps: maxDiv,
    oracleAgeMs: age,
    rpc: input.rpc,
    thresholds,
  };

  const checks: Array<{ code: ReasonCode; fail: boolean }> = [
    {
      code: "RPC_BEHIND",
      fail:
        input.rpc?.slotLag !== undefined &&
        input.rpc.slotLag !== "UNKNOWN" &&
        input.rpc.slotLag > thresholds.maxRpcSlotLag,
    },
    {
      code: "ORACLE_STALE",
      fail:
        age !== "UNKNOWN" && age > thresholds.maxOracleAgeMs,
    },
    {
      code: "VENUES_DISAGREE",
      fail:
        spread !== "UNKNOWN" && spread > thresholds.maxVenueSpreadBps,
    },
    {
      code: "DIVERGED_X_BPS",
      fail:
        maxDiv !== "UNKNOWN" && maxDiv > thresholds.maxDivergenceBps,
    },
  ];

  for (const check of checks) {
    if (check.fail) {
      return { decision: "refuse", reasonCode: check.code, evidence };
    }
  }

  return { decision: "allow", evidence };
}
