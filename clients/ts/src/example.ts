import { OracleTruthClient } from "./index.js";

async function main() {
  const client = new OracleTruthClient({
    baseUrl: process.env.ORACLE_TRUTH_URL ?? "http://localhost:3000",
  });

  console.log("Oracle Truth TS Client Example\n");

  for (const asset of ["SOL", "BTC", "ETH"] as const) {
    try {
      const result = await client.checkGate(asset);
      console.log(
        `${asset}: ${result.decision}${result.reasonCode ? ` (${result.reasonCode})` : ""}`
      );
    } catch (err) {
      console.log(`${asset}: ERROR — ${err}`);
    }
  }
}

main();
