// ============================================================
// Bingo Royale - Auth Service
// ============================================================

import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Socket } from 'socket.io';
import type { User, GuestUser, RegisteredUser } from '@bingo/shared';
import { config } from '../config.js';
import { getDb, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

const TOKEN_EXPIRY = '7d';

// --------------- Token payload ---------------

export interface TokenPayload {
  id: string;
  name: string;
  isGuest: boolean;
  locale: string;
}

// --------------- Extended socket with user ---------------

export interface AuthenticatedSocket extends Socket {
  data: {
    user: TokenPayload;
    roomCode?: string;
  };
}

// --------------- Generate Token ---------------

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

// --------------- Verify Token ---------------

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

// --------------- Create Guest User ---------------

export async function createGuestUser(
  name: string,
  locale: 'en' | 'es' = 'en',
): Promise<{ user: GuestUser; token: string }> {
  const id = randomUUID();

  const user: GuestUser = {
    id,
    name,
    isGuest: true,
    locale,
  };

  // Persist to DB if available
  const db = getDb();
  if (db) {
    await db.insert(schema.users).values({
      id,
      displayName: name,
      isGuest: true,
      locale,
    });
  }

  const token = generateToken({ id, name, isGuest: true, locale });

  return { user, token };
}

// --------------- Register User ---------------

export async function registerUser(
  name: string,
  email: string,
  password: string,
  locale: 'en' | 'es' = 'en',
): Promise<{ user: RegisteredUser; token: string }> {
  const db = getDb();

  const passwordHash = await bcrypt.hash(password, 12);
  const id = randomUUID();

  if (db) {
    // Check if email already exists
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Email already registered');
    }

    await db.insert(schema.users).values({
      id,
      displayName: name,
      email,
      passwordHash,
      isGuest: false,
      locale,
    });

    // Initialize stats
    await db.insert(schema.userStats).values({
      userId: id,
      gamesPlayed: 0,
      gamesWon: 0,
      totalDabs: 0,
    });
  }

  const user: RegisteredUser = {
    id,
    name,
    email,
    isGuest: false,
    locale,
  };

  const token = generateToken({ id, name, isGuest: false, locale });

  return { user, token };
}

// --------------- Login User ---------------

export async function loginUser(
  email: string,
  password: string,
): Promise<{ user: RegisteredUser; token: string }> {
  const db = getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const row = rows[0]!;

  if (!row.passwordHash) {
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, row.passwordHash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  // Update last seen
  await db
    .update(schema.users)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.users.id, row.id));

  const user: RegisteredUser = {
    id: row.id,
    name: row.displayName,
    email: row.email!,
    isGuest: false,
    locale: row.locale as 'en' | 'es',
  };

  const token = generateToken({
    id: user.id,
    name: user.name,
    isGuest: false,
    locale: user.locale,
  });

  return { user, token };
}

// --------------- Socket.IO Auth Middleware ---------------

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  const token =
    socket.handshake.auth?.token as string | undefined;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  const payload = verifyToken(token);
  if (!payload) {
    return next(new Error('Invalid or expired token'));
  }

  // Attach user data to socket
  socket.data.user = payload;
  next();
}
