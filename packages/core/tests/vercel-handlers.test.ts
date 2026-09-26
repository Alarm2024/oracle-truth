import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns 400 strike required when strike is missing", async () => {
    const res = mockRes();
    await resolveHandler(
      mockReq({ asset: "SOL" }),
      res as unknown as VercelResponse
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "strike required" });
  });

  it.each(["0", "-5", "abc", "Infinity", "", "0x10", "1e2", "140."])(
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

  it("accepts a plain decimal strike", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T12:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 }))
    );

    const res = mockRes();
    await resolveHandler(
      mockReq({ asset: "SOL", strike: "140.5" }),
      res as unknown as VercelResponse
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      strikePrice: 140.5,
      resolutionTime: "2026-09-26T12:00:00.000Z",
      observedAt: "2026-09-26T12:00:00.000Z",
    });
  });
});

describe("Vercel prediction resolve time window", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns 400 when time is more than 60s from now", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T12:00:00.000Z"));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    for (const time of ["2026-09-26T11:58:59.000Z", "2026-09-26T12:01:01.000Z", "not-a-time"]) {
      const res = mockRes();
      await resolveHandler(
        mockReq({ asset: "SOL", strike: "140", time }),
        res as unknown as VercelResponse
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "only current observations are supported" });
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the requested resolutionTime and adds observedAt within 60s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T12:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 }))
    );

    const time = "2026-09-26T11:59:00.000Z";
    const res = mockRes();
    await resolveHandler(
      mockReq({ asset: "SOL", strike: "140", time }),
      res as unknown as VercelResponse
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      resolutionTime: time,
      observedAt: "2026-09-26T12:00:00.000Z",
      strikePrice: 140,
    });
  });
});
