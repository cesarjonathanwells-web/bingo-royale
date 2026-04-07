/**
 * Run all stress tests sequentially
 */

import { runHttpLoadTest } from "./http-load.js";
import { runSocketLoadTest } from "./socket-load.js";
import { runGameFlowTest } from "./game-flow.js";
import { TARGET_URL, log } from "./config.js";

async function main() {
  console.log("=".repeat(60));
  console.log("  BINGO ROYALE - STRESS TEST SUITE");
  console.log(`  Target: ${TARGET_URL}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  // Verify target is reachable
  try {
    const res = await fetch(`${TARGET_URL}/api/health`);
    const data = await res.json();
    log("INIT", `Server is up (uptime: ${data.uptime}s)`);
  } catch (err) {
    console.error(`\nERROR: Cannot reach ${TARGET_URL}/api/health`);
    console.error(`Make sure the server is running and TARGET_URL is correct.`);
    console.error(`\nUsage: TARGET_URL=https://your-app.railway.app node run-all.js\n`);
    process.exit(1);
  }

  // Test 1: HTTP load
  log("SUITE", "Starting HTTP Load Test...");
  await runHttpLoadTest();

  // Brief pause between tests
  await new Promise((r) => setTimeout(r, 3000));

  // Test 2: Socket connections
  log("SUITE", "Starting Socket Connection Test...");
  await runSocketLoadTest();

  await new Promise((r) => setTimeout(r, 3000));

  // Test 3: Full game flow
  log("SUITE", "Starting Game Flow Test...");
  await runGameFlowTest();

  console.log("\n" + "=".repeat(60));
  console.log("  ALL TESTS COMPLETE");
  console.log(`  Finished: ${new Date().toISOString()}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Suite failed:", err);
  process.exit(1);
});
