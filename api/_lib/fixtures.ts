import { readdirSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { GateInput, PerpAsset } from "@oracle-truth/core";

/** Fixture ids are basenames of fixtures/*.json. No dots, slashes, or case variants. */
const FIXTURE_NAME = /^[a-z0-9-]+$/;

export class UnknownFixtureError extends Error {
  constructor() {
    super("unknown fixture");
    this.name = "UnknownFixtureError";
  }
}

export function isUnknownFixture(err: unknown): boolean {
  return err instanceof Error && err.name === "UnknownFixtureError";
}

function fixturesDir(): string {
  return resolve(process.cwd(), "fixtures");
}

/** Names of *.json files in fixtures/ that also match FIXTURE_NAME. */
function allowedFixtureNames(): ReadonlySet<string> {
  let files: string[];
  try {
    files = readdirSync(fixturesDir());
  } catch {
    return new Set();
  }
  const names = new Set<string>();
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const name = file.slice(0, -".json".length);
    if (FIXTURE_NAME.test(name)) names.add(name);
  }
  return names;
}

export function loadFixtureGate(asset: PerpAsset, fixtureName: string): GateInput {
  const allowed = allowedFixtureNames();
  if (!FIXTURE_NAME.test(fixtureName) || !allowed.has(fixtureName)) {
    throw new UnknownFixtureError();
  }

  const dir = fixturesDir();
  const path = resolve(dir, `${fixtureName}.json`);
  if (!path.startsWith(`${dir}${sep}`)) {
    throw new UnknownFixtureError();
  }

  const raw = readFileSync(path, "utf-8");
  const fixture = JSON.parse(raw) as { input: GateInput };
  return { ...fixture.input, asset };
}
