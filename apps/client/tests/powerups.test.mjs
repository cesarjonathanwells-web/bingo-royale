import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const socketUrl = moduleUrl(`
  export const handlers = new Map();
  export const emitted = [];
  const socket = {
    connected: true,
    on(event, handler) { handlers.set(event, handler); },
    off(event) { handlers.delete(event); },
    emit(...args) { emitted.push(args); },
  };
  export const getSocket = () => socket;
`);
const source = readFileSync(new URL('../src/stores/room-store.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replaceAll('"zustand"', JSON.stringify(import.meta.resolve('zustand')))
  .replaceAll('"@bingo/shared"', JSON.stringify(moduleUrl('export const FREE_SPACE_INDEX = 12;')))
  .replaceAll('"@/socket"', JSON.stringify(socketUrl));
const { useRoomStore: store } = await import(moduleUrl(compiled));
const { handlers, emitted, getSocket } = await import(socketUrl);
const room = { code: 'POWERS', state: 'in_progress', variant: '75', patterns: ['top_row'], players: [] };
const gameState = { calledNumbers: [1], paused: false, startedAt: 1, winners: [] };
const card = id => ({ id, grid: Array.from({ length: 5 }, (_, col) => Array.from({ length: 5 }, (_, row) => col === 2 && row === 2 ? null : col * 15 + row + 1)) });
const effects = () => ({ wildCells: [], blockedCells: [], shieldUntilCall: 0 });
const snapshot = (overrides = {}) => ({ roomCode: room.code, cards: [card('one'), card('two')], dabs: [[], []], powerups: ['wild_square', 'callers_choice', 'turbo_stamp', 'double_daub'].map(id => ({ id, used: false })), effects: effects(), calledCount: 1, ...overrides });
function setup() {
  store.getState().reset();
  getSocket().connected = true;
  emitted.length = 0;
  store.getState().setupListeners();
  store.setState({ room, gameState, socketReady: true });
  handlers.get('game:powerup_state')(snapshot());
}
const requests = () => emitted.filter(([name]) => name === 'game:use_powerup');
const dabs = () => emitted.filter(([name]) => name === 'game:dab');
afterEach(() => store.getState().reset());

test('failed power-up use keeps inventory and sends selected card/cell without optimistic effects', () => {
  setup();
  store.getState().usePowerUp('wild_square', { cardIndex: 1, targetCellIndex: 4 });
  const [, payload, ack] = requests()[0];
  assert.deepEqual(payload, { powerupId: 'wild_square', cardIndex: 1, targetCellIndex: 4 });
  assert.equal(store.getState().pendingPowerUp, 'wild_square');
  assert.equal(store.getState().myPowerUps[0].used, false);
  assert.equal(store.getState().myDabs[1].has(4), false);
  ack({ success: false, errorCode: 'invalid_target' });
  assert.equal(store.getState().pendingPowerUp, null);
  assert.equal(store.getState().powerUpError, 'invalid_target');
  assert.equal(store.getState().myPowerUps[0].used, false);
});

test('authoritative snapshots replace scrambled cards and apply marks to the actual card', () => {
  setup();
  store.getState().setActiveCard(0);
  const changed = card('two');
  changed.grid[0][0] = 9;
  const next = snapshot({ cards: [card('one'), changed], dabs: [[], [3]], effects: { ...effects(), wildCells: [{ cardIndex: 1, cellIndex: 3, grantedAtCall: 1 }] } });
  next.powerups[0].used = true;
  handlers.get('game:powerup_state')(next);
  assert.equal(store.getState().myCards[1].grid[0][0], 9);
  assert.equal(store.getState().myDabs[0].has(3), false);
  assert.equal(store.getState().myDabs[1].has(3), true);
  assert.equal(store.getState().myDabs[1].has(12), true);
  assert.equal(store.getState().myPowerUps[0].used, true);
});

test('Caller\'s Choice previews and stale-choice retries consume nothing locally', () => {
  setup();
  store.getState().usePowerUp('callers_choice');
  requests()[0][2]({ success: true, choices: [2, 3, 4] });
  assert.deepEqual(store.getState().callerChoices, [2, 3, 4]);
  store.getState().usePowerUp('callers_choice', { selectedNumber: 2 });
  requests()[1][2]({ success: false, errorCode: 'stale_choice', choices: [3, 4, 5] });
  assert.deepEqual(store.getState().callerChoices, [3, 4, 5]);
  assert.equal(store.getState().myPowerUps.find(p => p.id === 'callers_choice').used, false);
  store.getState().usePowerUp('callers_choice', { selectedNumber: 5 });
  assert.equal(requests()[2][1].selectedNumber, 5);
  requests()[2][2]({ success: true });
  assert.deepEqual(store.getState().callerChoices, []);
});

test('ink blocks manual and automatic multi-card marks through expiry, then auto-daub catches up once', () => {
  setup();
  const ink = { ...effects(), blockedCells: [{ cardIndex: 1, cellIndex: 0, expiresAtCall: 3 }] };
  handlers.get('game:powerup_state')(snapshot({ effects: ink, calledCount: 3 }));
  store.getState().dabCell(0, 1);
  assert.equal(dabs().length, 0);
  store.getState().dabCell(0, 0);
  store.getState().dabCell(0, 0);
  assert.equal(dabs().length, 1);
  assert.equal(store.getState().myDabs[0].has(0), false, 'marks wait for server state');
  store.setState({ autoDaub: true });
  handlers.get('game:number_called')({ number: 1, calledNumbers: [1] });
  assert.equal(dabs().length, 1, 'pending ordinary mark is deduplicated and ink still blocks second card');
  handlers.get('game:powerup_state')(snapshot({ effects: ink, calledCount: 4, dabs: [[0], []] }));
  assert.equal(dabs().length, 2);
  assert.deepEqual(dabs()[1][1], { cellIndex: 0, cardIndex: 1 });
  handlers.get('game:powerup_state')(snapshot({ effects: ink, calledCount: 4, dabs: [[0], []] }));
  assert.equal(dabs().length, 2, 'repeated snapshots do not queue duplicate catchup marks');
  dabs()[1][2]({ success: false });
  handlers.get('game:powerup_state')(snapshot({ effects: ink, calledCount: 4, dabs: [[0], []] }));
  assert.equal(dabs().length, 3, 'rejected requests can be retried');
});

test('pause, spectators and disconnection prevent power-up requests', () => {
  setup();
  store.setState({ gameState: { ...gameState, paused: true } });
  store.getState().usePowerUp('wild_square', { targetCellIndex: 1 });
  assert.equal(requests().length, 0);
  store.setState({ gameState, myCards: [] });
  store.getState().usePowerUp('wild_square', { targetCellIndex: 1 });
  assert.equal(requests().length, 0);
  store.setState({ myCards: [card('one')] });
  getSocket().connected = false;
  store.getState().usePowerUp('wild_square', { targetCellIndex: 1 });
  assert.equal(requests().length, 0);
  assert.equal(store.getState().powerUpError, 'disconnected');
});

test('leaving or starting a new round cancels pending requests, effects and stale callbacks', () => {
  setup();
  store.getState().usePowerUp('callers_choice');
  const staleAck = requests()[0][2];
  handlers.get('game:number_peek')({ numbers: [2, 3] });
  store.getState().leaveRoom();
  staleAck({ success: true, choices: [2, 3] });
  handlers.get('game:powerup_state')(snapshot());
  assert.equal(store.getState().room, null);
  assert.deepEqual(store.getState().myCards, []);
  assert.deepEqual(store.getState().peekedNumbers, []);
  assert.deepEqual(store.getState().callerChoices, []);
  setup();
  store.getState().usePowerUp('callers_choice');
  const roundAck = requests()[0][2];
  handlers.get('room:state')({ ...room, state: 'lobby' });
  roundAck({ success: true, choices: [2, 3] });
  assert.equal(store.getState().pendingPowerUp, null);
  assert.deepEqual(store.getState().callerChoices, []);
  assert.deepEqual(store.getState().powerUpEffects, effects());
});

test('90-ball claims include the highest enabled completed stage across cards', () => {
  setup();
  const ticket = { id: '90', grid: [[1, 2, 3], [10, 11, 12], [20, 21, 22], [30, 31, 32], [40, 41, 42], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] };
  store.setState({ room: { ...room, variant: '90', patterns: ['one_line', 'two_lines'] }, myCards: [ticket, ticket], myDabs: [new Set(), new Set([0, 1, 2, 3, 4, 9, 10, 11, 12, 13])] });
  store.getState().claimBingo();
  assert.equal(emitted.at(-1)[1].stage, 'two_lines');
});

test('late snapshots from another room cannot replace current cards', () => {
  setup();
  handlers.get('game:powerup_state')(snapshot({ roomCode: 'OLDROM', cards: [card('wrong')], dabs: [[0]] }));
  assert.equal(store.getState().myCards[0].id, 'one');
  assert.equal(store.getState().myDabs[0].has(0), false);
});

test('legacy 90-ball rooms can claim a fresh full house even when one line was completable earlier', () => {
  setup();
  const ticket = { id: '90', grid: [[1, 2, 3], [10, 11, 12], [20, 21, 22], [30, 31, 32], [40, 41, 42], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] };
  const marks = new Set([0, 1, 2, 3, 4, 9, 10, 11, 12, 13, 18, 19, 20, 21, 22]);
  store.setState({ room: { ...room, variant: '90', patterns: ['top_row'] }, myCards: [ticket], myDabs: [marks] });
  store.getState().claimBingo();
  assert.equal(emitted.at(-1)[1].stage, 'full_house');
});
