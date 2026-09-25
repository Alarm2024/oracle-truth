/** Supported perpetual assets */
export type PerpAsset = "SOL" | "BTC" | "ETH";

/** Gate refusal reason codes */
export type ReasonCode =
  | "ORACLE_STALE"
  | "DIVERGED_X_BPS"
  | "RPC_BEHIND"
  | "VENUES_DISAGREE";

export type GateDecision = "allow" | "refuse";

export interface VenuePrice {
  venue: string;
  price: number | "UNKNOWN";
  timestamp?: string;
  error?: string;
}

export interface PerpOracleSnapshot {
  source: "drift" | "jupiter";
  markPrice: number | "UNKNOWN";
  oraclePrice: number | "UNKNOWN";
  oracleUpdatedAt?: string;
  oracleAgeMs?: number | "UNKNOWN";
  fetchedAt: string;
}

export interface RpcSnapshot {
  currentSlot: number | "UNKNOWN";
  oracleSlot?: number | "UNKNOWN";
  slotLag?: number | "UNKNOWN";
  fetchedAt: string;
}

export interface GateEvidence {
  asset: PerpAsset;
  timestamp: string;
  spotReference: number | "UNKNOWN";
  venuePrices: VenuePrice[];
  venueSpreadBps?: number | "UNKNOWN";
  perpSnapshots: PerpOracleSnapshot[];
  markPrice?: number | "UNKNOWN";
  oraclePrice?: number | "UNKNOWN";
  divergenceBps?: number | "UNKNOWN";
  oracleAgeMs?: number | "UNKNOWN";
  rpc?: RpcSnapshot;
  thresholds: GateThresholds;
  notes?: string[];
}

export interface GateThresholds {
  /** Max oracle age in ms before ORACLE_STALE (default 30_000) */
  maxOracleAgeMs: number;
  /** Max divergence from spot reference in bps before DIVERGED_X_BPS (default 50) */
  maxDivergenceBps: number;
  /** Max RPC slot lag before RPC_BEHIND (default 150) */
  maxRpcSlotLag: number;
  /** Max venue spread in bps before VENUES_DISAGREE (default 100) */
  maxVenueSpreadBps: number;
}

export const DEFAULT_THRESHOLDS: GateThresholds = {
  maxOracleAgeMs: 30_000,
  maxDivergenceBps: 50,
  maxRpcSlotLag: 150,
  maxVenueSpreadBps: 100,
};

export interface GateResult {
  decision: GateDecision;
  reasonCode?: ReasonCode;
  evidence: GateEvidence;
}

/** Prediction market resolution evidence */
export interface ResolutionSourceRecord {
  source: string;
  price: number | "UNKNOWN";
  fetchedAt: string;
  rawHash: string;
  error?: string;
}

export interface ResolutionEvidence {
  question: string;
  asset: PerpAsset;
  strikePrice: number;
  resolutionTime: string;
  sources: ResolutionSourceRecord[];
  medianPrice: number | "UNKNOWN";
  agreeAboveStrike: boolean | "UNKNOWN";
  agreeBelowStrike: boolean | "UNKNOWN";
  consensusBps: number | "UNKNOWN";
  canResolve: boolean;
  resolveDirection?: "yes" | "no" | "ambiguous";
  notes?: string[];
}

export interface GateInput {
  asset: PerpAsset;
  venuePrices: VenuePrice[];
  perpSnapshots: PerpOracleSnapshot[];
  rpc?: RpcSnapshot;
  thresholds?: Partial<GateThresholds>;
  now?: Date;
}
