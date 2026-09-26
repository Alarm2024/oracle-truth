import { afterAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";

process.env.PORT = "0";

const { server } = (await import("../../api/src/server.ts")) as { server: Server };

await new Promise<void>((resolve, reject) => {
  if (server.listening) {
    resolve();
    return;
  }
  server.once("listening", () => resolve());
  server.once("error", reject);
});

function listeningPort(httpServer: Server): number {
  const address = httpServer.address();
  if (address && typeof address === "object") return address.port;
  throw new Error("server has no port");
}

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("local server prediction resolve strike", () => {
  it("returns 400 for an Infinity strike", async () => {
    const port = listeningPort(server);
    const res = await fetch(
      `http://127.0.0.1:${port}/api/prediction/resolve?asset=SOL&strike=Infinity`
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "strike required" });
  });
});
