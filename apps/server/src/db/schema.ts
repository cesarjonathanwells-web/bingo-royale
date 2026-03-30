// ============================================================
// Bingo Royale - Drizzle ORM Schema
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// --------------- Users ---------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: varchar('display_name', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: text('password_hash'),
  isGuest: boolean('is_guest').notNull().default(true),
  locale: varchar('locale', { length: 5 }).notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

// --------------- Games ---------------

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomCode: varchar('room_code', { length: 10 }).notNull(),
  hostId: uuid('host_id')
    .notNull()
    .references(() => users.id),
  variant: varchar('variant', { length: 2 }).notNull().$type<'75' | '90'>(),
  state: varchar('state', { length: 20 }).notNull().$type<'lobby' | 'in_progress' | 'finished'>(),
  speed: integer('speed').notNull(),
  patterns: jsonb('patterns').$type<string[]>().notNull().default([]),
  calledNumbers: jsonb('called_numbers').$type<number[]>().notNull().default([]),
  winnerId: uuid('winner_id').references(() => users.id),
  winPattern: varchar('win_pattern', { length: 50 }),
  playerCount: integer('player_count').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --------------- Game Players ---------------

export const gamePlayers = pgTable(
  'game_players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    card: jsonb('card').notNull(),
    dabState: jsonb('dab_state').notNull().default([]),
    isWinner: boolean('is_winner').notNull().default(false),
  },
  (table) => [
    uniqueIndex('game_players_game_user_idx').on(table.gameId, table.userId),
  ],
);

// --------------- User Stats ---------------

export const userStats = pgTable('user_stats', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  gamesPlayed: integer('games_played').notNull().default(0),
  gamesWon: integer('games_won').notNull().default(0),
  totalDabs: integer('total_dabs').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
