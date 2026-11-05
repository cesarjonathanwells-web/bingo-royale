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
  WinPattern,
  PlayerPowerUp,
  PowerUpId,
  PowerUpEffects,
  PowerUpState,
  PowerUpUseOptions,
  PowerUpUseResult,
  WinStage90,
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
  playerCardCounts: Record<string, number>;
  chatMessages: ChatMessage[];
  isConnecting: boolean;
  error: string | null;
  myPowerUps: PlayerPowerUp[];
  peekedNumbers: number[];
  reactions: EmojiReaction[];
  autoDaub: boolean;
  powerUpEffects: PowerUpEffects;
  powerUpCalledCount: number;
  pendingPowerUp: PowerUpId | null;
  callerChoices: number[];
  powerUpError: string | null;
  socketReady: boolean;

  // Actions
  createRoom: (variant: BingoVariant) => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  newRound: () => void;
  setCardCount: (count: number) => void;
  setActiveCard: (index: number) => void;
  dabCell: (cellIndex: number, cardIndex?: number) => void;
  claimBingo: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  sendChat: (text: string) => void;
  updateSettings: (settings: {
    speed?: number;
    patterns?: string[];
    playerLimit?: number;
    customPatterns?: WinPattern[];
  }) => void;
  usePowerUp: (powerupId: PowerUpId, options?: PowerUpUseOptions) => void;
  clearPowerUpPrompt: () => void;
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
  playerCardCounts: {} as Record<string, number>,
  chatMessages: [],
  isConnecting: false,
  error: null,
  myPowerUps: [] as PlayerPowerUp[],
  peekedNumbers: [] as number[],
  reactions: [] as EmojiReaction[],
  powerUpEffects: { wildCells: [], blockedCells: [], shieldUntilCall: 0 } as PowerUpEffects,
  powerUpCalledCount: 0,
  pendingPowerUp: null as PowerUpId | null,
  callerChoices: [] as number[],
  powerUpError: null as string | null,
  socketReady: false,
  autoDaub: typeof window !== "undefined" && localStorage.getItem("bingo-auto-daub") === "true",
};

// Module-level variable for peek timeout (not reactive state)
let _peekTimeoutId: ReturnType<typeof setTimeout> | null = null;
let _powerUpTimeoutId: ReturnType<typeof setTimeout> | null = null;
let _powerUpRequest = 0;
const _pendingDabs = new Set<string>();
let _roomRequest = 0;
let _roomTimeoutId: ReturnType<typeof setTimeout> | null = null;
let _roomCode: string | null = null;
let _roomConnect: { socket: ReturnType<typeof getSocket>; handler: () => void } | null = null;

function clearRoomRequest(): void {
  _roomRequest++;
  if (_roomTimeoutId !== null) clearTimeout(_roomTimeoutId);
  _roomTimeoutId = null;
  if (_roomConnect) _roomConnect.socket.off("connect", _roomConnect.handler);
  _roomConnect = null;
  _roomCode = null;
}

function roomError(error?: string): string {
  if (error === "Room not found") return "errors.invalidRoom";
  if (error === "Room is full") return "errors.roomFull";
  if (error?.startsWith("Invalid room code") || error === "Room code is required") return "errors.invalidCode";
  return error || "errors.generic";
}

type RoomSetter = (partial: Partial<RoomState> | ((state: RoomState) => Partial<RoomState>)) => void;

function acceptRoom(room: Room, set: RoomSetter, get: () => RoomState): void {
  if (!room || typeof room.code !== "string") return;
  // Only the requested room or the current room can update this client.
  if (get().isConnecting && _roomCode && room.code !== _roomCode) return;
  if (!get().isConnecting && get().room?.code !== room.code) return;
  clearRoomRequest();
  if (room.state === "lobby") {
    clearPowerUpRequest();
    _pendingDabs.clear();
    if (_peekTimeoutId !== null) clearTimeout(_peekTimeoutId);
    _peekTimeoutId = null;
  }
  set({
    room, isConnecting: false, error: null,
    ...(room.state === "lobby" ? {
      gameState: null, myCards: [], myDabs: [], activeCardIndex: 0,
      myPowerUps: [], peekedNumbers: [],
      powerUpEffects: { wildCells: [], blockedCells: [], shieldUntilCall: 0 },
      powerUpCalledCount: 0, pendingPowerUp: null, callerChoices: [], powerUpError: null,
    } : {}),
  });
}

function requestRoom(event: "room:create" | "room:join", data: { variant?: BingoVariant; code?: string }, set: RoomSetter, get: () => RoomState): void {
  if (get().isConnecting) return;
  clearRoomRequest();
  const request = _roomRequest;
  _roomCode = data.code ?? null;
  set({ isConnecting: true, error: null });
  const fail = (error: string) => {
    if (request !== _roomRequest) return;
    clearRoomRequest();
    set({ isConnecting: false, error });
  };
  _roomTimeoutId = setTimeout(() => fail("errors.roomTimeout"), 10000);
  try {
    const socket = getSocket();
    const send = () => {
      if (request !== _roomRequest) return;
      if (_roomConnect) socket.off("connect", _roomConnect.handler);
      _roomConnect = null;
      socket.emit(event, data, (result: { success: boolean; room?: Room | null; error?: string }) => {
        if (request !== _roomRequest) return;
        if (!result?.success || !result.room) {
          fail(roomError(result?.error));
          return;
        }
        acceptRoom(result.room, set, get);
      });
    };
    // Do not buffer a join that could unexpectedly run after a timeout or Exit.
    // Wait for the connection within the same bounded request instead.
    if (socket.connected === false) {
      _roomConnect = { socket, handler: send };
      socket.on("connect", send);
      socket.connect();
    } else send();
  } catch {
    fail("errors.connection");
  }
}

function clearPowerUpRequest(): void {
  _powerUpRequest++;
  if (_powerUpTimeoutId !== null) clearTimeout(_powerUpTimeoutId);
  _powerUpTimeoutId = null;
}

function isBlocked(state: RoomState, cardIndex: number, cellIndex: number): boolean {
  return state.powerUpEffects.blockedCells.some(cell => cell.cardIndex === cardIndex && cell.cellIndex === cellIndex && cell.expiresAtCall >= state.powerUpCalledCount);
}


function requestDab(cardIndex: number, cellIndex: number): void {
  const socket = getSocket();
  if (socket.connected === false) return;
  const key = `${cardIndex}:${cellIndex}`;
  if (_pendingDabs.has(key)) return;
  _pendingDabs.add(key);
  socket.emit("game:dab", { cellIndex, cardIndex }, () => { _pendingDabs.delete(key); });
}

/** Auto-daub requests obey the same server confirmation and ink rules as taps. */
function performAutoDaub(calledNumber: number, get: () => RoomState): void {
  const state = get();
  if (state.room?.state !== "in_progress" || state.gameState?.paused) return;
  state.myCards.forEach((card, ci) => {
    const cellIndex = card.grid.length === 5
      ? findCellIndex75(card as BingoCard75, calledNumber)
      : findCellIndex90(card as BingoCard90, calledNumber);
    if (cellIndex !== null && !state.myDabs[ci]?.has(cellIndex) && !isBlocked(state, ci, cellIndex)) requestDab(ci, cellIndex);
  });
}

export const useRoomStore = create<RoomState>()((set, get) => ({
  ...initialState,

  createRoom: (variant) => {
    requestRoom("room:create", { variant }, set, get);
  },

  joinRoom: (code) => {
    const normalized = code.toUpperCase().replace(/[\s-]/g, "");
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      if (!get().isConnecting) set({ isConnecting: false, error: "errors.invalidCode" });
      return;
    }
    requestRoom("room:join", { code: normalized }, set, get);
  },

  leaveRoom: () => {
    clearRoomRequest();
    clearPowerUpRequest();
    _pendingDabs.clear();
    if (_peekTimeoutId !== null) clearTimeout(_peekTimeoutId);
    _peekTimeoutId = null;
    const socketReady = get().socketReady;
    try {
      const socket = getSocket();
      socket.emit("room:leave");
    } catch {
      // Socket may not be connected — still reset local state
    }
    set({ ...initialState, socketReady, myDabs: [], myCards: [], myPowerUps: [], peekedNumbers: [], reactions: [] });
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

  // The server confirms every mark; blocked and uncalled cells never become local marks.
  dabCell: (cellIndex, cardIndex = get().activeCardIndex) => {
    const state = get();
    const { myDabs, myCards, gameState, room } = state;
    if (room?.state !== "in_progress" || !gameState || gameState.paused || !Number.isInteger(cellIndex)) return;
    const card = myCards[cardIndex];
    const currentDabs = myDabs[cardIndex];
    if (!card || !currentDabs || currentDabs.has(cellIndex) || isBlocked(state, cardIndex, cellIndex)) return;
    const value = getCellValue(card, cellIndex, room.variant);
    if (!value || !gameState.calledNumbers.includes(value)) return;
    requestDab(cardIndex, cellIndex);
  },

  claimBingo: () => {
    const { room, myCards, myDabs, activeCardIndex } = get();
    const currentDabs = myDabs[activeCardIndex];
    if (!room || !myCards.length) return;
    let stage: WinStage90 | undefined;
    if (room.variant === "90") {
      // Prefer the highest enabled completed stage across every card.
      const stages: WinStage90[] = ["full_house", "two_lines", "one_line"];
      const configuredStages = stages.filter(candidate => room.patterns.includes(candidate));
      const enabledStages = configuredStages.length ? configuredStages : stages;
      stage = enabledStages.find(candidate =>
        myCards.some((card, ci) => {
          // Dab requests precede this claim on the socket and are serialized by the server.
          const marks = new Set(myDabs[ci] ?? []);
          for (const pending of _pendingDabs) {
            const [pendingCard, cell] = pending.split(":").map(Number);
            if (pendingCard === ci) marks.add(cell);
          }
          let rows = 0;
          for (let row = 0; row < 3; row++) {
            if (card.grid.every((column, col) => !column[row] || marks.has(row * 9 + col))) rows++;
          }
          return rows >= (candidate === "full_house" ? 3 : candidate === "two_lines" ? 2 : 1);
        }),
      ) ?? enabledStages[enabledStages.length - 1];
    }
    getSocket().emit("game:claim_bingo", { markedCells: Array.from(currentDabs ?? []), cardIndex: activeCardIndex, ...(stage ? { stage } : {}) });
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

  usePowerUp: (powerupId, options = {}) => {
    const state = get();
    const socket = getSocket();
    if (state.pendingPowerUp || state.room?.state !== "in_progress" || state.gameState?.paused || !state.myCards.length) return;
    if (socket.connected === false) { set({ powerUpError: "disconnected" }); return; }
    clearPowerUpRequest();
    const request = _powerUpRequest;
    const roomCode = state.room.code;
    set({ pendingPowerUp: powerupId, powerUpError: null });
    _powerUpTimeoutId = setTimeout(() => {
      if (request !== _powerUpRequest) return;
      set({ pendingPowerUp: null, powerUpError: "timeout" });
      _powerUpTimeoutId = null;
    }, 8000);
    socket.emit("game:use_powerup", { powerupId, ...options }, (result: PowerUpUseResult & { errorCode?: string }) => {
      if (request !== _powerUpRequest || get().room?.code !== roomCode) return;
      if (_powerUpTimeoutId !== null) clearTimeout(_powerUpTimeoutId);
      _powerUpTimeoutId = null;
      if (!result?.success) {
        set({ pendingPowerUp: null, powerUpError: result?.errorCode ?? "failed", ...(result?.choices ? { callerChoices: result.choices } : {}) });
        return;
      }
      set({ pendingPowerUp: null, powerUpError: null, callerChoices: result.choices ?? [] });
      // The private server snapshot is authoritative. Acknowledgment alone never consumes a power-up locally.
    });
  },

  clearPowerUpPrompt: () => set({ callerChoices: [], powerUpError: null }),

  setupListeners: () => {
    const socket = getSocket();

    // ---- Room lifecycle listeners ----

    // Server emits room:state on create, join, settings update, and new round
    socket.on("room:state", (room: Room) => acceptRoom(room, set, get));

    socket.on("room:card_count_updated", (data: { playerId: string; count: number }) => {
      set((state) => ({
        playerCardCounts: { ...state.playerCardCounts, [data.playerId]: data.count },
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

        set(state => ({ peekedNumbers: state.peekedNumbers.filter(number => !data.calledNumbers.includes(number)) }));

        // Auto-daub: scan all cards for the called number
        if (get().autoDaub) {
          performAutoDaub(data.number, get);
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
        clearPowerUpRequest();
        _pendingDabs.clear();
        set({ pendingPowerUp: null, callerChoices: [], powerUpError: null });
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

    socket.on("game:powerup_state", (data: PowerUpState) => {
      if (get().room?.state !== "in_progress" || data.roomCode !== get().room?.code) return;
      const myDabs = data.cards.map((card, ci) => {
        const marks = new Set(data.dabs[ci] ?? []);
        if (card.grid.length === 5) marks.add(FREE_SPACE_INDEX);
        return marks;
      });
      myDabs.forEach((marks, ci) => marks.forEach(index => _pendingDabs.delete(`${ci}:${index}`)));
      set({ myCards: data.cards, myDabs, myPowerUps: data.powerups, powerUpEffects: data.effects, powerUpCalledCount: data.calledCount });
      // Catch up numbers that were called while a cell was blocked.
      if (get().autoDaub && get().room?.state === "in_progress") {
        for (const number of get().gameState?.calledNumbers ?? []) performAutoDaub(number, get);
      }
    });


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
      set((state) => {
        const newReactions = [...state.reactions, reaction];
        return { reactions: newReactions.length > 20 ? newReactions.slice(-20) : newReactions };
      });
      setTimeout(() => {
        set((state) => ({ reactions: state.reactions.filter((r) => r.id !== id) }));
      }, 3000);
    });

    socket.on("disconnect", () => {
      clearRoomRequest();
      _pendingDabs.clear();
      clearPowerUpRequest();
      set({ pendingPowerUp: null, callerChoices: [], socketReady: false, isConnecting: false });
    });

    socket.on("connect_error", () => {
      clearRoomRequest();
      set({ isConnecting: false, socketReady: false, error: "errors.connection" });
    });

    // ---- Error listener ----

    socket.on("error", (data: { message: string }) => {
      clearRoomRequest();
      set({ error: roomError(data?.message), isConnecting: false });
    });
  },

  cleanupListeners: () => {
    const socket = getSocket();
    const events = [
      "room:state",
      "room:card_count_updated",
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
      "game:powerup_state",
      "game:number_peek",
      "game:turbo_stamp_applied",
      "game:wild_square_applied",
      "chat:message",
      "chat:reaction",
      "error",
      "disconnect",
      "connect_error",
    ];
    for (const event of events) {
      socket.off(event);
    }
  },

  reset: () => {
    clearRoomRequest();
    clearPowerUpRequest();
    _pendingDabs.clear();
    if (_peekTimeoutId !== null) {
      clearTimeout(_peekTimeoutId);
      _peekTimeoutId = null;
    }
    get().cleanupListeners();
    set({ ...initialState, myDabs: [], myCards: [], myPowerUps: [], peekedNumbers: [] });
  },
}));

