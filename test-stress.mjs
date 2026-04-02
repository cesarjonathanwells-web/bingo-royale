#!/usr/bin/env node
/**
 * Bingo Royale Stress Test
 * Rigorous multi-phase test: connection surge, gameplay, chat spam, reconnection, edge cases
 *
 * Usage: node test-stress.mjs <room-code> [bot-count]
 */

import { io } from "socket.io-client";

const SERVER = "https://bingo-server-production-1959.up.railway.app";
const ROOM_CODE = process.argv[2];
const BOT_COUNT = parseInt(process.argv[3] || "30", 10);

if (!ROOM_CODE) {
  console.error("Usage: node test-stress.mjs <room-code> [bot-count]");
  process.exit(1);
}

const CHAT_MESSAGES = [
  "Good luck!", "Let's go!", "Bingo time!", "Almost there!", "So close!",
  "Nice one!", "Come on!", "This is fun!", "One more!", "Woo!",
  "I'm winning this!", "Not today!", "My lucky day!", "Haha!", "GG!",
];
const EMOJIS = ["🎉", "🔥", "👏", "😂", "🤩", "💪", "🍀", "⭐"];

let stats = {
  connected: 0,
  joined: 0,
  cardsDealt: 0,
  dabsSent: 0,
  chatsSent: 0,
  reactionsSent: 0,
  errors: 0,
  disconnects: 0,
  reconnects: 0,
  bingoClaims: 0,
  gameFinished: 0,
};

let startTime = Date.now();

async function getGuestToken(name) {
  const res = await fetch(`${SERVER}/api/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, locale: "en" }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

function createBot(index) {
  const name = `Stress-${index + 1}`;
  let cards = [];
  let dabs = [];
  let socket = null;
  let gameActive = false;
  let token = null;

  function buildNumberMap() {
    const map = new Map();
    cards.forEach((card, ci) => {
      if (card.grid) {
        for (let col = 0; col < card.grid.length; col++) {
          for (let row = 0; row < card.grid[col].length; row++) {
            const num = card.grid[col][row];
            const cellIndex = row * 5 + col;
            if (num !== null && cellIndex !== 12) {
              if (!map.has(num)) map.set(num, []);
              map.get(num).push({ cardIndex: ci, cellIndex });
            }
          }
        }
      }
    });
    return map;
  }

  async function start() {
    try {
      token = await getGuestToken(name);

      socket = io(SERVER, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        stats.connected++;
        socket.emit("room:join", { code: ROOM_CODE }, (res) => {
          if (res?.success) {
            stats.joined++;
            const cardCount = Math.floor(Math.random() * 4) + 1;
            socket.emit("room:set_card_count", { count: cardCount });
          } else {
            stats.errors++;
            console.error(`[${name}] Join failed:`, res?.error || res);
          }
        });
      });

      socket.on("reconnect", () => {
        stats.reconnects++;
        // Rejoin room on reconnect
        socket.emit("room:join", { code: ROOM_CODE }, () => {});
      });

      socket.on("game:card_dealt", (data) => {
        cards = data.cards;
        dabs = cards.map(() => new Set());
        dabs.forEach((d) => d.add(12));
        stats.cardsDealt++;
        gameActive = true;
      });

      socket.on("game:number_called", (data) => {
        if (!gameActive) return;

        const num = data.number;
        const numberMap = buildNumberMap();
        const matches = numberMap.get(num) || [];

        matches.forEach(({ cardIndex, cellIndex }) => {
          // Vary response time: some bots fast, some slow
          const delay = 100 + Math.random() * 2000;
          setTimeout(() => {
            if (!dabs[cardIndex] || !gameActive) return;
            dabs[cardIndex].add(cellIndex);
            socket.emit("game:dab", { cellIndex, cardIndex });
            stats.dabsSent++;
          }, delay);
        });

        // Chat spam test: ~10% of bots chat per number
        if (Math.random() < 0.10) {
          const msg = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)];
          socket.emit("chat:message", { text: msg });
          stats.chatsSent++;
        }

        // Emoji reaction test: ~5% of bots react
        if (Math.random() < 0.05) {
          const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
          socket.emit("chat:reaction", { emoji });
          stats.reactionsSent++;
        }

        // Random bingo claim test (stress server validation): ~1% chance
        if (Math.random() < 0.01) {
          socket.emit("game:claim_bingo", { cardIndex: 0 });
          stats.bingoClaims++;
        }
      });

      socket.on("game:bingo_claimed", (data) => {
        if (data.valid) {
          console.log(`  🏆 ${data.playerName} won with ${data.pattern}!`);
        }
      });

      socket.on("game:finished", () => {
        gameActive = false;
        stats.gameFinished++;
      });

      socket.on("disconnect", (reason) => {
        stats.disconnects++;
        if (reason === "io server disconnect") {
          // Server kicked — try reconnecting
          socket.connect();
        }
      });

      socket.on("error", (err) => {
        stats.errors++;
      });

      socket.on("connect_error", () => {
        stats.errors++;
      });

    } catch (err) {
      stats.errors++;
      console.error(`[${name}] Failed:`, err.message);
    }
  }

  function disconnect() {
    if (socket) socket.disconnect();
  }

  // Simulate random reconnect (stress test)
  function simulateReconnect() {
    if (socket && socket.connected) {
      socket.disconnect();
      setTimeout(() => {
        socket.connect();
      }, 500 + Math.random() * 2000);
    }
  }

  return { name, start, disconnect, simulateReconnect };
}

function printStats() {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n📊 Stress Test Stats (${elapsed}s elapsed):`);
  console.log(`  Connected: ${stats.connected} | Joined: ${stats.joined}/${BOT_COUNT}`);
  console.log(`  Cards dealt: ${stats.cardsDealt} | Dabs sent: ${stats.dabsSent}`);
  console.log(`  Chats: ${stats.chatsSent} | Reactions: ${stats.reactionsSent}`);
  console.log(`  Bingo claims: ${stats.bingoClaims} | Games finished: ${stats.gameFinished}`);
  console.log(`  Errors: ${stats.errors} | Disconnects: ${stats.disconnects} | Reconnects: ${stats.reconnects}`);
}

// ============================================================
// Main Execution
// ============================================================

console.log(`\n🔥 BINGO ROYALE STRESS TEST 🔥`);
console.log(`   Server: ${SERVER}`);
console.log(`   Room: ${ROOM_CODE}`);
console.log(`   Bots: ${BOT_COUNT}`);
console.log(`\n📡 Phase 1: Connection Surge — connecting ${BOT_COUNT} bots...`);

const bots = Array.from({ length: BOT_COUNT }, (_, i) => createBot(i));

// Phase 1: Rapid connection surge (100ms apart)
(async () => {
  for (let i = 0; i < bots.length; i++) {
    bots[i].start();
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`✅ All ${BOT_COUNT} bots launched. Waiting for joins...`);

  // Wait for all bots to join
  await new Promise((r) => setTimeout(r, 5000));
  printStats();

  console.log(`\n🎮 Phase 2: Waiting for host to start game...`);
  console.log(`   (Start the game in your browser)`);

  // Phase 3: Reconnection stress (after 30s, randomly disconnect/reconnect 20% of bots)
  setTimeout(() => {
    console.log(`\n🔌 Phase 3: Reconnection Stress — bouncing 20% of bots...`);
    const bounceCount = Math.floor(BOT_COUNT * 0.2);
    for (let i = 0; i < bounceCount; i++) {
      const botIdx = Math.floor(Math.random() * BOT_COUNT);
      bots[botIdx].simulateReconnect();
    }
    setTimeout(() => printStats(), 5000);
  }, 30000);

  // Print stats periodically
  const statsInterval = setInterval(printStats, 15000);

  // Cleanup on Ctrl+C
  process.on("SIGINT", () => {
    clearInterval(statsInterval);
    console.log("\n\n🛑 Shutting down...");
    printStats();
    console.log(`\nDisconnecting all bots...`);
    bots.forEach((b) => b.disconnect());
    setTimeout(() => process.exit(0), 1000);
  });
})();
