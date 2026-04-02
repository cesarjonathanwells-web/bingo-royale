import { create } from "zustand";
import type {
  Room,
  GameState,
  BingoCard,
  BingoCard75,
  BingoCard90,
  ChatMessage,
  BingoVariant,
  Player,
  WinEvent,
  PlayerPowerUp,
  PowerUpId,
} from "@bingo/shared";
import { FREE_SPACE_INDEX } from "@bingo/shared";
import { getSocket } from "@/socket";

interface EmojiReaction {
  emoji: string;
  playerName: string;
  id: string;
}

function getCellValue(card: BingoCard, cellIndex: number, variant: "75" | "90"): number | null {
  const cols = variant === "75" ? 5 : 9;
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  return card.grid[col]?.[row] ?? null;
}

function findCellIndex75(card: BingoCard75, number: number): number | null {
  for (let col = 0; col < card.grid.length; col++) {
    const column = card.grid[col];
    if (!column) continue;
    for (let row = 0; row < column.length; row++) {
      if (column[row] === number) return row * 5 + col;
    }
  }
  return null;
}

function findCellIndex90(card: BingoCard90, number: number): number | null {
  for (let col = 0; col < card.grid.length; col++) {
    const column = card.grid[col];
    if (!column) continue;
    for (let row = 0; row < column.length; row++) {
      if (column[row] === number) return row * 9 + col;
    }
  }
  return null;
}

interface RoomState {
  // State
  room: Room | null;
  gameState: GameState | null;
  myCards: BingoCard[];
  myDabs: Set<number>[];
  activeCardIndex: number;
  cardCount: number;
  chatMessages: ChatMessage[];
  isConnecting: boolean;
  error: string | null;
  myPowerUps: PlayerPowerUp[];
  peekedNumbers: number[];
  reactions: EmojiReaction[];
  autoDaub: boolean;

  // Actions
  createRoom: (variant: BingoVariant) => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  newRound: () => void;
  setCardCount: (count: number) => void;
  setActiveCard: (index: number) => void;
  dabCell: (cellIndex: number) => void;
  claimBingo: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  sendChat: (text: string) => void;
  updateSettings: (settings: {
    speed?: number;
    patterns?: string[];
    playerLimit?: number;
  }) => void;
  usePowerUp: (powerupId: PowerUpId, targetCellIndex?: number) => void;
  sendReaction: (emoji: string) => void;
  toggleAutoDaub: () => void;

  // Internal
  setupListeners: () => void;
  cleanupListeners: () => void;
  reset: () => void;
}

const initialState = {
  room: null,
  gameState: null,
  myCards: [] as BingoCard[],
  myDabs: [] as Set<number>[],
  activeCardIndex: 0,
  cardCount: 1,
  chatMessages: [],
  isConnecting: false,
  error: null,
  myPowerUps: [] as PlayerPowerUp[],
  peekedNumbers: [] as number[],
  reactions: [] as EmojiReaction[],
  autoDaub: typeof window !== "undefined" && localStorage.getItem("bingo-auto-daub") === "true",
};

// Module-level variable for peek timeout (not reactive state)
let _peekTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Scans all cards for the called number and auto-dabs matching cells.
 * Emits a dab event to the server for each match.
 */
function performAutoDaub(
  calledNumber: number,
  get: () => RoomState,
  set: (partial: Partial<RoomState> | ((state: RoomState) => Partial<RoomState>)) => void,
): void {
  const { myCards, myDabs } = get();
  if (myCards.length === 0) return;

  const newDabs = [...myDabs];
  let changed = false;

  for (let ci = 0; ci < myCards.length; ci++) {
    const card = myCards[ci];
    if (!card) continue;

    const cardDabs = newDabs[ci] ?? new Set<number>();
    const cellIndex =
      card.grid.length === 5
        ? findCellIndex75(card as BingoCard75, calledNumber)
        : findCellIndex90(card as BingoCard90, calledNumber);

    if (cellIndex !== null && !cardDabs.has(cellIndex)) {
      const updated = new Set(cardDabs);
      updated.add(cellIndex);
      newDabs[ci] = updated;
      changed = true;

      const socket = getSocket();
      socket.emit("game:dab", { cellIndex, cardIndex: ci });
    }
  }

  if (changed) set({ myDabs: newDabs });
}

export const useRoomStore = create<RoomState>()((set, get) => ({
  ...initialState,

  createRoom: (variant) => {
    set({ isConnecting: true, error: null });
    const socket = getSocket();
    socket.emit("room:create", { variant });
  },

  joinRoom: (code) => {
    set({ isConnecting: true, error: null });
    const socket = getSocket();
    socket.emit("room:join", { code: code.toUpperCase().replace(/-/g, "") });
  },

  leaveRoom: () => {
    try {
      const socket = getSocket();
      socket.emit("room:leave");
    } catch {
      // Socket may not be connected — still reset local state
    }
    set({ ...initialState, myDabs: [], myCards: [], myPowerUps: [], peekedNumbers: [], reactions: [] });
  },

  startGame: () => {
    const socket = getSocket();
    socket.emit("game:start");
  },

  newRound: () => {
    const socket = getSocket();
    socket.emit("game:new_round");
  },

  setCardCount: (count) => {
    const clamped = Math.max(1, Math.min(4, count));
    set({ cardCount: clamped });
    const socket = getSocket();
    socket.emit("room:set_card_count", { count: clamped });
  },

  setActiveCard: (index) => {
    const { myCards } = get();
    if (index >= 0 && index < myCards.length) {
      set({ activeCardIndex: index });
    }
  },

  // Dabs are one-way: once dabbed, a cell stays dabbed (matches server behavior)
  dabCell: (cellIndex) => {
    const { myDabs, activeCardIndex, myCards, gameState, room } = get();
    const currentDabs = myDabs[activeCardIndex];
    if (!currentDabs || currentDabs.has(cellIndex)) return; // Already dabbed, no-op

    // Only allow dabbing numbers that have been called
    const card = myCards[activeCardIndex];
    if (card && gameState && room) {
      const value = getCellValue(card, cellIndex, room.variant);
      if (value !== null && !gameState.calledNumbers.includes(value)) return;
    }

    const newCardDabs = new Set(currentDabs);
    newCardDabs.add(cellIndex);
    const newDabs = [...myDabs];
    newDabs[activeCardIndex] = newCardDabs;
    set({ myDabs: newDabs });

    const socket = getSocket();
    socket.emit("game:dab", { cellIndex, cardIndex: activeCardIndex });
  },

  claimBingo: () => {
    const { myDabs, activeCardIndex } = get();
    const currentDabs = myDabs[activeCardIndex];
    const socket = getSocket();
    // Send current card's dabs as hint, but server checks ALL cards
    socket.emit("game:claim_bingo", {
      markedCells: Array.from(currentDabs ?? []),
      cardIndex: activeCardIndex,
    });
  },

  pauseGame: () => {
    const socket = getSocket();
    socket.emit("game:pause");
  },

  resumeGame: () => {
    const socket = getSocket();
    socket.emit("game:resume");
  },

  sendChat: (text) => {
    if (!text.trim()) return;
    const socket = getSocket();
    socket.emit("chat:message", { text: text.trim() });
  },

  updateSettings: (settings) => {
    const socket = getSocket();
    socket.emit("room:update_settings", settings);
  },

  sendReaction: (emoji) => {
    const socket = getSocket();
    socket.emit("chat:reaction", { emoji });
  },

  toggleAutoDaub: () => {
    const next = !get().autoDaub;
    localStorage.setItem("bingo-auto-daub", String(next));
    set({ autoDaub: next });
  },

  usePowerUp: (powerupId, targetCellIndex) => {
    const socket = getSocket();
    // Optimistically mark as used
    set((state) => ({
      myPowerUps: state.myPowerUps.map((p) =>
        p.id === powerupId ? { ...p, used: true } : p,
      ),
    }));
    socket.emit("game:use_powerup", { powerupId, targetCellIndex });
  },

  setupListeners: () => {
    const socket = getSocket();

    // ---- Room lifecycle listeners ----

    // Server emits room:state on create, join, settings update, and new round
    socket.on("room:state", (room: Room) => {
      set((state) => ({
        room,
        isConnecting: false,
        error: null,
        // If transitioning to lobby (new round), clear game state
        ...(room.state === "lobby"
          ? {
              gameState: null,
              myCards: [],
              myDabs: [],
              activeCardIndex: 0,
              myPowerUps: [],
              peekedNumbers: [],
              chatMessages: state.chatMessages, // Preserve chat
            }
          : {}),
      }));
    });

    socket.on("room:player_joined", (data: { player: Player }) => {
      set((state) => {
        if (!state.room) return state;
        // Avoid duplicates
        const exists = state.room.players.some(
          (p) => p.id === data.player.id,
        );
        if (exists) return state;
        return {
          room: {
            ...state.room,
            players: [...state.room.players, data.player],
          },
        };
      });
    });

    socket.on(
      "room:player_left",
      (data: { playerId: string }) => {
        set((state) => {
          if (!state.room) return state;
          return {
            room: {
              ...state.room,
              players: state.room.players.filter(
                (p) => p.id !== data.playerId,
              ),
            },
          };
        });
      },
    );

    socket.on(
      "room:player_updated",
      (data: { playerId: string; connected: boolean }) => {
        set((state) => {
          if (!state.room) return state;
          return {
            room: {
              ...state.room,
              players: state.room.players.map((p) =>
                p.id === data.playerId
                  ? { ...p, connected: data.connected }
                  : p,
              ),
            },
          };
        });
      },
    );

    socket.on(
      "room:host_changed",
      (data: { newHostId: string }) => {
        set((state) => {
          if (!state.room) return state;
          return {
            room: {
              ...state.room,
              hostId: data.newHostId,
              players: state.room.players.map((p) => ({
                ...p,
                isHost: p.id === data.newHostId,
              })),
            },
          };
        });
      },
    );

    // ---- Game lifecycle listeners ----

    // Server emits game:card_dealt to each player individually (multi-card)
    socket.on("game:card_dealt", (data: { cards: BingoCard[] }) => {
      const cards = data.cards;
      // Initialize dab sets for each card, auto-dab FREE space on 75-ball cards
      const dabSets: Set<number>[] = cards.map((card) => {
        const dabs = new Set<number>();
        if ("grid" in card && card.grid.length === 5) {
          dabs.add(FREE_SPACE_INDEX);
        }
        return dabs;
      });
      set({ myCards: cards, myDabs: dabSets, activeCardIndex: 0 });
    });

    // Server emits game:started to entire room
    socket.on(
      "game:started",
      (data: { startedAt: number }) => {
        set((state) => ({
          gameState: {
            calledNumbers: [],
            currentNumber: null,
            currentLetter: null,
            paused: false,
            startedAt: data.startedAt,
            winners: [],
          },
          room: state.room
            ? { ...state.room, state: "in_progress" as const }
            : null,
        }));
      },
    );

    // Server emits game:number_called
    socket.on(
      "game:number_called",
      (data: {
        number: number;
        calledNumbers: number[];
        remaining: number;
        letter?: string;
      }) => {
        set((state) => ({
          gameState: state.gameState
            ? {
                ...state.gameState,
                calledNumbers: data.calledNumbers,
                currentNumber: data.number,
                currentLetter: data.letter ?? null,
              }
            : null,
        }));

        // Auto-daub: scan all cards for the called number
        if (get().autoDaub) {
          performAutoDaub(data.number, get, set);
        }
      },
    );

    socket.on("game:paused", () => {
      set((state) => ({
        gameState: state.gameState
          ? { ...state.gameState, paused: true }
          : null,
      }));
    });

    socket.on("game:resumed", () => {
      set((state) => ({
        gameState: state.gameState
          ? { ...state.gameState, paused: false }
          : null,
      }));
    });

    // Server emits game:bingo_claimed
    socket.on(
      "game:bingo_claimed",
      (data: {
        valid: boolean;
        playerId: string;
        playerName: string;
        pattern?: string;
      }) => {
        if (data.valid) {
          set((state) => ({
            gameState: state.gameState
              ? {
                  ...state.gameState,
                  winners: [
                    ...state.gameState.winners,
                    {
                      playerId: data.playerId,
                      playerName: data.playerName,
                      pattern: data.pattern ?? "",
                      timestamp: Date.now(),
                    },
                  ],
                }
              : null,
          }));
        }
      },
    );

    socket.on(
      "game:finished",
      (data: {
        reason: string;
        winners: WinEvent[];
        calledNumbers?: number[];
      }) => {
        set((state) => ({
          gameState: state.gameState
            ? {
                ...state.gameState,
                winners: data.winners,
                calledNumbers:
                  data.calledNumbers ?? state.gameState.calledNumbers,
              }
            : null,
          room: state.room
            ? { ...state.room, state: "finished" as const }
            : null,
        }));
      },
    );

    // ---- Power-up listeners ----

    socket.on(
      "game:powerups_dealt",
      (data: { powerups: PlayerPowerUp[] }) => {
        set({ myPowerUps: data.powerups });
      },
    );

    // game:powerup_used is handled by Room.tsx for toast display (no store update needed)

    socket.on("game:number_peek", (data: { numbers: number[] }) => {
      // Clear any existing peek timeout before setting a new one
      if (_peekTimeoutId !== null) {
        clearTimeout(_peekTimeoutId);
      }
      set({ peekedNumbers: data.numbers });
      // Auto-clear after 10 seconds
      _peekTimeoutId = setTimeout(() => {
        _peekTimeoutId = null;
        set({ peekedNumbers: [] });
      }, 10000);
    });

    socket.on(
      "game:turbo_stamp_applied",
      (data: { dabs: number[]; cardIndex?: number }) => {
        set((state) => {
          const newDabs = [...state.myDabs];
          const idx = data.cardIndex ?? state.activeCardIndex;
          if (idx >= 0 && idx < newDabs.length) {
            newDabs[idx] = new Set(data.dabs);
          }
          return { myDabs: newDabs };
        });
      },
    );

    socket.on(
      "game:wild_square_applied",
      (data: { cellIndex: number }) => {
        set((state) => {
          const newDabs = [...state.myDabs];
          const idx = state.activeCardIndex;
          if (newDabs[idx]) {
            const updated = new Set(newDabs[idx]);
            updated.add(data.cellIndex);
            newDabs[idx] = updated;
          }
          return { myDabs: newDabs };
        });
      },
    );

    // ---- Chat and reaction listeners ----

    socket.on("chat:message", (message: ChatMessage) => {
      set((state) => {
        const msgs = [...state.chatMessages, message];
        return { chatMessages: msgs.length > 100 ? msgs.slice(-100) : msgs };
      });
    });

    socket.on("chat:reaction", (data: { playerId: string; playerName: string; emoji: string }) => {
      const id = `${Date.now()}-${Math.random()}`;
      const reaction: EmojiReaction = { emoji: data.emoji, playerName: data.playerName, id };
      set((state) => ({ reactions: [...state.reactions, reaction] }));
      setTimeout(() => {
        set((state) => ({ reactions: state.reactions.filter((r) => r.id !== id) }));
      }, 3000);
    });

    // ---- Error listener ----

    socket.on("error", (data: { message: string }) => {
      set({ error: data.message, isConnecting: false });
    });
  },

  cleanupListeners: () => {
    const socket = getSocket();
    const events = [
      "room:state",
      "room:player_joined",
      "room:player_left",
      "room:player_updated",
      "room:host_changed",
      "game:card_dealt",
      "game:started",
      "game:number_called",
      "game:paused",
      "game:resumed",
      "game:bingo_claimed",
      "game:finished",
      "game:powerups_dealt",
      "game:number_peek",
      "game:turbo_stamp_applied",
      "game:wild_square_applied",
      "chat:message",
      "chat:reaction",
      "error",
    ];
    for (const event of events) {
      socket.off(event);
    }
  },

  reset: () => {
    if (_peekTimeoutId !== null) {
      clearTimeout(_peekTimeoutId);
      _peekTimeoutId = null;
    }
    get().cleanupListeners();
    set({ ...initialState, myDabs: [], myCards: [], myPowerUps: [], peekedNumbers: [] });
  },
}));
