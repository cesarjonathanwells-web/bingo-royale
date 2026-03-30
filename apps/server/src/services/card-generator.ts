// ============================================================
// Bingo Royale - Card Generation Service
// ============================================================

import type { BingoCard, BingoVariant } from '@bingo/shared';
import { generateCard75, generateCard90 } from '@bingo/shared';
import * as roomStore from '../redis/room-store.js';

/**
 * Generate a single card based on the game variant.
 */
export function generateCard(variant: BingoVariant): BingoCard {
  if (variant === '75') {
    return generateCard75();
  }
  return generateCard90();
}

/**
 * Generate unique cards for all players in a room and store them.
 * Returns a map of playerId -> card.
 */
export async function generateCardsForRoom(
  variant: BingoVariant,
  playerIds: string[],
  roomCode: string,
): Promise<Map<string, BingoCard>> {
  const cards = new Map<string, BingoCard>();

  for (const playerId of playerIds) {
    const card = generateCard(variant);
    cards.set(playerId, card);
    await roomStore.setCard(roomCode, playerId, card);
  }

  return cards;
}
