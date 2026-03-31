// ============================================================
// Bingo Royale - Power-Up Definitions
// ============================================================

import type { PowerUpDef, PowerUpId } from './types.js';
import { shuffleArray } from './bingo.js';

// --------------- Power-up catalog ---------------

export const POWER_UPS: PowerUpDef[] = [
  {
    id: 'double_daub',
    name: 'Double Daub',
    nameEs: 'Doble Marca',
    description: 'Mark two numbers on next call',
    descriptionEs: 'Marca dos numeros en la proxima llamada',
    icon: '\u270C\uFE0F', // victory hand
  },
  {
    id: 'number_peek',
    name: 'Number Peek',
    nameEs: 'Espiar Numeros',
    description: 'See the next 3 numbers',
    descriptionEs: 'Ve los proximos 3 numeros',
    icon: '\uD83D\uDC41\uFE0F', // eye
  },
  {
    id: 'wild_square',
    name: 'Wild Square',
    nameEs: 'Comodin',
    description: 'Place a wildcard on any empty square',
    descriptionEs: 'Coloca un comodin en cualquier casilla vacia',
    icon: '\u2B50', // star
  },
  {
    id: 'shield',
    name: 'Shield',
    nameEs: 'Escudo',
    description: 'Protect your card from Scramble for 2 turns',
    descriptionEs: 'Protege tu carton de Revolver por 2 turnos',
    icon: '\uD83D\uDEE1\uFE0F', // shield
    duration: 2,
  },
  {
    id: 'scramble',
    name: 'Scramble',
    nameEs: 'Revolver',
    description: "Shuffle uncalled numbers on a random opponent's card",
    descriptionEs: 'Revuelve los numeros no cantados en el carton de un oponente',
    icon: '\uD83C\uDF00', // cyclone
  },
  {
    id: 'callers_choice',
    name: "Caller's Choice",
    nameEs: 'Eleccion del Cantor',
    description: 'Vote on one of three numbers to be called next',
    descriptionEs: 'Vota por uno de tres numeros para la proxima llamada',
    icon: '\uD83C\uDFAF', // target
  },
  {
    id: 'ink_blot',
    name: 'Ink Blot',
    nameEs: 'Mancha de Tinta',
    description: "Block one square on a random opponent's card for 2 numbers",
    descriptionEs: 'Bloquea una casilla del carton de un oponente por 2 numeros',
    icon: '\uD83D\uDC9C', // purple heart
    duration: 2,
  },
  {
    id: 'turbo_stamp',
    name: 'Turbo Stamp',
    nameEs: 'Sello Turbo',
    description: 'Auto-daub all called numbers on your card instantly',
    descriptionEs: 'Marca automaticamente todos los numeros cantados en tu carton',
    icon: '\u26A1', // lightning
  },
];

// --------------- Lookup map ---------------

export const POWER_UP_MAP: Record<PowerUpId, PowerUpDef> = Object.fromEntries(
  POWER_UPS.map((p) => [p.id, p]),
) as Record<PowerUpId, PowerUpDef>;

// --------------- Deal random power-ups ---------------

/**
 * Randomly select `count` non-duplicate power-ups.
 * Uses Fisher-Yates shuffle for fairness.
 */
export function dealPowerUps(count: number): PowerUpId[] {
  const clamped = Math.min(count, POWER_UPS.length);
  return shuffleArray(POWER_UPS.map((p) => p.id)).slice(0, clamped);
}
