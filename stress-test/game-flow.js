/**
 * Full game flow stress test for Bingo Royale
 *
 * Simulates complete game lifecycles: login -> create/join room -> start game ->
 * call numbers -> dab -> claim bingo -> new round
 *
 * Runs multiple concurrent rooms with many players each.
 */

import { io } from "socket.io-client";
import { TARGET_URL, SCENARIOS, log, logMetrics } from "./config.js";

const { rooms: ROOM_COUNT, playersPerRoom, rampUpMs, dabDelayMs } = SCENARIOS.game;

class GameMetrics {
  constructor() {
    this.gamesStarted = 0;
    this.gamesCompleted = 0;
    this.gamesFailed = 0;
    this.totalDabs = 0;
    this.bingosClaimed = 0;
    this.bingosValid = 0;
    this.bingosInvalid = 0;
    this.numbersCalled = 0;
    this.powerupsUsed = 0;
    this.chatMessagesSent = 0;
    this.errors = [];
    this.gameDurations = [];
    this.latencies = { dab: [], claim: [], chat: [], powerup: [] };
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  report() {
    const latencyReport = {};
    for (const [key, values] of Object.entries(this.latencies)) {
      if (values.length > 0) {
        latencyReport[key] = {
          avg: `${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(0)}ms`,
          p95: `${this.percentile(values, 95).toFixed(0)}ms`,
          max: `${Math.max(...values).toFixed(0)}ms`,
        };
      }
    }

    return {
      games: {
        started: this.gamesStarted,
        completed: this.gamesCompleted,
        failed: this.gamesFailed,
      },
      actions: {
        numbersCalled: this.numbersCalled,
        totalDabs: this.totalDabs,
        bingosClaimed: this.bingosClaimed,
        bingosValid: this.bingosValid,
        bingosInvalid: this.bingosInvalid,
        powerupsUsed: this.powerupsUsed,
        chatMessages: this.chatMessagesSent,
      },
      latency: latencyReport,
      avgGameDuration: this.gameDurations.length
        ? `${(this.gameDurations.reduce((a, b) => a + b, 0) / this.gameDurations.length / 1000).toFixed(1)}s`
        : "N/A",
      errors: [...new Set(this.errors)].slice(0, 10),
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
  return { token: data.token, user: data.user };
}

function createSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(TARGET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 15000,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket connection timeout"));
    }, 15000);

    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function emitWithTimeout(socket, event, data, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timeout`)), timeoutMs);
    socket.emit(event, data, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

function waitForEvent(socket, event, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Waiting for ${event} timed out`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function runGameRoom(roomIndex, metrics) {
  const roomLabel = `Room-${roomIndex + 1}`;
  const playerSockets = [];
  const playerCards = new Map();
  const playerPowerups = new Map();

  try {
    // Step 1: Authenticate all players
    log(roomLabel, `Authenticating ${playersPerRoom} players...`);
    const players = [];
    for (let i = 0; i < playersPerRoom; i++) {
      const { token, user } = await getToken(`r${roomIndex}_p${i}_${Date.now()}`);
      players.push({ token, user, index: i });
    }

    // Step 2: Connect all sockets
    log(roomLabel, "Connecting sockets...");
    for (const player of players) {
      const socket = await createSocket(player.token);
      playerSockets.push({ socket, player });
    }

    // Step 3: Host creates room
    const host = playerSockets[0];
    log(roomLabel, "Host creating room...");
    const createRes = await emitWithTimeout(host.socket, "room:create", {
      variant: "75",
      speed: 1500, // Rapid for stress test
      playerLimit: playersPerRoom + 10,
    });

    if (!createRes.success) {
      throw new Error(`Room creation failed: ${createRes.error}`);
    }

    const roomCode = createRes.room.code;
    log(roomLabel, `Room ${roomCode} created. Joining players...`);

    // Step 4: All other players join
    for (let i = 1; i < playerSockets.length; i++) {
      const { socket } = playerSockets[i];
      const joinRes = await emitWithTimeout(socket, "room:join", { code: roomCode });
      if (!joinRes.success) {
        log(roomLabel, `Player ${i} join failed: ${joinRes.error}`);
      }
    }

    log(roomLabel, `All players joined room ${roomCode}`);

    // Step 5: Set up event listeners on all sockets
    let gameFinished = false;
    const calledNumbers = [];
    const gameFinishedPromises = [];

    for (const { socket, player } of playerSockets) {
      // Card dealt
      socket.on("game:card_dealt", (data) => {
        playerCards.set(player.user.id, data.cards);
      });

      // Powerups dealt
      socket.on("game:powerups_dealt", (data) => {
        playerPowerups.set(player.user.id, data.powerups);
      });

      // Number called - auto-dab matching cells
      socket.on("game:number_called", (data) => {
        if (gameFinished) return;
        metrics.numbersCalled++;

        const cards = playerCards.get(player.user.id);
        if (!cards || cards.length === 0) return;

        // Check each card for matching numbers and dab them
        for (let cardIndex = 0; cardIndex < cards.length; cardIndex++) {
          const card = cards[cardIndex];
          if (!card || !card.grid) continue;

          for (let col = 0; col < card.grid.length; col++) {
            for (let row = 0; row < card.grid[col].length; row++) {
              if (card.grid[col][row] === data.number) {
                const cellIndex = col * (card.grid[0]?.length || 5) + row;
                const dabStart = performance.now();
                socket.emit("game:dab", { cellIndex, cardIndex });
                metrics.latencies.dab.push(performance.now() - dabStart);
                metrics.totalDabs++;
              }
            }
          }
        }
      });

      // Listen for game finished
      const finishedPromise = new Promise((resolve) => {
        socket.on("game:finished", (data) => {
          gameFinished = true;
          resolve(data);
        });
      });
      gameFinishedPromises.push(finishedPromise);
    }

    // Step 6: Send some chat messages during lobby
    for (let i = 0; i < Math.min(5, playerSockets.length); i++) {
      const { socket } = playerSockets[i];
      try {
        const chatStart = performance.now();
        await emitWithTimeout(socket, "chat:message", {
          text: `Player ${i} ready! Let's go!`,
        });
        metrics.latencies.chat.push(performance.now() - chatStart);
        metrics.chatMessagesSent++;
      } catch {
        // Chat not critical
      }
    }

    // Step 7: Host starts game
    log(roomLabel, "Starting game...");
    const gameStart = performance.now();
    const startRes = await emitWithTimeout(host.socket, "game:start", {});

    if (!startRes.success) {
      throw new Error(`Game start failed: ${startRes.error}`);
    }

    metrics.gamesStarted++;
    log(roomLabel, "Game started! Waiting for numbers...");

    // Step 8: Use powerups after a delay
    setTimeout(async () => {
      for (const { socket, player } of playerSockets.slice(0, 5)) {
        const powerups = playerPowerups.get(player.user.id);
        if (powerups && powerups.length > 0 && !powerups[0].used) {
          try {
            const puStart = performance.now();
            await emitWithTimeout(socket, "game:use_powerup", {
              powerupId: powerups[0].id,
            });
            metrics.latencies.powerup.push(performance.now() - puStart);
            metrics.powerupsUsed++;
          } catch {
            // Powerup use not critical
          }
        }
      }
    }, 5000);

    // Step 9: Periodically try to claim bingo (auto-dab should eventually hit a pattern)
    const claimInterval = setInterval(async () => {
      if (gameFinished) {
        clearInterval(claimInterval);
        return;
      }

      // Pick a random player to claim
      const idx = Math.floor(Math.random() * playerSockets.length);
      const { socket } = playerSockets[idx];

      try {
        const claimStart = performance.now();
        const res = await emitWithTimeout(socket, "game:claim_bingo", {
          cardIndex: 0,
        });
        metrics.latencies.claim.push(performance.now() - claimStart);
        metrics.bingosClaimed++;
        if (res.valid) {
          metrics.bingosValid++;
        } else {
          metrics.bingosInvalid++;
        }
      } catch {
        // Claim timeout is fine
      }
    }, 3000);

    // Step 10: Send chat messages during game
    const chatInterval = setInterval(() => {
      if (gameFinished) {
        clearInterval(chatInterval);
        return;
      }
      const idx = Math.floor(Math.random() * playerSockets.length);
      const { socket } = playerSockets[idx];
      socket.emit("chat:message", { text: `Go go go! ${Date.now()}` }, () => {
        metrics.chatMessagesSent++;
      });
    }, 2000);

    // Step 11: Wait for game to finish (timeout after 3 minutes)
    const finishTimeout = setTimeout(() => {
      if (!gameFinished) {
        gameFinished = true;
        metrics.gamesFailed++;
        log(roomLabel, "Game timed out after 3 minutes");
      }
    }, 180000);

    await Promise.race(gameFinishedPromises);

    clearTimeout(finishTimeout);
    clearInterval(claimInterval);
    clearInterval(chatInterval);

    const gameDuration = performance.now() - gameStart;
    metrics.gameDurations.push(gameDuration);
    metrics.gamesCompleted++;

    log(roomLabel, `Game completed in ${(gameDuration / 1000).toFixed(1)}s`);

    // Step 12: Host starts new round
    try {
      await emitWithTimeout(host.socket, "game:new_round", {});
      log(roomLabel, "New round started successfully");
    } catch {
      // New round not critical for test
    }
  } catch (err) {
    metrics.gamesFailed++;
    metrics.errors.push(`${roomLabel}: ${err.message}`);
    log(roomLabel, `ERROR: ${err.message}`);
  } finally {
    // Cleanup
    for (const { socket } of playerSockets) {
      try {
        socket.disconnect();
      } catch {}
    }
  }
}

export async function runGameFlowTest() {
  console.log(`\nFull Game Flow Stress Test`);
  console.log(`Rooms: ${ROOM_COUNT} | Players/room: ${playersPerRoom}`);
  console.log(`Total players: ${ROOM_COUNT * playersPerRoom}`);
  console.log(`Target: ${TARGET_URL}\n`);

  const metrics = new GameMetrics();
  const startTime = performance.now();

  // Run rooms with staggered starts
  const roomPromises = [];
  for (let i = 0; i < ROOM_COUNT; i++) {
    const delay = (rampUpMs / ROOM_COUNT) * i;
    roomPromises.push(
      new Promise((resolve) =>
        setTimeout(() => runGameRoom(i, metrics).then(resolve), delay)
      )
    );
  }

  await Promise.all(roomPromises);

  const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll games completed in ${totalTime}s`);
  logMetrics("Game Flow Results", metrics.report());

  return metrics;
}

const isMain = process.argv[1]?.endsWith("game-flow.js");
if (isMain) {
  runGameFlowTest().catch(console.error);
}
