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
    set(initialState);
  },

  startGame: () => {
    const socket = getSocket();
    socket.emit("game:start");
  },

  dabCell: (cellIndex) => {
    const { myDabs } = get();
    const newDabs = new Set(myDabs);

    if (newDabs.has(cellIndex)) {
      newDabs.delete(cellIndex);
    } else {
      newDabs.add(cellIndex);
    }

    set({ myDabs: newDabs });
    const socket = getSocket();
    socket.emit("game:dab", { cellIndex });
  },

  claimBingo: () => {
    const socket = getSocket();
    socket.emit("game:claim-bingo");
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
    socket.emit("chat:send", { text: text.trim() });
  },

  updateSettings: (settings) => {
    const socket = getSocket();
    socket.emit("room:settings", settings);
  },

  setupListeners: () => {
    const socket = getSocket();

    socket.on("room:created", (room: Room) => {
      set({ room, isConnecting: false });
    });

    socket.on("room:joined", (data: { room: Room; card?: BingoCard }) => {
      set({
        room: data.room,
        myCard: data.card ?? null,
        isConnecting: false,
      });
    });

    socket.on("room:updated", (room: Room) => {
      set({ room });
    });

    socket.on("room:player-joined", (player: Player) => {
      set((state) => {
        if (!state.room) return state;
        return {
          room: {
            ...state.room,
            players: [...state.room.players, player],
          },
        };
      });
    });

    socket.on("room:player-left", (playerId: string) => {
      set((state) => {
        if (!state.room) return state;
        return {
          room: {
            ...state.room,
            players: state.room.players.filter((p) => p.id !== playerId),
          },
        };
      });
    });

    socket.on(
      "room:player-status",
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
      "game:started",
      (data: { gameState: GameState; card: BingoCard }) => {
        set((state) => ({
          gameState: data.gameState,
          myCard: data.card,
          myDabs: new Set<number>(),
          room: state.room
            ? { ...state.room, state: "in_progress" }
            : null,
        }));
      },
    );

    socket.on(
      "game:number-called",
      (data: { number: number; letter: string | null; gameState: GameState }) => {
        set({ gameState: data.gameState });
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

    socket.on("game:bingo-valid", (win: WinEvent) => {
      set((state) => ({
        gameState: state.gameState
          ? {
              ...state.gameState,
              winners: [...state.gameState.winners, win],
            }
          : null,
      }));
    });

    socket.on("game:bingo-invalid", () => {
      // Handled by the component via a separate callback or toast
    });

    socket.on("game:finished", (data: { gameState: GameState }) => {
      set((state) => ({
        gameState: data.gameState,
        room: state.room ? { ...state.room, state: "finished" } : null,
      }));
    });

    socket.on("chat:message", (message: ChatMessage) => {
      set((state) => ({
        chatMessages: [...state.chatMessages, message],
      }));
    });

    socket.on("room:error", (data: { message: string }) => {
      set({ error: data.message, isConnecting: false });
    });

    socket.on("disconnect", () => {
      // Keep state but mark potential reconnection
    });
  },

  cleanupListeners: () => {
    const socket = getSocket();
    socket.off("room:created");
    socket.off("room:joined");
    socket.off("room:updated");
    socket.off("room:player-joined");
    socket.off("room:player-left");
    socket.off("room:player-status");
    socket.off("game:started");
    socket.off("game:number-called");
    socket.off("game:paused");
    socket.off("game:resumed");
    socket.off("game:bingo-valid");
    socket.off("game:bingo-invalid");
    socket.off("game:finished");
    socket.off("chat:message");
    socket.off("room:error");
  },

  reset: () => {
    get().cleanupListeners();
    set(initialState);
  },
}));
