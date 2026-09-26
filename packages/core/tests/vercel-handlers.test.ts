import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import gateHandler from "../../../api/gate/[asset].ts";
import resolveHandler from "../../../api/prediction/resolve.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

type MockRes = {
  statusCode: number;
  body: unknown;
  setHeader: (name: string, value: string) => MockRes;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
  end: () => MockRes;
};

function mockRes(): MockRes {
  return {
    statusCode: 200,
    body: undefined,
    setHeader() {
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

function mockReq(query: Record<string, string | undefined>): VercelRequest {
  return { method: "GET", query } as VercelRequest;
}

describe("Vercel gate fixture allowlist", () => {
  const previousCwd = process.cwd();

  beforeEach(() => {
    process.chdir(repoRoot);
  });

  afterEach(() => {
    process.chdir(previousCwd);
  });

  it("returns 400 for fixture=../package and does not echo the name", async () => {
    const fixture = "../package";
    const res = mockRes();
    await gateHandler(
      mockReq({ asset: "SOL", mode: "fixture", fixture }),
      res as unknown as VercelResponse
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "unknown fixture" });
    expect(JSON.stringify(res.body)).not.toContain(fixture);
  });

  it("loads an allowlisted fixture", async () => {
    const res = mockRes();
    await gateHandler(
      mockReq({ asset: "SOL", mode: "fixture", fixture: "allow-clean" }),
      res as unknown as VercelResponse
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ decision: "allow" });
  });
});

describe("Vercel prediction resolve strike", () => {
  it("returns 400 strike required when strike is missing", async () => {
    const res = mockRes();
    await resolveHandler(
      mockReq({ asset: "SOL" }),
      res as unknown as VercelResponse
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "strike required" });
  });

  it.each(["0", "-5", "abc", "Infinity", ""])(
    "returns 400 strike required for strike=%j",
    async (strike) => {
      const res = mockRes();
      await resolveHandler(
        mockReq({ asset: "SOL", strike }),
        res as unknown as VercelResponse
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "strike required" });
    }
  );
});
