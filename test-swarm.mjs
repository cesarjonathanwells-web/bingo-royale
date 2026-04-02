#!/usr/bin/env node
/**
 * Bingo Royale Bot Swarm
 * Usage: node test-swarm.mjs <room-code> [bot-count]
 */

import { io } from "socket.io-client";

const SERVER = "https://bingo-server-production-1959.up.railway.app";
const ROOM_CODE = process.argv[2];
const BOT_COUNT = parseInt(process.argv[3] || "5", 10);
const FREE_SPACE_INDEX = 12;

if (!ROOM_CODE) {
  console.error("Usage: node test-swarm.mjs <room-code> [bot-count]");
  process.exit(1);
}

console.log(`Deploying ${BOT_COUNT} bots to room ${ROOM_CODE}...`);

const CHAT_MESSAGES = [
  "Good luck everyone!", "Let's go!", "Bingo time!",
  "Almost there!", "So close!", "Nice one!",
  "Come on lucky numbers!", "This is fun!",
  "One more number please!", "Woo!",
];

const EMOJIS = ["🎉", "🔥", "👏", "😂", "🤩", "💪", "🍀", "⭐"];

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
  const name = `Bot-${index + 1}`;
  let cards = [];
  let calledNumbers = new Set();
  let dabs = [];
  let socket = null;
  let gameActive = false;

  // Build a lookup: number → [{ cardIndex, cellIndex }]
  function buildNumberMap() {
    const map = new Map();
    cards.forEach((card, ci) => {
      if (card.grid) {
        // 75-ball: grid is column-major [col][row]
        for (let col = 0; col < card.grid.length; col++) {
          for (let row = 0; row < card.grid[col].length; row++) {
            const num = card.grid[col][row];
            const cellIndex = row * 5 + col;
            if (num !== null && cellIndex !== FREE_SPACE_INDEX) {
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
      const token = await getGuestToken(name);
      console.log(`[${name}] Authenticated`);

      socket = io(SERVER, {
        auth: { token },
        transports: ["websocket", "polling"],
      });

      socket.on("connect", () => {
        console.log(`[${name}] Connected, joining room ${ROOM_CODE}...`);

        // Set card count (1-4 randomly)
        const cardCount = Math.floor(Math.random() * 4) + 1;

        socket.emit("room:join", { code: ROOM_CODE }, (res) => {
          if (res?.success) {
            console.log(`[${name}] Joined room! Setting ${cardCount} cards`);
            socket.emit("room:set_card_count", { count: cardCount });
          } else {
            console.error(`[${name}] Failed to join:`, res?.error || res);
          }
        });
      });

      socket.on("game:card_dealt", (data) => {
        cards = data.cards;
        dabs = cards.map(() => new Set());
        // Auto-dab free space
        dabs.forEach((d) => d.add(FREE_SPACE_INDEX));
        console.log(`[${name}] Received ${cards.length} card(s)`);
        gameActive = true;
      });

      socket.on("game:number_called", (data) => {
        if (!gameActive) return;

        const num = data.number;
        calledNumbers.add(num);

        const numberMap = buildNumberMap();
        const matches = numberMap.get(num) || [];

        // Dab matching cells with a small random delay (human-like)
        matches.forEach(({ cardIndex, cellIndex }) => {
          const delay = 200 + Math.random() * 1500;
          setTimeout(() => {
            if (!dabs[cardIndex]) return;
            dabs[cardIndex].add(cellIndex);
            socket.emit("game:dab", { cellIndex, cardIndex });
          }, delay);
        });

        // Occasionally send chat/emoji
        if (Math.random() < 0.05) {
          const msg = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)];
          socket.emit("chat:message", { text: msg });
        }
        if (Math.random() < 0.03) {
          const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
          socket.emit("chat:reaction", { emoji });
        }
      });

      socket.on("game:bingo_claimed", (data) => {
        if (data.valid) {
          console.log(`[${name}] ${data.playerName} won with ${data.pattern || "bingo"}!`);
        }
      });

      socket.on("game:finished", (data) => {
        gameActive = false;
        const winners = data.winners?.map((w) => w.playerName).join(", ") || "none";
        console.log(`[${name}] Game over! Winners: ${winners}. Reason: ${data.reason}`);
      });

      socket.on("disconnect", (reason) => {
        console.log(`[${name}] Disconnected: ${reason}`);
      });

      socket.on("error", (err) => {
        console.error(`[${name}] Error:`, err.message || err);
      });
    } catch (err) {
      console.error(`[${name}] Failed to start:`, err.message);
    }
  }

  return { name, start };
}

// Launch bots with staggered connections
const bots = Array.from({ length: BOT_COUNT }, (_, i) => createBot(i));

for (let i = 0; i < bots.length; i++) {
  setTimeout(() => bots[i].start(), i * 500); // 500ms between each bot
}

// Keep process alive
process.on("SIGINT", () => {
  console.log("\nShutting down bots...");
  process.exit(0);
});
