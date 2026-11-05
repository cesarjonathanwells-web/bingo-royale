import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
// Resolve the real shared definitions rather than copying the win-pattern data.
const sharedUrl = moduleUrl(['constants.ts', 'patterns.ts'].map(file =>
  compile(readFileSync(new URL(`../../../packages/shared/src/${file}`, import.meta.url), 'utf8')),
).join('\n'));
const { WIN_PATTERNS } = await import(sharedUrl);
const source = readFileSync(new URL('../src/lib/board-progress.ts', import.meta.url), 'utf8');
const compiled = compile(source).replaceAll('"@bingo/shared"', JSON.stringify(sharedUrl));
const { getCardProgress } = await import(moduleUrl(compiled));

const card75 = () => ({ id: '75', grid: Array.from({ length: 5 }, (_, col) =>
  Array.from({ length: 5 }, (_, row) => col === 2 && row === 2 ? null : col * 15 + row + 1),
) });
const card90 = () => ({ id: '90', grid: [
  [1, 2, 0], [10, 0, 11], [20, 21, 22], [0, 30, 31], [40, 0, 41],
  [0, 50, 0], [60, 0, 0], [0, 70, 0], [0, 0, 80],
] });
const rows90 = [[0, 1, 2, 4, 6], [9, 11, 12, 14, 16], [19, 20, 21, 22, 26]];

test('75-ball FREE center contributes automatically and only actual marks count', () => {
  const marks = new Set([10, 11, 13, -1, 25, 1.5]);
  const progress = getCardProgress(card75(), marks, 'middle_row');
  assert.equal(progress.remaining, 1);
  assert.equal(progress.markedCount, 4);
  assert.deepEqual(progress.nearWinCells, new Set([10, 11, 12, 13, 14]));
  assert.deepEqual(progress.missingCells, new Set([14]));
  assert.equal(marks.has(12), false, 'input marks are not mutated');
});

test('rows, columns, diagonals, corners and every built-in 75-ball pattern resolve correctly', () => {
  for (const pattern of WIN_PATTERNS) {
    const marks = new Set(pattern.cells.filter(index => index !== 12));
    const complete = getCardProgress(card75(), marks, pattern.id);
    assert.equal(complete.completed, true, pattern.id);
    assert.equal(complete.remaining, 0, pattern.id);
    assert.deepEqual(complete.winningCells, new Set(pattern.cells), pattern.id);
    const missing = [...marks][0];
    marks.delete(missing);
    const near = getCardProgress(card75(), marks, pattern.id);
    assert.equal(near.completed, false, pattern.id);
    assert.equal(near.remaining, 1, pattern.id);
    assert.deepEqual(near.missingCells, new Set([missing]), pattern.id);
  }
});

test('best enabled 75-ball pattern wins while ties follow configured order', () => {
  const marks = new Set([0, 4, 20, 1, 2, 3]);
  const progress = getCardProgress(card75(), marks, ['four_corners', 'top_row']);
  assert.equal(progress.patternId, 'top_row');
  assert.equal(progress.completed, true);
  assert.deepEqual(progress.winningCells, new Set([0, 1, 2, 3, 4]));
  const tie = getCardProgress(card75(), new Set([0, 4, 20, 1, 2]), ['four_corners', 'top_row']);
  assert.equal(tie.remaining, 1);
  assert.equal(tie.patternId, 'four_corners');
});

test('custom patterns work, but unknown or malformed patterns cannot announce completion', () => {
  const custom = [{ id: 'custom_triangle', name: 'Triangle', nameEs: 'Triángulo', cells: [0, 6, 12] }];
  assert.equal(getCardProgress(card75(), new Set([0, 6]), 'custom_triangle', custom).completed, true);
  for (const pattern of ['missing', 'one_line']) {
    const progress = getCardProgress(card75(), new Set(Array.from({ length: 25 }, (_, i) => i)), pattern);
    assert.equal(progress.completed, false);
    assert.equal(progress.patternId, null);
    assert.equal(progress.remaining, Infinity);
  }
  for (const cells of [[], [-1, 0, 1], [0, 1, 25], [0, 1, 1.5]]) {
    const progress = getCardProgress(card75(), new Set([0, 1]), 'custom_bad', [{ id: 'custom_bad', name: '', nameEs: '', cells }]);
    assert.equal(progress.completed, false);
  }
});

test('empty 75-ball configuration uses the server built-in pattern fallback', () => {
  const progress = getCardProgress(card75(), new Set([0, 1, 2, 3, 4]), []);
  assert.equal(progress.completed, true);
  assert.equal(progress.patternId, 'top_row');
});

test('90-ball line progress follows row-major numbers and ignores every blank', () => {
  const card = card90();
  const marks = new Set(rows90[1].slice(0, 4));
  marks.add(10); // A blank in the selected row must not replace the fifth number.
  const progress = getCardProgress(card, marks, 'one_line');
  assert.equal(progress.remaining, 1);
  assert.equal(progress.markedCount, 4);
  assert.equal(progress.totalCells, 15);
  assert.deepEqual(progress.nearWinCells, new Set(rows90[1]));
  assert.deepEqual(progress.missingCells, new Set([16]));
  marks.add(16);
  const complete = getCardProgress(card, marks, 'one_line');
  assert.equal(complete.completed, true);
  assert.deepEqual(complete.winningCells, new Set(rows90[1]));
});

test('90-ball two-line progress chooses the closest pair, including nonadjacent rows', () => {
  const marks = new Set([...rows90[0], ...rows90[2].slice(0, 4)]);
  const progress = getCardProgress(card90(), marks, 'two_lines');
  assert.equal(progress.remaining, 1);
  assert.deepEqual(progress.nearWinCells, new Set([...rows90[0], ...rows90[2]]));
  marks.add(rows90[2][4]);
  assert.equal(getCardProgress(card90(), marks, 'two_lines').completed, true);
});

test('90-ball full house needs all 15 numbered cells and chooses the highest completed stage', () => {
  const marks = new Set(rows90.flat());
  marks.delete(26);
  const near = getCardProgress(card90(), marks, 'full_house');
  assert.equal(near.remaining, 1);
  assert.equal(near.completed, false);
  assert.deepEqual(near.missingCells, new Set([26]));
  marks.add(26);
  const complete = getCardProgress(card90(), marks, ['one_line', 'full_house', 'two_lines']);
  assert.equal(complete.completed, true);
  assert.equal(complete.patternId, 'full_house');
  assert.equal(complete.winningCells.size, 15);
});

test('legacy 90-ball configuration mirrors the server stage fallback and respects enabled stages', () => {
  const marks = new Set([...rows90[0], ...rows90[1]]);
  assert.equal(getCardProgress(card90(), marks, ['top_row']).patternId, 'two_lines');
  const restricted = getCardProgress(card90(), marks, ['full_house']);
  assert.equal(restricted.completed, false);
  assert.equal(restricted.remaining, 5);
  assert.equal(restricted.nearWinCells.size, 0);
});

test('empty and malformed cards never form a completed line', () => {
  const blanks = { id: 'blank', grid: Array.from({ length: 9 }, () => [0, 0, 0]) };
  assert.equal(getCardProgress(blanks, new Set(), 'one_line').completed, false);
  const broken75 = card75();
  broken75.grid[0][0] = null;
  assert.equal(getCardProgress(broken75, new Set([0, 1, 2, 3, 4]), 'top_row').completed, false);
  assert.equal(getCardProgress({ id: 'bad', grid: [] }, new Set(), []).completed, false);
  assert.equal(getCardProgress({ id: 'bad', grid: null }, new Set(), []).remaining, Infinity);
  assert.equal(getCardProgress({ id: 'bad', grid: [null, [], [], [], []] }, new Set(), []).completed, false);
  assert.equal(getCardProgress(null, new Set(), []).remaining, Infinity);
});

test('an expired 75-ball completion cannot mask another fresh near-win', () => {
  const marks = new Set([0, 1, 2, 3, 4, 20]);
  const previousEligibility = new Set([0, 1, 2, 3, 4]);
  const progress = getCardProgress(card75(), marks, ['top_row', 'four_corners'], [], previousEligibility);
  assert.equal(progress.completed, false);
  assert.equal(progress.patternId, 'four_corners');
  assert.equal(progress.remaining, 1);
  assert.equal(progress.winningCells.size, 0);
  assert.deepEqual(progress.missingCells, new Set([24]));
});

test('expiration counts FREE automatically but retains a completion created by the current call', () => {
  const marks = new Set([10, 11, 13, 14]);
  const expired = getCardProgress(card75(), marks, 'middle_row', [], new Set(marks));
  assert.equal(expired.remaining, Infinity);
  assert.equal(expired.completed, false);
  const fresh = getCardProgress(card75(), marks, 'middle_row', [], new Set([10, 11, 13]));
  assert.equal(fresh.remaining, 0);
  assert.equal(fresh.completed, true);
  assert.equal(fresh.patternId, 'middle_row');
});

test('an expired 90-ball one-line stage cannot mask the next two-line near-win', () => {
  const marks = new Set([...rows90[0], ...rows90[2].slice(0, 4)]);
  const progress = getCardProgress(card90(), marks, ['one_line', 'two_lines', 'full_house'], [], new Set(rows90[0]));
  assert.equal(progress.patternId, 'two_lines');
  assert.equal(progress.completed, false);
  assert.equal(progress.remaining, 1);
  assert.deepEqual(progress.missingCells, new Set([26]));
});

test('90-ball expiration excludes a whole stage, including other freshly completed rows', () => {
  const marks = new Set([...rows90[0], ...rows90[1]]);
  const expiredLine = getCardProgress(card90(), marks, ['one_line'], [], new Set(rows90[0]));
  assert.equal(expiredLine.remaining, Infinity);
  assert.equal(expiredLine.completed, false);
  const freshPair = getCardProgress(card90(), marks, ['one_line', 'two_lines'], [], new Set(rows90[0]));
  assert.equal(freshPair.patternId, 'two_lines');
  assert.equal(freshPair.completed, true);
});

test('all expired stages leave no claim feedback while omitted eligibility preserves shape previews', () => {
  const marks = new Set(rows90.flat());
  const expired = getCardProgress(card90(), marks, [], [], marks);
  assert.equal(expired.remaining, Infinity);
  assert.equal(expired.completed, false);
  assert.equal(expired.patternId, null);
  assert.equal(expired.winningCells.size, 0);
  assert.equal(expired.nearWinCells.size, 0);
  assert.equal(getCardProgress(card90(), marks, []).completed, true);
});
