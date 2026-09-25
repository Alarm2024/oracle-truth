import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateGate,
  runLiveGateCheck,
  runLiveResolution,
  buildResolutionEvidence,
  type PerpAsset,
} from "@oracle-truth/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardDir = join(__dirname, "../../dashboard");
const port = Number(process.env.PORT ?? 3000);

const ASSETS: PerpAsset[] = ["SOL", "BTC", "ETH"];

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body, null, 2));
}

function mime(path: string): string {
  const ext = extname(path);
  const map: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
  };
  return map[ext] ?? "application/octet-stream";
}

function serveStatic(pathname: string, res: import("node:http").ServerResponse): boolean {
  const filePath = join(dashboardDir, pathname === "/" ? "index.html" : pathname);
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath);
  res.writeHead(200, { "Content-Type": mime(filePath) });
  res.end(content);
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (url.pathname === "/api/health") {
    json(res, 200, { status: "ok", assets: ASSETS });
    return;
  }

  const gateMatch = url.pathname.match(/^\/api\/gate\/(SOL|BTC|ETH)$/);
  if (gateMatch && req.method === "GET") {
    const asset = gateMatch[1] as PerpAsset;
    const mode = url.searchParams.get("mode");
    try {
      const result =
        mode === "fixture"
          ? evaluateGate(await loadFixtureGate(asset, url.searchParams.get("fixture") ?? "allow-clean"))
          : await runLiveGateCheck(asset);
      json(res, 200, result);
    } catch (err) {
      json(res, 500, { error: String(err) });
    }
    return;
  }

  if (url.pathname === "/api/gate/all" && req.method === "GET") {
    try {
      const results = await Promise.all(ASSETS.map((a) => runLiveGateCheck(a)));
      json(res, 200, Object.fromEntries(ASSETS.map((a, i) => [a, results[i]])));
    } catch (err) {
      json(res, 500, { error: String(err) });
    }
    return;
  }

  if (url.pathname === "/api/prediction/resolve" && req.method === "GET") {
    const asset = (url.searchParams.get("asset") ?? "SOL") as PerpAsset;
    const strike = Number(url.searchParams.get("strike") ?? "0");
    const time = url.searchParams.get("time") ?? new Date().toISOString();
    const question =
      url.searchParams.get("question") ??
      `${asset} above $${strike} at ${time}?`;

    if (!ASSETS.includes(asset) || !Number.isFinite(strike)) {
      json(res, 400, { error: "Invalid asset or strike" });
      return;
    }

    try {
      const evidence = await runLiveResolution({
        question,
        asset,
        strikePrice: strike,
        resolutionTime: time,
      });
      json(res, 200, evidence);
    } catch (err) {
      json(res, 500, { error: String(err) });
    }
    return;
  }

  if (url.pathname === "/api/prediction/resolve/fixture" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const input = JSON.parse(body);
      const evidence = buildResolutionEvidence(input);
      json(res, 200, evidence);
    } catch (err) {
      json(res, 400, { error: String(err) });
    }
    return;
  }

  if (serveStatic(url.pathname, res)) return;

  json(res, 404, { error: "Not found" });
});

async function loadFixtureGate(asset: PerpAsset, fixtureName: string) {
  const fixturesDir = join(__dirname, "../../../fixtures");
  const path = join(fixturesDir, `${fixtureName}.json`);
  const raw = readFileSync(path, "utf-8");
  const fixture = JSON.parse(raw) as { input: Parameters<typeof evaluateGate>[0] };
  return { ...fixture.input, asset };
}

server.listen(port, "0.0.0.0", () => {
  console.log(`Oracle Truth API listening on http://0.0.0.0:${port}`);
});
