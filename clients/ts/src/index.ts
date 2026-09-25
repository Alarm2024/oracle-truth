import type { GateResult, PerpAsset, ResolutionEvidence } from "@oracle-truth/core";

export interface OracleTruthClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class OracleTruthClient {
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(options: OracleTruthClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:3000").replace(/\/$/, "");
    this.fetchFn = options.fetch ?? fetch;
  }

  async checkGate(asset: PerpAsset, options?: { fixture?: string }): Promise<GateResult> {
    const params = new URLSearchParams();
    if (options?.fixture) {
      params.set("mode", "fixture");
      params.set("fixture", options.fixture);
    }
    const qs = params.toString() ? `?${params}` : "";
    const res = await this.fetchFn(`${this.baseUrl}/api/gate/${asset}${qs}`);
    if (!res.ok) throw new Error(`Gate check failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<GateResult>;
  }

  async checkAllGates(): Promise<Record<PerpAsset, GateResult>> {
    const res = await this.fetchFn(`${this.baseUrl}/api/gate/all`);
    if (!res.ok) throw new Error(`Gate check failed: ${res.status}`);
    return res.json() as Promise<Record<PerpAsset, GateResult>>;
  }

  async getResolutionEvidence(params: {
    asset?: PerpAsset;
    strike: number;
    time?: string;
    question?: string;
  }): Promise<ResolutionEvidence> {
    const qs = new URLSearchParams({
      asset: params.asset ?? "SOL",
      strike: String(params.strike),
    });
    if (params.time) qs.set("time", params.time);
    if (params.question) qs.set("question", params.question);

    const res = await this.fetchFn(`${this.baseUrl}/api/prediction/resolve?${qs}`);
    if (!res.ok) throw new Error(`Resolution failed: ${res.status}`);
    return res.json() as Promise<ResolutionEvidence>;
  }

  /** Returns true only when gate allows — convenience for bots */
  async shouldAllowTrade(asset: PerpAsset): Promise<boolean> {
    const result = await this.checkGate(asset);
    return result.decision === "allow";
  }
}

export { evaluateGate, type GateResult, type PerpAsset, type ResolutionEvidence } from "@oracle-truth/core";
