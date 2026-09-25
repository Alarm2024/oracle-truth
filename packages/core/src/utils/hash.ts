import { createHash } from "node:crypto";

/** SHA-256 hash of canonical JSON for audit trail */
export function hashPayload(payload: unknown): string {
  const canonical = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

export function hashRaw(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
