import { create } from "zustand";
import type {
  Room,
  GameState,
  BingoCard,
  ChatMessage,
  BingoVariant,
  Player,
  WinEvent,
} from "@bingo/shared";
import { FREE_SPACE_INDEX } from "@bingo/shared";
import { getSocket } from "@/socket";

interface RoomState {
  // State
  room: Room | null;
  gameState: GameState | null;
  myCard: BingoCard | null;
  myDabs: Set<number>;
  chatMessages: ChatMessage[];
  isConnecting: boolean;
  error: string | null;

  // Actions
  createRoom: (variant: BingoVariant) => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  newRound: () => void;
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

  // Internal
  setupListeners: () => void;
  cleanupListeners: () => void;
  reset: () => void;
}

const initialState = {
  room: null,
  gameState: null,
  myCard: null,
  myDabs: new Set<number>(),
  chatMessages: [],
  isConnecting: false,
  error: null,
};

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
    const socket = getSocket();
    socket.emit("room:leave");
    set({ ...initialState, myDabs: new Set<number>() });
  },

  startGame: () => {
    const socket = getSocket();
    socket.emit("game:start");
  },

  newRound: () => {
    const socket = getSocket();
    socket.emit("game:new_round");
  },

  // Dabs are one-way: once dabbed, a cell stays dabbed (matches server behavior)
  dabCell: (cellIndex) => {
    const { myDabs } = get();
    if (myDabs.has(cellIndex)) return; // Already dabbed, no-op

    const newDabs = new Set(myDabs);
    newDabs.add(cellIndex);
    set({ myDabs: newDabs });

    const socket = getSocket();
    socket.emit("game:dab", { cellIndex });
  },

  claimBingo: () => {
    const { myDabs } = get();
    const socket = getSocket();
    socket.emit("game:claim_bingo", { markedCells: Array.from(myDabs) });
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

  setupListeners: () => {
    const socket = getSocket();

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
              myCard: null,
              myDabs: new Set<number>(),
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

    // Server emits game:card_dealt to each player individually
    socket.on("game:card_dealt", (data: { card: BingoCard }) => {
      const dabs = new Set<number>();
      // Auto-dab the FREE space for 75-ball cards
      if ("grid" in data.card && data.card.grid.length === 5) {
        dabs.add(FREE_SPACE_INDEX);
      }
      set({ myCard: data.card, myDabs: dabs });
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

    socket.on("chat:message", (message: ChatMessage) => {
      set((state) => ({
        chatMessages: [...state.chatMessages, message],
      }));
    });

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
      "chat:message",
      "error",
    ];
    for (const event of events) {
      socket.off(event);
    }
  },

  reset: () => {
    get().cleanupListeners();
    set({ ...initialState, myDabs: new Set<number>() });
  },
}));
