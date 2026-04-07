/**
 * Socket.IO connection stress test for Bingo Royale
 *
 * Tests: concurrent WebSocket connections, authentication, room creation/joining
 * Measures: connection time, connection success rate, memory/stability
 */

import { io } from "socket.io-client";
import { TARGET_URL, SCENARIOS, log, logMetrics } from "./config.js";

const { totalConnections, rampUpMs, holdDurationMs } = SCENARIOS.sockets;

class ConnectionMetrics {
  constructor() {
    this.connectTimes = [];
    this.connected = 0;
    this.failed = 0;
    this.disconnected = 0;
    this.errors = [];
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  report() {
    const total = this.connected + this.failed;
    return {
      total,
      connected: this.connected,
      failed: this.failed,
      disconnected: this.disconnected,
      successRate: `${((this.connected / Math.max(total, 1)) * 100).toFixed(1)}%`,
      connectLatency: {
        min: `${Math.min(...this.connectTimes).toFixed(0)}ms`,
        avg: `${(this.connectTimes.reduce((a, b) => a + b, 0) / Math.max(this.connectTimes.length, 1)).toFixed(0)}ms`,
        p95: `${this.percentile(this.connectTimes, 95).toFixed(0)}ms`,
        max: `${Math.max(...this.connectTimes).toFixed(0)}ms`,
      },
      uniqueErrors: [...new Set(this.errors)].slice(0, 10),
    };
  }
}

async function getToken(name) {
  const res = await fetch(`${TARGET_URL}/api/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  return data.token;
}

function connectSocket(token, metrics) {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = io(TARGET_URL, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
      reconnection: false,
      timeout: 15000,
    });

    const timer = setTimeout(() => {
      metrics.failed++;
      metrics.errors.push("timeout (15s)");
      socket.disconnect();
      resolve(null);
    }, 15000);

    socket.on("connect", () => {
      clearTimeout(timer);
      const elapsed = performance.now() - start;
      metrics.connectTimes.push(elapsed);
      metrics.connected++;
      resolve(socket);
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      metrics.failed++;
      metrics.errors.push(err.message);
      resolve(null);
    });

    socket.on("disconnect", (reason) => {
      metrics.disconnected++;
    });
  });
}

async function createAndJoinRoom(sockets, metrics) {
  if (sockets.length === 0) return;

  const roomMetrics = {
    roomsCreated: 0,
    joinSuccess: 0,
    joinFailed: 0,
    createTimes: [],
    joinTimes: [],
  };

  // First socket creates a room
  const host = sockets[0];
  const createStart = performance.now();

  const roomCode = await new Promise((resolve) => {
    host.emit("room:create", { variant: "75", speed: 3000 }, (res) => {
      roomMetrics.createTimes.push(performance.now() - createStart);
      if (res.success) {
        roomMetrics.roomsCreated++;
        resolve(res.room.code);
      } else {
        resolve(null);
      }
    });

    setTimeout(() => resolve(null), 10000);
  });

  if (!roomCode) {
    log("SOCKET", "Failed to create room");
    return roomMetrics;
  }

  log("SOCKET", `Room ${roomCode} created, joining ${sockets.length - 1} players...`);

  // Other sockets join the room
  const joinPromises = sockets.slice(1).map(
    (socket) =>
      new Promise((resolve) => {
        const joinStart = performance.now();
        socket.emit("room:join", { code: roomCode }, (res) => {
          roomMetrics.joinTimes.push(performance.now() - joinStart);
          if (res.success) {
            roomMetrics.joinSuccess++;
          } else {
            roomMetrics.joinFailed++;
          }
          resolve();
        });

        setTimeout(() => {
          roomMetrics.joinFailed++;
          resolve();
        }, 10000);
      })
  );

  await Promise.all(joinPromises);

  return roomMetrics;
}

export async function runSocketLoadTest() {
  console.log(`\nSocket.IO Connection Stress Test`);
  console.log(`Connections: ${totalConnections}`);
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Ramp-up: ${rampUpMs}ms | Hold: ${holdDurationMs}ms\n`);

  const metrics = new ConnectionMetrics();
  const sockets = [];

  // Phase 1: Authenticate all users
  log("SOCKET", "Phase 1: Authenticating users...");
  const tokens = [];
  const batchSize = 20;

  for (let i = 0; i < totalConnections; i += batchSize) {
    const batch = [];
    const end = Math.min(i + batchSize, totalConnections);
    for (let j = i; j < end; j++) {
      batch.push(getToken(`stress_${j}_${Date.now()}`));
    }
    const results = await Promise.all(batch);
    tokens.push(...results);
    log("SOCKET", `Authenticated ${tokens.length}/${totalConnections} users`);
  }

  // Phase 2: Connect sockets with ramp-up
  log("SOCKET", "Phase 2: Connecting sockets...");
  const delayPerSocket = rampUpMs / totalConnections;

  const connectPromises = tokens.map(
    (token, i) =>
      new Promise((resolve) =>
        setTimeout(async () => {
          const socket = await connectSocket(token, metrics);
          if (socket) sockets.push(socket);
          resolve();
        }, delayPerSocket * i)
      )
  );

  const progressInterval = setInterval(() => {
    log(
      "SOCKET",
      `Connected: ${metrics.connected} | Failed: ${metrics.failed} | Disconnected: ${metrics.disconnected}`
    );
  }, 2000);

  await Promise.all(connectPromises);
  clearInterval(progressInterval);

  log("SOCKET", `All connections attempted. ${sockets.length} active sockets.`);
  logMetrics("Connection Phase", metrics.report());

  // Phase 3: Room stress - create room and have everyone join
  if (sockets.length > 1) {
    log("SOCKET", "Phase 3: Room join stress test...");
    const roomMetrics = await createAndJoinRoom(sockets, metrics);
    if (roomMetrics) {
      logMetrics("Room Operations", {
        roomsCreated: roomMetrics.roomsCreated,
        joinSuccess: roomMetrics.joinSuccess,
        joinFailed: roomMetrics.joinFailed,
        avgCreateTime: roomMetrics.createTimes.length
          ? `${(roomMetrics.createTimes.reduce((a, b) => a + b, 0) / roomMetrics.createTimes.length).toFixed(0)}ms`
          : "N/A",
        avgJoinTime: roomMetrics.joinTimes.length
          ? `${(roomMetrics.joinTimes.reduce((a, b) => a + b, 0) / roomMetrics.joinTimes.length).toFixed(0)}ms`
          : "N/A",
      });
    }
  }

  // Phase 4: Hold connections
  log("SOCKET", `Phase 4: Holding ${sockets.length} connections for ${holdDurationMs / 1000}s...`);
  await new Promise((resolve) => setTimeout(resolve, holdDurationMs));

  // Report final state
  log(
    "SOCKET",
    `After hold: ${metrics.disconnected} disconnections during hold period`
  );

  // Phase 5: Disconnect all
  log("SOCKET", "Phase 5: Disconnecting all sockets...");
  for (const socket of sockets) {
    socket.disconnect();
  }

  logMetrics("Final Results", metrics.report());
  return metrics;
}

const isMain = process.argv[1]?.endsWith("socket-load.js");
if (isMain) {
  runSocketLoadTest().catch(console.error);
}
