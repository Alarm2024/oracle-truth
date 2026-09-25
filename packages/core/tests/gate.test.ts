import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { evaluateGate } from "../src/gate.js";
import type { GateInput, GateResult, ReasonCode } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../../../fixtures");

interface FixtureFile {
  asset: string;
  description: string;
  input: GateInput & { now?: string };
  expected: {
    decision: "allow" | "refuse";
    reasonCode?: ReasonCode;
  };
}

function loadFixtures(): FixtureFile[] {
  return readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = readFileSync(join(fixturesDir, f), "utf-8");
      return JSON.parse(raw) as FixtureFile;
    });
}

describe("evaluateGate with seeded fixtures", () => {
  const fixtures = loadFixtures();

  for (const fixture of fixtures) {
    it(`${fixture.description}`, () => {
      const input: GateInput = {
        ...fixture.input,
        now: fixture.input.now ? new Date(fixture.input.now) : new Date("2026-09-25T12:00:00.000Z"),
      };

      const result: GateResult = evaluateGate(input);

      expect(result.decision).toBe(fixture.expected.decision);
      if (fixture.expected.reasonCode) {
        expect(result.reasonCode).toBe(fixture.expected.reasonCode);
      }
      expect(result.evidence).toBeDefined();
      if (result.decision === "refuse") {
        expect(result.reasonCode).toBeDefined();
        expect(result.evidence.asset).toBe(fixture.input.asset);
        expect(result.evidence.timestamp).toBeDefined();
      }
    });
  }
});

describe("evaluateGate unit checks", () => {
  it("refuses with evidence containing prices and sources on ORACLE_STALE", () => {
    const raw = readFileSync(join(fixturesDir, "stale-oracle.json"), "utf-8");
    const fixture = JSON.parse(raw) as FixtureFile;
    const result = evaluateGate({
      ...fixture.input,
      now: new Date("2026-09-25T12:00:00.000Z"),
    });

    expect(result.decision).toBe("refuse");
    expect(result.reasonCode).toBe("ORACLE_STALE");
    expect(result.evidence.oracleAgeMs).toBe(120_000);
    expect(result.evidence.venuePrices.length).toBe(5);
    expect(result.evidence.spotReference).not.toBe("UNKNOWN");
  });

  it("refuses with DIVERGED_X_BPS and divergence evidence", () => {
    const raw = readFileSync(join(fixturesDir, "diverged-oracle.json"), "utf-8");
    const fixture = JSON.parse(raw) as FixtureFile;
    const result = evaluateGate({
      ...fixture.input,
      now: new Date("2026-09-25T12:00:00.000Z"),
    });

    expect(result.decision).toBe("refuse");
    expect(result.reasonCode).toBe("DIVERGED_X_BPS");
    expect(result.evidence.divergenceBps).toBeGreaterThan(50);
  });
});

describe("buildResolutionEvidence", () => {
  it("resolves yes when all sources above strike", async () => {
    const { buildResolutionEvidence } = await import("../src/prediction/resolution.js");
    const evidence = buildResolutionEvidence({
      question: "SOL above $140 at 2026-09-25T12:00:00Z?",
      asset: "SOL",
      strikePrice: 140,
      resolutionTime: "2026-09-25T12:00:00.000Z",
      sources: [
        { source: "binance", price: 145.5, fetchedAt: "2026-09-25T12:00:00.000Z" },
        { source: "okx", price: 145.6, fetchedAt: "2026-09-25T12:00:00.000Z" },
        { source: "kraken", price: 145.4, fetchedAt: "2026-09-25T12:00:00.000Z" },
      ],
    });

    expect(evidence.canResolve).toBe(true);
    expect(evidence.resolveDirection).toBe("yes");
    expect(evidence.sources.every((s) => s.rawHash.length === 64)).toBe(true);
  });
});
