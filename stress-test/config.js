// Stress test configuration
// Set TARGET_URL env var or edit the default below
export const TARGET_URL = process.env.TARGET_URL || "https://bingo-server-production-1959.up.railway.app";

export const SCENARIOS = {
  // HTTP load test
  http: {
    concurrentUsers: 100,
    requestsPerUser: 20,
    rampUpMs: 5000,
  },
  // Socket connection stress
  sockets: {
    totalConnections: 200,
    rampUpMs: 10000,
    holdDurationMs: 30000,
  },
  // Full game flow
  game: {
    rooms: 5,
    playersPerRoom: 20,
    rampUpMs: 5000,
    dabDelayMs: 500,
  },
};

export function log(prefix, msg) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] [${prefix}] ${msg}`);
}

export function logMetrics(name, metrics) {
  console.log(`\n========== ${name} ==========`);
  for (const [key, val] of Object.entries(metrics)) {
    if (typeof val === "object") {
      console.log(`  ${key}:`);
      for (const [k, v] of Object.entries(val)) {
        console.log(`    ${k}: ${v}`);
      }
    } else {
      console.log(`  ${key}: ${val}`);
    }
  }
  console.log("=".repeat(name.length + 22));
}
