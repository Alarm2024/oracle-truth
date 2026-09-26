import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateGate, type PerpAsset } from "@oracle-truth/core";

export function loadFixtureGate(
  asset: PerpAsset,
  fixtureName: string
): Parameters<typeof evaluateGate>[0] {
  const path = join(process.cwd(), "fixtures", `${fixtureName}.json`);
  const raw = readFileSync(path, "utf-8");
  const fixture = JSON.parse(raw) as { input: Parameters<typeof evaluateGate>[0] };
  return { ...fixture.input, asset };
}
