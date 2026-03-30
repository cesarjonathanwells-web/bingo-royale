// ============================================================
// Bingo Royale - 75-Ball Win Patterns
// ============================================================
//
// All patterns use row-major indexing for a 5x5 grid:
//
//    0  1  2  3  4      (row 0)
//    5  6  7  8  9      (row 1)
//   10 11 12 13 14      (row 2)
//   15 16 17 18 19      (row 3)
//   20 21 22 23 24      (row 4)
//
// Index 12 is the FREE space (center).
// ============================================================

import type { WinPattern } from './types.js';

// --------------- Horizontal rows ---------------

const topRow: WinPattern = {
  id: 'top_row',
  name: 'Top Row',
  nameEs: 'Fila Superior',
  cells: [0, 1, 2, 3, 4],
};

const secondRow: WinPattern = {
  id: 'second_row',
  name: 'Second Row',
  nameEs: 'Segunda Fila',
  cells: [5, 6, 7, 8, 9],
};

const middleRow: WinPattern = {
  id: 'middle_row',
  name: 'Middle Row',
  nameEs: 'Fila Central',
  cells: [10, 11, 12, 13, 14],
};

const fourthRow: WinPattern = {
  id: 'fourth_row',
  name: 'Fourth Row',
  nameEs: 'Cuarta Fila',
  cells: [15, 16, 17, 18, 19],
};

const bottomRow: WinPattern = {
  id: 'bottom_row',
  name: 'Bottom Row',
  nameEs: 'Fila Inferior',
  cells: [20, 21, 22, 23, 24],
};

// --------------- Vertical columns ---------------

const colB: WinPattern = {
  id: 'col_b',
  name: 'Column B',
  nameEs: 'Columna B',
  cells: [0, 5, 10, 15, 20],
};

const colI: WinPattern = {
  id: 'col_i',
  name: 'Column I',
  nameEs: 'Columna I',
  cells: [1, 6, 11, 16, 21],
};

const colN: WinPattern = {
  id: 'col_n',
  name: 'Column N',
  nameEs: 'Columna N',
  cells: [2, 7, 12, 17, 22],
};

const colG: WinPattern = {
  id: 'col_g',
  name: 'Column G',
  nameEs: 'Columna G',
  cells: [3, 8, 13, 18, 23],
};

const colO: WinPattern = {
  id: 'col_o',
  name: 'Column O',
  nameEs: 'Columna O',
  cells: [4, 9, 14, 19, 24],
};

// --------------- Diagonals ---------------

const diagonalDown: WinPattern = {
  id: 'diagonal_down',
  name: 'Diagonal (Top-Left to Bottom-Right)',
  nameEs: 'Diagonal (Arriba-Izquierda a Abajo-Derecha)',
  cells: [0, 6, 12, 18, 24],
};

const diagonalUp: WinPattern = {
  id: 'diagonal_up',
  name: 'Diagonal (Bottom-Left to Top-Right)',
  nameEs: 'Diagonal (Abajo-Izquierda a Arriba-Derecha)',
  cells: [20, 16, 12, 8, 4],
};

// --------------- Special patterns ---------------

const fourCorners: WinPattern = {
  id: 'four_corners',
  name: 'Four Corners',
  nameEs: 'Cuatro Esquinas',
  cells: [0, 4, 20, 24],
};

const blackout: WinPattern = {
  id: 'blackout',
  name: 'Blackout',
  nameEs: 'Carton Lleno',
  cells: [
    0, 1, 2, 3, 4,
    5, 6, 7, 8, 9,
    10, 11, 12, 13, 14,
    15, 16, 17, 18, 19,
    20, 21, 22, 23, 24,
  ],
};

const xPattern: WinPattern = {
  id: 'x_pattern',
  name: 'X Pattern',
  nameEs: 'Patron X',
  cells: [0, 4, 6, 8, 12, 16, 18, 20, 24],
};

const tPattern: WinPattern = {
  id: 't_pattern',
  name: 'T Pattern',
  nameEs: 'Patron T',
  cells: [
    0, 1, 2, 3, 4,  // top row
    7, 12, 17, 22,   // middle column (excluding 2, already in top row)
  ],
};

const lPattern: WinPattern = {
  id: 'l_pattern',
  name: 'L Pattern',
  nameEs: 'Patron L',
  cells: [
    0, 5, 10, 15, 20, // left column
    21, 22, 23, 24,    // bottom row (excluding 20, already in left column)
  ],
};

const cross: WinPattern = {
  id: 'cross',
  name: 'Cross (Plus)',
  nameEs: 'Cruz',
  cells: [
    2, 7, 12, 17, 22,       // middle column
    10, 11, 13, 14,          // middle row (excluding 12, already in middle column)
  ],
};

const diamond: WinPattern = {
  id: 'diamond',
  name: 'Diamond',
  nameEs: 'Diamante',
  cells: [2, 6, 8, 10, 14, 12, 16, 18, 22],
};

const pictureFrame: WinPattern = {
  id: 'picture_frame',
  name: 'Picture Frame',
  nameEs: 'Marco',
  cells: [
    0, 1, 2, 3, 4,     // top row
    5, 9,               // row 1 borders
    10, 14,             // row 2 borders
    15, 19,             // row 3 borders
    20, 21, 22, 23, 24, // bottom row
  ],
};

// --------------- Exports ---------------

/** All built-in 75-ball win patterns. */
export const WIN_PATTERNS: readonly WinPattern[] = [
  topRow,
  secondRow,
  middleRow,
  fourthRow,
  bottomRow,
  colB,
  colI,
  colN,
  colG,
  colO,
  diagonalDown,
  diagonalUp,
  fourCorners,
  blackout,
  xPattern,
  tPattern,
  lPattern,
  cross,
  diamond,
  pictureFrame,
] as const;

/** Lookup map: pattern ID -> WinPattern. */
export const WIN_PATTERNS_MAP: ReadonlyMap<string, WinPattern> = new Map(
  WIN_PATTERNS.map((p) => [p.id, p]),
);
