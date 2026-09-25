import type { RpcSnapshot } from "../types.js";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

export async function fetchRpcSnapshot(
  rpcUrl = process.env.SOLANA_RPC_URL ?? DEFAULT_RPC
): Promise<RpcSnapshot> {
  const fetchedAt = new Date().toISOString();

  async function rpc(method: string, params: unknown[] = []): Promise<unknown | "UNKNOWN"> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return "UNKNOWN";
      const body = (await res.json()) as { result?: unknown };
      return body.result ?? "UNKNOWN";
    } catch {
      return "UNKNOWN";
    }
  }

  const slot = await rpc("getSlot");
  const currentSlot = typeof slot === "number" ? slot : "UNKNOWN";

  return {
    currentSlot,
    oracleSlot: "UNKNOWN",
    slotLag: "UNKNOWN",
    fetchedAt,
  };
}

/** Compute slot lag when oracle slot is known */
export function computeSlotLag(
  currentSlot: number | "UNKNOWN",
  oracleSlot: number | "UNKNOWN"
): number | "UNKNOWN" {
  if (currentSlot === "UNKNOWN" || oracleSlot === "UNKNOWN") return "UNKNOWN";
  return Math.max(0, currentSlot - oracleSlot);
}

export async function enrichRpcWithOracleSlot(
  rpc: RpcSnapshot,
  oracleSlot: number | "UNKNOWN"
): Promise<RpcSnapshot> {
  const slotLag = computeSlotLag(rpc.currentSlot, oracleSlot);
  return { ...rpc, oracleSlot, slotLag };
}
