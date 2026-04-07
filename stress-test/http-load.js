/**
 * HTTP endpoint stress test for Bingo Royale
 *
 * Tests: /api/health, /api/auth/guest, /api/profile/:id, /api/stats/:id
 * Measures: throughput, latency (min/avg/p95/p99/max), error rate
 */

import { TARGET_URL, SCENARIOS, log, logMetrics } from "./config.js";

const { concurrentUsers, requestsPerUser, rampUpMs } = SCENARIOS.http;

class LatencyTracker {
  constructor(name) {
    this.name = name;
    this.values = [];
    this.errors = 0;
    this.statusCodes = {};
  }

  record(ms, status) {
    this.values.push(ms);
    this.statusCodes[status] = (this.statusCodes[status] || 0) + 1;
  }

  recordError() {
    this.errors++;
  }

  percentile(p) {
    if (this.values.length === 0) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  report() {
    const total = this.values.length + this.errors;
    if (total === 0) return { total: 0 };
    return {
      total,
      success: this.values.length,
      errors: this.errors,
      errorRate: `${((this.errors / total) * 100).toFixed(1)}%`,
      latency: {
        min: `${Math.min(...this.values).toFixed(0)}ms`,
        avg: `${(this.values.reduce((a, b) => a + b, 0) / this.values.length).toFixed(0)}ms`,
        p95: `${this.percentile(95).toFixed(0)}ms`,
        p99: `${this.percentile(99).toFixed(0)}ms`,
        max: `${Math.max(...this.values).toFixed(0)}ms`,
      },
      statusCodes: this.statusCodes,
    };
  }
}

async function timedFetch(url, options = {}) {
  const start = performance.now();
  const res = await fetch(url, options);
  const elapsed = performance.now() - start;
  return { res, elapsed };
}

async function runHealthCheck(tracker) {
  try {
    const { res, elapsed } = await timedFetch(`${TARGET_URL}/api/health`);
    tracker.record(elapsed, res.status);
    await res.text();
  } catch {
    tracker.recordError();
  }
}

async function runGuestLogin(tracker) {
  const name = `stress_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const { res, elapsed } = await timedFetch(`${TARGET_URL}/api/auth/guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    tracker.record(elapsed, res.status);
    const data = await res.json();
    return data.token;
  } catch {
    tracker.recordError();
    return null;
  }
}

async function runProfileFetch(tracker, userId, token) {
  try {
    const { res, elapsed } = await timedFetch(
      `${TARGET_URL}/api/profile/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    tracker.record(elapsed, res.status);
    await res.text();
  } catch {
    tracker.recordError();
  }
}

async function runStatsFetch(tracker, userId, token) {
  try {
    const { res, elapsed } = await timedFetch(
      `${TARGET_URL}/api/stats/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    tracker.record(elapsed, res.status);
    await res.text();
  } catch {
    tracker.recordError();
  }
}

async function simulateUser(userId, trackers) {
  for (let i = 0; i < requestsPerUser; i++) {
    // Health check
    await runHealthCheck(trackers.health);

    // Guest login
    const token = await runGuestLogin(trackers.guestLogin);

    if (token) {
      // Parse JWT to get user ID (JWT payload is base64url)
      try {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString()
        );
        await runProfileFetch(trackers.profile, payload.id, token);
        await runStatsFetch(trackers.stats, payload.id, token);
      } catch {
        // If we can't parse token, just skip profile/stats
      }
    }
  }
}

export async function runHttpLoadTest() {
  console.log(`\nHTTP Load Test: ${concurrentUsers} users x ${requestsPerUser} requests`);
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Ramp-up: ${rampUpMs}ms\n`);

  const trackers = {
    health: new LatencyTracker("GET /api/health"),
    guestLogin: new LatencyTracker("POST /api/auth/guest"),
    profile: new LatencyTracker("GET /api/profile/:id"),
    stats: new LatencyTracker("GET /api/stats/:id"),
  };

  const startTime = performance.now();
  const users = [];

  for (let i = 0; i < concurrentUsers; i++) {
    const delay = (rampUpMs / concurrentUsers) * i;
    users.push(
      new Promise((resolve) =>
        setTimeout(() => simulateUser(i, trackers).then(resolve), delay)
      )
    );
  }

  let completed = 0;
  const total = concurrentUsers;
  const progressInterval = setInterval(() => {
    log("HTTP", `Progress: ${completed}/${total} users completed`);
  }, 3000);

  await Promise.all(
    users.map((p) =>
      p.then(() => {
        completed++;
      })
    )
  );

  clearInterval(progressInterval);

  const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
  const totalRequests = Object.values(trackers).reduce(
    (sum, t) => sum + t.values.length + t.errors,
    0
  );

  console.log(`\nCompleted in ${totalTime}s (${(totalRequests / parseFloat(totalTime)).toFixed(0)} req/s)`);

  for (const tracker of Object.values(trackers)) {
    logMetrics(tracker.name, tracker.report());
  }

  return trackers;
}

// Run directly
const isMain = process.argv[1]?.endsWith("http-load.js");
if (isMain) {
  runHttpLoadTest().catch(console.error);
}
