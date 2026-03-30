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
 * Supports 1-4 cards per player via playerCardCounts map.
 * Returns a map of playerId -> cards array.
 */
export async function generateCardsForRoom(
  variant: BingoVariant,
  playerCardCounts: Map<string, number>,
  roomCode: string,
): Promise<Map<string, BingoCard[]>> {
  const cards = new Map<string, BingoCard[]>();

  for (const [playerId, count] of playerCardCounts) {
    const playerCards: BingoCard[] = [];
    const clampedCount = Math.max(1, Math.min(count, 4));
    for (let i = 0; i < clampedCount; i++) {
      playerCards.push(generateCard(variant));
    }
    cards.set(playerId, playerCards);
    await roomStore.setCard(roomCode, playerId, playerCards);
  }

  return cards;
}
