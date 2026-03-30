// ============================================================
// Bingo Royale - Socket.IO Event Definitions & Zod Schemas
// ============================================================

import { z } from 'zod';

// =====================================================================
// Event name constants
// =====================================================================

// Client -> Server
export const C2S_ROOM_CREATE = 'room:create' as const;
export const C2S_ROOM_JOIN = 'room:join' as const;
export const C2S_ROOM_LEAVE = 'room:leave' as const;
export const C2S_GAME_START = 'game:start' as const;
export const C2S_GAME_DAB = 'game:dab' as const;
export const C2S_GAME_CLAIM_BINGO = 'game:claim_bingo' as const;
export const C2S_GAME_PAUSE = 'game:pause' as const;
export const C2S_GAME_RESUME = 'game:resume' as const;
export const C2S_CHAT_MESSAGE = 'chat:message' as const;

// Server -> Client
export const S2C_ROOM_STATE = 'room:state' as const;
export const S2C_ROOM_PLAYER_JOINED = 'room:player_joined' as const;
export const S2C_ROOM_PLAYER_LEFT = 'room:player_left' as const;
export const S2C_GAME_STARTED = 'game:started' as const;
export const S2C_GAME_NUMBER_CALLED = 'game:number_called' as const;
export const S2C_GAME_BINGO_CLAIMED = 'game:bingo_claimed' as const;
export const S2C_GAME_FINISHED = 'game:finished' as const;
export const S2C_GAME_PAUSED = 'game:paused' as const;
export const S2C_GAME_RESUMED = 'game:resumed' as const;
export const S2C_CHAT_MESSAGE = 'chat:message' as const;
export const S2C_ERROR = 'error' as const;

// =====================================================================
// Shared schema fragments
// =====================================================================

const BingoVariantSchema = z.enum(['75', '90']);

const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  isHost: z.boolean(),
  connected: z.boolean(),
  isSpectator: z.boolean(),
});

const WinEventSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  pattern: z.string(),
  timestamp: z.number(),
});

const GameStateSchema = z.object({
  calledNumbers: z.array(z.number()),
  currentNumber: z.number().nullable(),
  currentLetter: z.string().nullable(),
  paused: z.boolean(),
  startedAt: z.number(),
  winners: z.array(WinEventSchema),
});

const RoomStateEnumSchema = z.enum(['lobby', 'in_progress', 'finished']);

const RoomSchema = z.object({
  code: z.string(),
  hostId: z.string(),
  variant: BingoVariantSchema,
  state: RoomStateEnumSchema,
  speed: z.number(),
  patterns: z.array(z.string()),
  playerLimit: z.number(),
  players: z.array(PlayerSchema),
  createdAt: z.number(),
});

// Card schemas - used in server->client payloads
const BingoCard75Schema = z.object({
  id: z.string(),
  grid: z.array(z.array(z.number().nullable())),
});

const BingoCard90Schema = z.object({
  id: z.string(),
  grid: z.array(z.array(z.number())),
});

const BingoCardSchema = z.union([BingoCard75Schema, BingoCard90Schema]);

const ChatMessageSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  text: z.string(),
  timestamp: z.number(),
});

// =====================================================================
// Client -> Server payload schemas
// =====================================================================

export const RoomCreateSchema = z.object({
  playerName: z.string().min(1).max(30),
  locale: z.string().min(2).max(5),
  variant: BingoVariantSchema,
});

export const RoomJoinSchema = z.object({
  roomCode: z.string().min(1).max(10),
  playerName: z.string().min(1).max(30),
});

export const RoomLeaveSchema = z.object({});

export const GameStartSchema = z.object({
  speed: z.number().min(500).max(30000),
  patterns: z.array(z.string().min(1)).min(1),
});

export const GameDabSchema = z.object({
  cellIndex: z.number().int().min(0),
});

export const GameClaimBingoSchema = z.object({
  markedCells: z.array(z.number().int().min(0)),
});

export const GamePauseSchema = z.object({});

export const GameResumeSchema = z.object({});

export const ChatMessageSendSchema = z.object({
  text: z.string().min(1).max(500),
});

// =====================================================================
// Server -> Client payload schemas
// =====================================================================

export const RoomStatePayloadSchema = z.object({
  room: RoomSchema,
  gameState: GameStateSchema.nullable(),
});

export const RoomPlayerJoinedPayloadSchema = PlayerSchema;

export const RoomPlayerLeftPayloadSchema = z.object({
  playerId: z.string(),
});

export const GameStartedPayloadSchema = z.object({
  card: BingoCardSchema,
  patterns: z.array(z.string()),
  speed: z.number(),
});

export const GameNumberCalledPayloadSchema = z.object({
  number: z.number(),
  letter: z.string().nullable(),
  calledSoFar: z.array(z.number()),
});

export const GameBingoClaimedPayloadSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  valid: z.boolean(),
  pattern: z.string().optional(),
});

export const GameFinishedPayloadSchema = z.object({
  winners: z.array(WinEventSchema),
});

export const GamePausedPayloadSchema = z.object({});

export const GameResumedPayloadSchema = z.object({});

export const ChatMessagePayloadSchema = ChatMessageSchema;

export const ErrorPayloadSchema = z.object({
  message: z.string(),
  code: z.string(),
});

// =====================================================================
// Inferred TypeScript types from Zod schemas
// =====================================================================

// Client -> Server
export type RoomCreatePayload = z.infer<typeof RoomCreateSchema>;
export type RoomJoinPayload = z.infer<typeof RoomJoinSchema>;
export type RoomLeavePayload = z.infer<typeof RoomLeaveSchema>;
export type GameStartPayload = z.infer<typeof GameStartSchema>;
export type GameDabPayload = z.infer<typeof GameDabSchema>;
export type GameClaimBingoPayload = z.infer<typeof GameClaimBingoSchema>;
export type GamePausePayload = z.infer<typeof GamePauseSchema>;
export type GameResumePayload = z.infer<typeof GameResumeSchema>;
export type ChatMessageSendPayload = z.infer<typeof ChatMessageSendSchema>;

// Server -> Client
export type RoomStatePayload = z.infer<typeof RoomStatePayloadSchema>;
export type RoomPlayerJoinedPayload = z.infer<typeof RoomPlayerJoinedPayloadSchema>;
export type RoomPlayerLeftPayload = z.infer<typeof RoomPlayerLeftPayloadSchema>;
export type GameStartedPayload = z.infer<typeof GameStartedPayloadSchema>;
export type GameNumberCalledPayload = z.infer<typeof GameNumberCalledPayloadSchema>;
export type GameBingoClaimedPayload = z.infer<typeof GameBingoClaimedPayloadSchema>;
export type GameFinishedPayload = z.infer<typeof GameFinishedPayloadSchema>;
export type GamePausedPayload = z.infer<typeof GamePausedPayloadSchema>;
export type GameResumedPayload = z.infer<typeof GameResumedPayloadSchema>;
export type ChatMessagePayload = z.infer<typeof ChatMessagePayloadSchema>;
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

// =====================================================================
// Event maps (useful for type-safe Socket.IO wrappers)
// =====================================================================

export interface ClientToServerEvents {
  [C2S_ROOM_CREATE]: (payload: RoomCreatePayload) => void;
  [C2S_ROOM_JOIN]: (payload: RoomJoinPayload) => void;
  [C2S_ROOM_LEAVE]: (payload: RoomLeavePayload) => void;
  [C2S_GAME_START]: (payload: GameStartPayload) => void;
  [C2S_GAME_DAB]: (payload: GameDabPayload) => void;
  [C2S_GAME_CLAIM_BINGO]: (payload: GameClaimBingoPayload) => void;
  [C2S_GAME_PAUSE]: (payload: GamePausePayload) => void;
  [C2S_GAME_RESUME]: (payload: GameResumePayload) => void;
  [C2S_CHAT_MESSAGE]: (payload: ChatMessageSendPayload) => void;
}

export interface ServerToClientEvents {
  [S2C_ROOM_STATE]: (payload: RoomStatePayload) => void;
  [S2C_ROOM_PLAYER_JOINED]: (payload: RoomPlayerJoinedPayload) => void;
  [S2C_ROOM_PLAYER_LEFT]: (payload: RoomPlayerLeftPayload) => void;
  [S2C_GAME_STARTED]: (payload: GameStartedPayload) => void;
  [S2C_GAME_NUMBER_CALLED]: (payload: GameNumberCalledPayload) => void;
  [S2C_GAME_BINGO_CLAIMED]: (payload: GameBingoClaimedPayload) => void;
  [S2C_GAME_FINISHED]: (payload: GameFinishedPayload) => void;
  [S2C_GAME_PAUSED]: (payload: GamePausedPayload) => void;
  [S2C_GAME_RESUMED]: (payload: GameResumedPayload) => void;
  [S2C_CHAT_MESSAGE]: (payload: ChatMessagePayload) => void;
  [S2C_ERROR]: (payload: ErrorPayload) => void;
}

// =====================================================================
// Schema map (useful for server-side validation dispatch)
// =====================================================================

export const CLIENT_EVENT_SCHEMAS = {
  [C2S_ROOM_CREATE]: RoomCreateSchema,
  [C2S_ROOM_JOIN]: RoomJoinSchema,
  [C2S_ROOM_LEAVE]: RoomLeaveSchema,
  [C2S_GAME_START]: GameStartSchema,
  [C2S_GAME_DAB]: GameDabSchema,
  [C2S_GAME_CLAIM_BINGO]: GameClaimBingoSchema,
  [C2S_GAME_PAUSE]: GamePauseSchema,
  [C2S_GAME_RESUME]: GameResumeSchema,
  [C2S_CHAT_MESSAGE]: ChatMessageSendSchema,
} as const;
