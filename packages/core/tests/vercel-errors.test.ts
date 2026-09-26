import { afterEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

vi.mock("@oracle-truth/core", () => ({
  evaluateGate: vi.fn(),
  runLiveGateCheck: vi.fn(async () => {
    throw new Error("rpc secret leaked");
  }),
  runLiveResolution: vi.fn(async () => {
    throw new Error("upstream body leaked");
  }),
}));

import gateHandler from "../../../api/gate/[asset].ts";
import resolveHandler from "../../../api/prediction/resolve.ts";

type MockRes = {
  statusCode: number;
  body: unknown;
  setHeader: () => MockRes;
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

describe("Vercel handlers hide internal errors", () => {
  it("returns a generic 500 from the gate handler and logs the detail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = mockRes();
      await gateHandler(mockReq({ asset: "SOL" }), res as unknown as VercelResponse);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "internal error" });
      expect(JSON.stringify(res.body)).not.toContain("secret");
      expect(spy).toHaveBeenCalled();
      expect(String(spy.mock.calls[0]?.[0])).toContain("rpc secret leaked");
    } finally {
      spy.mockRestore();
    }
  });

  it("returns a generic 500 from prediction resolve and logs the detail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = mockRes();
      await resolveHandler(
        mockReq({ asset: "SOL", strike: "140" }),
        res as unknown as VercelResponse
      );

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "internal error" });
      expect(JSON.stringify(res.body)).not.toContain("upstream");
      expect(spy).toHaveBeenCalled();
      expect(String(spy.mock.calls[0]?.[0])).toContain("upstream body leaked");
    } finally {
      spy.mockRestore();
    }
  });
});
