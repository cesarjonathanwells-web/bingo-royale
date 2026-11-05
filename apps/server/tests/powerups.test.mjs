import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

// Exercise the actual TypeScript game modules without a build, network, or a
// listening server. Only external infrastructure is replaced: Redis is disabled
// so the real room store uses memory, and completed-game persistence is a no-op.
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'bingo-powerups-'));
await writeFile(path.join(temporary, 'package.json'), '{"type":"module"}');
const compiled = new Map();
async function loadSource(relative) {
  const original = path.join(repository, relative);
  if (compiled.has(original)) return compiled.get(original);
  const destination = path.join(temporary, relative.replace(/\.ts$/, '.js'));
  compiled.set(original, destination);
  await mkdir(path.dirname(destination), { recursive: true });
  if (relative === 'apps/server/src/redis/index.ts') {
    await writeFile(destination, 'export const getRedis = () => null;');
    return destination;
  }
  if (relative === 'apps/server/src/services/game-persistence.ts') {
    await writeFile(destination, 'export async function persistGameResult() {}');
    return destination;
  }
  let javascript = ts.transpileModule(await readFile(original, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const imports = [...javascript.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)];
  for (const match of imports) {
    const specifier = match[1];
    let resolved;
    if (specifier === '@bingo/shared') {
      resolved = pathToFileURL(await loadSource('packages/shared/src/index.ts')).href;
    } else if (specifier.startsWith('.')) {
      const source = path.resolve(path.dirname(original), specifier).replace(/\.js$/, '.ts');
      resolved = pathToFileURL(await loadSource(path.relative(repository, source))).href;
    } else if (specifier.startsWith('node:') || builtinModules.includes(specifier)) {
      continue;
    } else {
      resolved = pathToFileURL(createRequire(original).resolve(specifier)).href;
    }
    javascript = javascript.replaceAll(`'${specifier}'`, JSON.stringify(resolved))
      .replaceAll(`"${specifier}"`, JSON.stringify(resolved));
  }
  await writeFile(destination, javascript);
  return destination;
}
const importSource = async relative => import(pathToFileURL(await loadSource(relative)).href);
const roomStore = await importSource('apps/server/src/redis/room-store.ts');
const { registerGameHandlers } = await importSource('apps/server/src/socket/handlers/game.ts');
const { CallerManager, callNextNumber } = await importSource('apps/server/src/services/caller.ts');
const powerupService = await importSource('apps/server/src/services/powerups.ts');
const { withRoomLock } = await importSource('apps/server/src/services/room-lock.ts');
const { validateBingo75, validateBingo90, isPatternExpired75, isStageExpired90 } =
  await importSource('apps/server/src/services/win-validator.ts');
const { POWER_UPS, COLUMN_RANGES, COLUMN_RANGES_90 } = await importSource('packages/shared/src/index.ts');

let serial = 0;
const rooms = [];
afterEach(async () => {
  for (const code of rooms.splice(0)) {
    CallerManager.stopCalling(code);
    await roomStore.deleteRoom(code);
  }
});
after(async () => { await rm(temporary, { recursive: true, force: true }); });

function card75(id = 'card75') {
  const grid = Array.from({ length: 5 }, (_, col) =>
    Array.from({ length: 5 }, (_, row) => col * 15 + row + 1));
  grid[2][2] = null;
  return { id, grid };
}
function card90(id = 'card90') {
  return { id, grid: [[1, 2, 0], [10, 0, 12], [0, 20, 22], [30, 0, 32],
    [0, 40, 0], [50, 0, 52], [0, 60, 0], [0, 0, 70], [80, 82, 0]] };
}
const numberAt = (card, cell) => card.grid[cell % card.grid.length]?.[Math.floor(cell / card.grid.length)];
const numberedCells = card => Array.from({ length: card.grid.length * card.grid[0].length }, (_, cell) => cell)
  .filter(cell => typeof numberAt(card, cell) === 'number' && numberAt(card, cell) > 0);

async function fixture({ variant = '75', called = [], count = 1, opponent = true, spectator = false } = {}) {
  const code = `PU${String(++serial).padStart(4, '0')}`;
  rooms.push(code);
  const eventLog = [];
  const makeSocket = (id, name) => ({
    id: `socket-${id}`, data: { user: { id, name }, roomCode: code },
    handlers: new Map(), events: [],
    on(event, handler) { this.handlers.set(event, handler); },
    emit(event, data) { this.events.push({ event, data: structuredClone(data) }); },
  });
  const actor = makeSocket('actor', 'Alice');
  const other = makeSocket('other', 'Bob');
  const sockets = opponent ? [actor, other] : [actor];
  const io = {
    in() { return { fetchSockets: async () => sockets }; },
    to(target) {
      return { emit(event, data) {
        eventLog.push({ target, event, data: structuredClone(data) });
        for (const socket of sockets) {
          if (target === code || target === socket.id) socket.emit(event, data);
        }
      } };
    },
  };
  const players = sockets.map((socket, index) => ({ id: socket.data.user.id,
    name: socket.data.user.name, isHost: index === 0, connected: true,
    isSpectator: index === 0 && spectator }));
  await roomStore.createRoom({ code, hostId: 'actor', variant, state: 'in_progress',
    speed: 5000, patterns: variant === '75' ? ['top_row'] : ['one_line'],
    customPatterns: [], playerLimit: 50, players, createdAt: Date.now() });
  const makeCard = variant === '75' ? card75 : card90;
  for (const socket of sockets) {
    const id = socket.data.user.id;
    if (!(spectator && id === 'actor')) {
      await roomStore.setCard(code, id, Array.from({ length: count }, (_, i) => makeCard(`${id}-${i}`)));
      await roomStore.setDabs(code, id, Array.from({ length: count }, () => variant === '75' ? [12] : []));
    }
    await roomStore.setPowerUps(code, id, POWER_UPS.map(({ id }) => ({ id, used: false })));
    registerGameHandlers(socket, io);
  }
  await roomStore.setCallerState(code,
    Array.from({ length: Number(variant) }, (_, i) => i + 1).filter(n => !called.includes(n)), called, false);
  return { code, io, actor, other, eventLog, variant };
}
async function act(socket, event, data) {
  let reply;
  await socket.handlers.get(event)(data, result => { reply = result; });
  return reply;
}
const use = (f, powerupId, options = {}, socket = f.actor) =>
  act(socket, 'game:use_powerup', { powerupId, ...options });
const snapshot = (f, id = 'actor') => powerupService.getPowerUpSnapshot(f.code, id);
const isUsed = async (f, id, player = 'actor') =>
  (await roomStore.getPowerUps(f.code, player)).find(p => p.id === id).used;
const tick = f => callNextNumber(f.code, f.variant, f.io);
const activeBlocks = state => state.effects.blockedCells.filter(cell => cell.expiresAtCall >= state.calledCount);
const shieldActive = state => state.effects.shieldUntilCall > 0 && state.effects.shieldUntilCall >= state.calledCount;

test('invalid targets, blank/free cells, and nonplayers never spend a power-up', async () => {
  const f = await fixture({ count: 2 });
  for (const options of [{}, { cardIndex: 2, targetCellIndex: 0 },
    { cardIndex: 0.5, targetCellIndex: 0 }, { cardIndex: 0, targetCellIndex: 25 },
    { cardIndex: 0, targetCellIndex: -1 }, { cardIndex: 0, targetCellIndex: 12 }]) {
    assert.equal((await use(f, 'wild_square', options)).success, false);
    assert.equal(await isUsed(f, 'wild_square'), false);
  }
  const ninety = await fixture({ variant: '90' });
  assert.equal((await use(ninety, 'wild_square', { cardIndex: 0, targetCellIndex: 2 })).success, false);
  assert.equal(await isUsed(ninety, 'wild_square'), false);
  const watcher = await fixture({ spectator: true });
  assert.equal((await use(watcher, 'number_peek')).success, false);
  assert.equal(await isUsed(watcher, 'number_peek'), false);
  const solo = await fixture({ opponent: false });
  for (const id of ['scramble', 'ink_blot']) {
    assert.equal((await use(solo, id)).success, false);
    assert.equal(await isUsed(solo, id), false);
  }
});

test('number peek is private, and concurrent uses consume a power-up once', async () => {
  const f = await fixture();
  const results = await Promise.all([use(f, 'number_peek'), use(f, 'number_peek')]);
  assert.equal(results.filter(r => r.success).length, 1);
  const peeks = f.actor.events.filter(e => e.event === 'game:number_peek');
  assert.equal(peeks.length, 1);
  assert.deepEqual(peeks[0].data.numbers, [1, 2, 3]);
  assert.equal(f.other.events.some(e => e.event === 'game:number_peek'), false);
  assert.equal(await isUsed(f, 'number_peek'), true);
  const wild = await fixture();
  const mutations = await Promise.all([use(wild, 'wild_square', { targetCellIndex: 0 }),
    use(wild, 'wild_square', { targetCellIndex: 1 })]);
  assert.equal(mutations.filter(r => r.success).length, 1);
  assert.equal((await snapshot(wild)).effects.wildCells.length, 1);
  assert.equal((await roomStore.getDabs(wild.code, 'actor'))[0].length, 2);
});

test('paused, completed, and exhausted games do not spend unusable effects', async () => {
  const paused = await fixture();
  await roomStore.setCallerState(paused.code, [1, 2, 3], [], true);
  assert.equal((await use(paused, 'wild_square', { targetCellIndex: 0 })).success, false);
  assert.equal(await isUsed(paused, 'wild_square'), false);
  await roomStore.updateRoom(paused.code, { state: 'finished' });
  assert.equal((await use(paused, 'number_peek')).success, false);
  assert.equal(await isUsed(paused, 'number_peek'), false);
  const exhausted = await fixture();
  await roomStore.setCallerState(exhausted.code, [], [1], false);
  for (const id of ['number_peek', 'callers_choice', 'double_daub', 'shield']) {
    assert.equal((await use(exhausted, id)).success, false);
    assert.equal(await isUsed(exhausted, id), false);
  }
  const uncalled = await fixture();
  assert.equal((await use(uncalled, 'turbo_stamp')).success, false);
  assert.equal(await isUsed(uncalled, 'turbo_stamp'), false);
});

test('wild square marks the selected card and permits a fresh 75-ball win, then expires normally', async () => {
  const f = await fixture({ called: [1, 16, 31, 46], count: 2 });
  await roomStore.setDabs(f.code, 'actor', [[12], [12, 0, 1, 2, 3]]);
  assert.equal((await use(f, 'wild_square', { cardIndex: 1, targetCellIndex: 4 })).success, true);
  assert.deepEqual((await roomStore.getDabs(f.code, 'actor'))[0], [12]);
  const dabs = (await roomStore.getDabs(f.code, 'actor'))[1];
  assert.ok(dabs.includes(4));
  assert.equal((await validateBingo75(f.code, 'actor', dabs, 1)).valid, true);
  assert.equal(await isPatternExpired75(f.code, 'actor', 'top_row', 1), false);
  await tick(f);
  assert.equal(await isPatternExpired75(f.code, 'actor', 'top_row', 1), true);
  assert.equal((await validateBingo75(f.code, 'actor', [0, 1, 2, 3, 4], 0)).valid, false,
    'a grant on card 2 cannot authorize an uncalled mark on card 1');
});

test('90-ball wild square is validated and can be claimed as a genuine line win', async () => {
  const f = await fixture({ variant: '90', called: [1, 10, 30, 50] });
  await roomStore.setDabs(f.code, 'actor', [[0, 1, 3, 5]]);
  assert.equal((await use(f, 'wild_square', { cardIndex: 0, targetCellIndex: 8 })).success, true);
  const dabs = (await roomStore.getDabs(f.code, 'actor'))[0];
  assert.equal((await validateBingo90(f.code, 'actor', dabs, 'one_line', 0)).valid, true);
  assert.equal(await isStageExpired90(f.code, 'actor', 'one_line', 0), false);
  assert.equal((await act(f.actor, 'game:claim_bingo', { stage: 'one_line', cardIndex: 0,
    markedCells: dabs })).valid, true);
  assert.equal((await roomStore.getRoom(f.code)).state, 'finished');
});

test('an earlier expired pattern does not hide a pattern newly completed by a wild square', async () => {
  const called = [1, 16, 31, 46, 61, 2, 17, 32, 47];
  const f = await fixture({ called });
  await roomStore.updateRoom(f.code, { patterns: ['top_row', 'second_row'] });
  await roomStore.setDabs(f.code, 'actor', [[12, 0, 1, 2, 3, 4, 5, 6, 7, 8]]);
  assert.equal((await use(f, 'wild_square', { targetCellIndex: 9 })).success, true);
  const dabs = (await roomStore.getDabs(f.code, 'actor'))[0];
  const result = await validateBingo75(f.code, 'actor', dabs, 0);
  assert.equal(result.pattern, 'second_row');
  assert.equal(result.expired, false);
  assert.equal((await act(f.actor, 'game:claim_bingo', { cardIndex: 0, markedCells: dabs })).valid, true);
});

test('an expired first card does not hide a fresh power-up win on a later card in either variant', async () => {
  for (const variant of ['75', '90']) {
    const called = variant === '75' ? [1, 16, 31, 46, 61, 2] : [1, 10, 30, 50, 80, 2];
    const f = await fixture({ variant, called, count: 2 });
    const cards = await roomStore.getCard(f.code, 'actor');
    const target = variant === '75' ? 4 : 8;
    cards[1].grid[variant === '75' ? 4 : 8][0] = variant === '75' ? 75 : 81;
    await roomStore.setCard(f.code, 'actor', cards);
    const row = variant === '75' ? [0, 1, 2, 3, 4] : [0, 1, 3, 5, 8];
    const free = variant === '75' ? [12] : [];
    await roomStore.setDabs(f.code, 'actor', [[...free, ...row], [...free, ...row.filter(cell => cell !== target)]]);
    assert.equal((await use(f, 'wild_square', { cardIndex: 1, targetCellIndex: target })).success, true);
    const reply = await act(f.actor, 'game:claim_bingo', { cardIndex: 1, stage: variant === '90' ? 'one_line' : undefined,
      markedCells: (await roomStore.getDabs(f.code, 'actor'))[1] });
    assert.equal(reply.valid, true);
  }
});

test('invalid card and cell indices cannot authorize dabs or forged wins', async () => {
  const f = await fixture({ called: [1, 16, 31, 46, 61] });
  for (const cell of [-1, 25, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal((await validateBingo75(f.code, 'actor', [0, 1, 2, 3, 4, cell], 0)).valid, false);
    assert.equal((await act(f.actor, 'game:dab', { cardIndex: 0, cellIndex: cell })).success, false);
  }
  for (const index of [-1, 1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal((await validateBingo75(f.code, 'actor', [0, 1, 2, 3, 4], index)).valid, false);
    assert.equal((await act(f.actor, 'game:dab', { cardIndex: index, cellIndex: 0 })).success, false);
  }
  assert.deepEqual(await roomStore.getDabs(f.code, 'actor'), [[12]]);
  const ninety = await fixture({ variant: '90', called: [1, 10, 30, 50, 80] });
  for (const cell of [2, -1, 27, Number.NaN]) {
    assert.equal((await validateBingo90(ninety.code, 'actor', [0, 1, 3, 5, 8, cell], 'one_line', 0)).valid, false);
  }
});

test('turbo stamp applies all called matches to the selected card only', async () => {
  for (const variant of ['75', '90']) {
    const f = await fixture({ variant, count: 2, called: [1, 2, 10, 16, 31, 50] });
    assert.equal((await use(f, 'turbo_stamp', { cardIndex: 1 })).success, true);
    const cards = await roomStore.getCard(f.code, 'actor');
    const expected = numberedCells(cards[1]).filter(cell => [1, 2, 10, 16, 31, 50].includes(numberAt(cards[1], cell)));
    if (variant === '75') expected.push(12);
    const dabs = await roomStore.getDabs(f.code, 'actor');
    assert.deepEqual([...dabs[1]].sort((a, b) => a - b), expected.sort((a, b) => a - b));
    assert.deepEqual(dabs[0], variant === '75' ? [12] : []);
    assert.deepEqual((await snapshot(f)).dabs, dabs);
  }
});

test('double daub grants two numbered cells on the next call of the selected card', async () => {
  for (const variant of ['75', '90']) {
    const f = await fixture({ variant, count: 2 });
    assert.equal((await use(f, 'double_daub', { cardIndex: 1 })).success, true);
    const before = await roomStore.getDabs(f.code, 'actor');
    await tick(f);
    const after = await roomStore.getDabs(f.code, 'actor');
    const added = after[1].filter(cell => !before[1].includes(cell));
    assert.equal(added.length, 2);
    assert.ok(added.includes(0), 'the newly called matching number is marked');
    assert.deepEqual(after[0], before[0]);
    const state = await snapshot(f);
    assert.equal(state.effects.doubleDaub, undefined);
    for (const cell of added) assert.ok(numberAt(state.cards[1], cell) > 0);
    await tick(f);
    assert.deepEqual((await roomStore.getDabs(f.code, 'actor'))[1], after[1], 'the delayed effect fires only once');
  }
});

test('caller choice offers without spending, handles stale choices, and draws the selected number once', async () => {
  const f = await fixture();
  const offered = await use(f, 'callers_choice');
  assert.equal(offered.success, true);
  assert.deepEqual(offered.choices, [1, 2, 3]);
  assert.equal(await isUsed(f, 'callers_choice'), false);
  assert.equal((await use(f, 'callers_choice', { selectedNumber: 40 })).success, false);
  assert.equal(await isUsed(f, 'callers_choice'), false);
  await tick(f);
  const stale = await use(f, 'callers_choice', { selectedNumber: 1 });
  assert.equal(stale.success, false);
  assert.deepEqual(stale.choices, [2, 3, 4]);
  assert.equal(await isUsed(f, 'callers_choice'), false);
  assert.equal((await use(f, 'callers_choice', { selectedNumber: 4 })).success, true);
  assert.equal(await isUsed(f, 'callers_choice'), true);
  await tick(f);
  const caller = await roomStore.getCallerState(f.code);
  assert.deepEqual(caller.called, [1, 4]);
  assert.equal(caller.pool.includes(4), false);
  assert.equal(new Set([...caller.pool, ...caller.called]).size, 75);
  assert.equal(caller.pool.length + caller.called.length, 75);
});

test('a caller draw queued with a choice cannot overwrite the selected pool or duplicate a number', async () => {
  const f = await fixture();
  const [choice] = await Promise.all([use(f, 'callers_choice', { selectedNumber: 3 }), tick(f)]);
  assert.equal(choice.success, true);
  const caller = await roomStore.getCallerState(f.code);
  assert.deepEqual(caller.called, [3]);
  assert.equal(caller.pool.includes(3), false);
  assert.equal(new Set([...caller.pool, ...caller.called]).size, 75);
  assert.equal(caller.pool.length + caller.called.length, 75);
});

test('a queued request from a room that was left cannot mutate a newly joined room', async () => {
  const original = await fixture();
  const next = await fixture();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const holding = withRoomLock(original.code, () => gate);
  const pending = use(original, 'wild_square', { targetCellIndex: 0 });
  original.actor.data.roomCode = next.code;
  release();
  await holding;
  assert.equal((await pending).success, false);
  assert.equal(await isUsed(original, 'wild_square'), false);
  assert.equal(await isUsed(next, 'wild_square'), false);
  assert.deepEqual((await snapshot(next)).effects.wildCells, []);
});

test('shield blocks both attacks through the next two calls and then expires', async () => {
  const f = await fixture();
  assert.equal((await use(f, 'shield', {}, f.other)).success, true);
  const before = await roomStore.getCard(f.code, 'other');
  assert.equal((await use(f, 'scramble')).success, true);
  assert.deepEqual(await roomStore.getCard(f.code, 'other'), before);
  assert.equal(activeBlocks(await snapshot(f, 'other')).length, 0);
  await tick(f);
  await tick(f);
  assert.equal((await use(f, 'ink_blot')).success, true);
  assert.equal(activeBlocks(await snapshot(f, 'other')).length, 0);
  assert.equal(shieldActive(await snapshot(f, 'other')), true);
  await tick(f);
  assert.equal(shieldActive(await snapshot(f, 'other')), false);
  await roomStore.setPowerUps(f.code, 'actor', [{ id: 'ink_blot', used: false }]);
  assert.equal((await use(f, 'ink_blot')).success, true);
  assert.equal((await snapshot(f, 'other')).effects.blockedCells.length, 1);
});

test('scramble changes a real opponent card and preserves marked/called cells and variant structure', async () => {
  for (const variant of ['75', '90']) {
    const f = await fixture({ variant, called: [1], count: 1 });
    await roomStore.setDabs(f.code, 'other', [variant === '75' ? [0, 12] : [0]]);
    await use(f, 'wild_square', { targetCellIndex: 5 }, f.other);
    await use(f, 'ink_blot');
    const blocked = (await snapshot(f, 'other')).effects.blockedCells[0].cellIndex;
    const original = structuredClone((await roomStore.getCard(f.code, 'other'))[0]);
    assert.equal((await use(f, 'scramble')).success, true);
    const changed = (await roomStore.getCard(f.code, 'other'))[0];
    assert.notDeepEqual(changed.grid, original.grid);
    assert.equal(changed.grid[0][0], original.grid[0][0]);
    assert.equal(numberAt(changed, 5), numberAt(original, 5), 'wild marks stay attached to their original numbers');
    assert.equal(numberAt(changed, blocked), numberAt(original, blocked), 'blocked cells are not moved underneath the player');
    const allNumbers = numberedCells(changed).map(cell => numberAt(changed, cell));
    assert.equal(new Set(allNumbers).size, allNumbers.length);
    const ranges = variant === '75' ? COLUMN_RANGES : COLUMN_RANGES_90;
    for (let col = 0; col < changed.grid.length; col++) {
      const values = changed.grid[col].filter(n => n > 0);
      assert.ok(values.every(n => n >= ranges[col].min && n <= ranges[col].max));
      if (variant === '90') assert.deepEqual(values, [...values].sort((a, b) => a - b));
    }
    if (variant === '75') assert.equal(changed.grid[2][2], null);
    else for (let row = 0; row < 3; row++) {
      assert.equal(changed.grid.filter(col => col[row] > 0).length, 5);
      for (let col = 0; col < 9; col++) assert.equal(changed.grid[col][row] === 0, original.grid[col][row] === 0);
    }
    const privateStates = f.other.events.filter(e => e.event === 'game:powerup_state');
    assert.ok(privateStates.some(e => JSON.stringify(e.data.cards[0].grid) === JSON.stringify(changed.grid)));
    assert.equal(f.eventLog.some(e => e.target === f.code && e.event === 'game:powerup_state'), false,
      'opponent cards are never broadcast to the room');
  }
});

test('ink blot blocks server dabs and forged claims, then the cell becomes usable after expiry', async () => {
  const f = await fixture();
  assert.equal((await use(f, 'ink_blot')).success, true);
  const blot = (await snapshot(f, 'other')).effects.blockedCells[0];
  assert.ok(blot);
  const targetCard = (await roomStore.getCard(f.code, 'other'))[blot.cardIndex];
  const number = numberAt(targetCard, blot.cellIndex);
  assert.ok(number > 0);
  await roomStore.setCallerState(f.code, [74, 75, 73].filter(n => n !== number), [number], false);
  await act(f.other, 'game:dab', { cardIndex: blot.cardIndex, cellIndex: blot.cellIndex });
  assert.equal((await roomStore.getDabs(f.code, 'other'))[blot.cardIndex].includes(blot.cellIndex), false);
  const customPattern = { id: 'blocked_target', name: 'Target', nameEs: 'Objetivo', cells: [blot.cellIndex] };
  await roomStore.updateRoom(f.code, { patterns: ['blocked_target'], customPatterns: [customPattern] });
  assert.equal((await validateBingo75(f.code, 'other', [blot.cellIndex], blot.cardIndex)).valid, false);
  await tick(f);
  assert.equal(activeBlocks(await snapshot(f, 'other')).length, 1);
  await tick(f);
  assert.equal(activeBlocks(await snapshot(f, 'other')).length, 0);
  assert.equal(await isPatternExpired75(f.code, 'other', 'blocked_target', blot.cardIndex), false,
    'unblocking creates a new claim window');
  await act(f.other, 'game:dab', { cardIndex: blot.cardIndex, cellIndex: blot.cellIndex });
  assert.equal((await roomStore.getDabs(f.code, 'other'))[blot.cardIndex].includes(blot.cellIndex), true);
  await tick(f);
  assert.equal(await isPatternExpired75(f.code, 'other', 'blocked_target', blot.cardIndex), true);
});

test('90-ball ink blot rejects a forged complete line while its blocked cell is active', async () => {
  const card = card90();
  const called = numberedCells(card).map(cell => numberAt(card, cell));
  const f = await fixture({ variant: '90', called });
  assert.equal((await use(f, 'ink_blot')).success, true);
  const blot = activeBlocks(await snapshot(f, 'other'))[0];
  const row = Math.floor(blot.cellIndex / 9);
  const forged = numberedCells(card).filter(cell => Math.floor(cell / 9) === row);
  assert.equal((await validateBingo90(f.code, 'other', forged, 'one_line', 0)).valid, false);
  await act(f.other, 'game:dab', { cardIndex: 0, cellIndex: blot.cellIndex });
  assert.equal((await roomStore.getDabs(f.code, 'other'))[0].includes(blot.cellIndex), false);
  await tick(f);
  await tick(f);
  assert.equal(activeBlocks(await snapshot(f, 'other')).length, 1);
  await tick(f);
  assert.equal(activeBlocks(await snapshot(f, 'other')).length, 0);
  await act(f.other, 'game:dab', { cardIndex: 0, cellIndex: blot.cellIndex });
  assert.equal((await roomStore.getDabs(f.code, 'other'))[0].includes(blot.cellIndex), true);
});

test('attacks with no eligible opponent cells leave inventory intact', async () => {
  const f = await fixture();
  const card = (await roomStore.getCard(f.code, 'other'))[0];
  await roomStore.setDabs(f.code, 'other', [[...numberedCells(card), 12]]);
  for (const id of ['scramble', 'ink_blot']) {
    assert.equal((await use(f, id)).success, false);
    assert.equal(await isUsed(f, id), false);
  }
});

test('new rounds clear delayed and persistent power-up effects', async () => {
  const f = await fixture();
  await use(f, 'shield');
  await use(f, 'double_daub', { cardIndex: 0 });
  await use(f, 'wild_square', { cardIndex: 0, targetCellIndex: 0 });
  await roomStore.updateRoom(f.code, { state: 'finished' });
  assert.equal((await act(f.actor, 'game:new_round')).success, true);
  const state = await snapshot(f);
  assert.deepEqual(state.powerups, []);
  assert.deepEqual(state.effects.wildCells, []);
  assert.deepEqual(state.effects.blockedCells, []);
  assert.equal(state.effects.shieldUntilCall, 0);
  assert.equal(state.effects.doubleDaub, undefined);
});
