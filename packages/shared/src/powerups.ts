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
    description: 'On the next call, automatically mark up to two numbers on the selected card, including uncalled bonus numbers',
    descriptionEs: 'En la próxima llamada, marca hasta dos números del cartón seleccionado, incluidos números de bonificación aún no cantados',
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
    description: 'Choose an unmarked number on any of your cards to mark as a wildcard',
    descriptionEs: 'Elige un número sin marcar de cualquiera de tus cartones para marcarlo como comodín',
    icon: '\u2B50', // star
  },
  {
    id: 'shield',
    name: 'Shield',
    nameEs: 'Escudo',
    description: 'Protect all your cards from Scramble and Ink Blot through the next two calls',
    descriptionEs: 'Protege todos tus cartones de Revolver y Mancha de Tinta durante las próximas dos llamadas',
    icon: '\uD83D\uDEE1\uFE0F', // shield
    duration: 2,
  },
  {
    id: 'scramble',
    name: 'Scramble',
    nameEs: 'Revolver',
    description: "Change unmarked, uncalled numbers on a random opponent's card while preserving its valid layout",
    descriptionEs: 'Cambia números sin marcar y aún no cantados del cartón de un oponente al azar, conservando su formato válido',
    icon: '\uD83C\uDF00', // cyclone
  },
  {
    id: 'callers_choice',
    name: "Caller's Choice",
    nameEs: 'Eleccion del Cantor',
    description: 'Choose one of up to three upcoming numbers to be called next',
    descriptionEs: 'Elige uno de hasta tres próximos números para que sea el siguiente en salir',
    icon: '\uD83C\uDFAF', // target
  },
  {
    id: 'ink_blot',
    name: 'Ink Blot',
    nameEs: 'Mancha de Tinta',
    description: "Block an unmarked number on a random opponent's card through the next two calls",
    descriptionEs: 'Bloquea un número sin marcar del cartón de un oponente al azar durante las próximas dos llamadas',
    icon: '\uD83D\uDC9C', // purple heart
    duration: 2,
  },
  {
    id: 'turbo_stamp',
    name: 'Turbo Stamp',
    nameEs: 'Sello Turbo',
    description: 'Instantly mark every called, unblocked number on the selected card',
    descriptionEs: 'Marca al instante todos los números cantados y sin bloquear del cartón seleccionado',
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

