import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const socketUrl = moduleUrl(`
  export const handlers = new Map();
  export const emitted = [];
  const socket = {
    on(event, handler) { handlers.set(event, handler); },
    off(event) { handlers.delete(event); },
    emit(...args) { emitted.push(args); },
  };
  export const getSocket = () => socket;
`);
const source = readFileSync(new URL('../src/stores/room-store.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
  .replaceAll('"zustand"', JSON.stringify(import.meta.resolve('zustand')))
  .replaceAll('"@bingo/shared"', JSON.stringify(moduleUrl('export const FREE_SPACE_INDEX = 12;')))
  .replaceAll('"@/socket"', JSON.stringify(socketUrl));
const { useRoomStore } = await import(moduleUrl(compiled));
const { handlers, emitted } = await import(socketUrl);
const room = { code: 'REVIEW', state: 'in_progress', players: [] };

function setup() {
  useRoomStore.getState().reset();
  emitted.length = 0;
  useRoomStore.getState().setupListeners();
}

test('late room responses cannot reopen a game after leaving', () => {
  setup();
  useRoomStore.getState().joinRoom(room.code);
  handlers.get('room:state')(room);
  useRoomStore.getState().leaveRoom();
  handlers.get('room:state')(room);
  assert.equal(useRoomStore.getState().room, null);
  assert.equal(useRoomStore.getState().gameState, null);
  assert.equal(useRoomStore.getState().isConnecting, false);
  assert.deepEqual(emitted.map(([event]) => event), ['room:join', 'room:leave']);
});

test('a cancelled join ignores its late response but an intentional rejoin works', () => {
  setup();
  useRoomStore.getState().joinRoom(room.code);
  useRoomStore.getState().leaveRoom();
  handlers.get('room:state')(room);
  assert.equal(useRoomStore.getState().room, null);
  useRoomStore.getState().joinRoom(room.code);
  handlers.get('room:state')(room);
  assert.equal(useRoomStore.getState().room.code, room.code);
});

test('room creation and updates to an active room still work', () => {
  setup();
  useRoomStore.getState().createRoom('75');
  handlers.get('room:state')({ ...room, state: 'lobby' });
  assert.equal(useRoomStore.getState().room.state, 'lobby');
  assert.equal(useRoomStore.getState().isConnecting, false);
  handlers.get('room:state')({ ...room, speed: 4000 });
  assert.equal(useRoomStore.getState().room.speed, 4000);
});
