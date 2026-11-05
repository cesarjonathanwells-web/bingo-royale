import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const socketUrl = moduleUrl(`
  export const emitted = [];
  const handlers = new Map();
  export const socket = {
    connected: true, connects: 0,
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(handler);
    },
    off(event, handler) {
      if (handler) handlers.get(event)?.delete(handler);
      else handlers.delete(event);
    },
    emit(...args) { emitted.push(args); },
    connect() { socket.connects++; },
  };
  export function trigger(event, ...args) {
    if (event === 'connect') socket.connected = true;
    if (event === 'disconnect') socket.connected = false;
    for (const handler of [...(handlers.get(event) ?? [])]) handler(...args);
  }
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
const { emitted, socket, trigger } = await import(socketUrl);
const room = { code: 'ABC234', state: 'lobby', players: [] };

function setup(t) {
  useRoomStore.getState().reset();
  emitted.length = 0;
  socket.connected = true;
  socket.connects = 0;
  useRoomStore.getState().setupListeners();
  const timers = new Map();
  let timerId = 0;
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    const id = ++timerId;
    timers.set(id, { callback, delay });
    return id;
  });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  t.after(() => useRoomStore.getState().reset());
  return {
    expire() {
      const pending = [...timers.values()];
      timers.clear();
      for (const timer of pending) timer.callback();
    },
    timers,
  };
}

test('a rejected join stops loading, shows the reason, and permits a successful retry', t => {
  setup(t);
  useRoomStore.getState().joinRoom(room.code);
  const reject = emitted[0][2];
  reject({ success: false, error: 'Room not found' });
  assert.equal(useRoomStore.getState().isConnecting, false);
  assert.equal(useRoomStore.getState().error, 'errors.invalidRoom');
  assert.equal(useRoomStore.getState().room, null);

  useRoomStore.getState().joinRoom(room.code);
  emitted[1][2]({ success: true, room });
  assert.equal(useRoomStore.getState().room.code, room.code);
  assert.equal(useRoomStore.getState().error, null);
  assert.equal(useRoomStore.getState().isConnecting, false);
});

test('full rooms return a visible, retryable failure instead of an endless join', t => {
  setup(t);
  useRoomStore.getState().joinRoom(room.code);
  emitted[0][2]({ success: false, error: 'Room is full' });
  assert.equal(useRoomStore.getState().error, 'errors.roomFull');
  assert.equal(useRoomStore.getState().isConnecting, false);
});

test('displayed or pasted room codes normalize before sending and malformed codes stay local', t => {
  setup(t);
  for (const invalid of ['', 'ABC', 'ABCDEFG', 'ABC!23']) {
    useRoomStore.getState().joinRoom(invalid);
    assert.equal(useRoomStore.getState().isConnecting, false);
    assert.equal(useRoomStore.getState().error, 'errors.invalidCode');
  }
  assert.equal(emitted.length, 0);
  useRoomStore.getState().joinRoom(' aBc-2 34\n');
  assert.equal(emitted[0][1].code, 'ABC234');
});

test('a missing acknowledgment times out and a late reply cannot complete a later join', t => {
  const clock = setup(t);
  useRoomStore.getState().joinRoom(room.code);
  const staleReply = emitted[0][2];
  assert.equal([...clock.timers.values()][0].delay, 10000);
  clock.expire();
  assert.equal(useRoomStore.getState().isConnecting, false);
  assert.equal(useRoomStore.getState().error, 'errors.roomTimeout');

  useRoomStore.getState().joinRoom('XYZ789');
  staleReply({ success: true, room });
  trigger('room:state', room);
  assert.equal(useRoomStore.getState().room, null);
  assert.equal(useRoomStore.getState().isConnecting, true);
  emitted[1][2]({ success: true, room: { ...room, code: 'XYZ789' } });
  assert.equal(useRoomStore.getState().room.code, 'XYZ789');
});

test('a disconnected request waits for connection without buffering a join packet', t => {
  setup(t);
  socket.connected = false;
  useRoomStore.getState().joinRoom(room.code);
  assert.equal(emitted.length, 0);
  assert.equal(socket.connects, 1);
  trigger('connect');
  assert.equal(emitted.length, 1);
  emitted[0][2]({ success: true, room });
  assert.equal(useRoomStore.getState().isConnecting, false);
});

test('a timed-out disconnected join never runs later when the connection returns', t => {
  const clock = setup(t);
  socket.connected = false;
  useRoomStore.getState().joinRoom(room.code);
  clock.expire();
  trigger('connect');
  assert.equal(emitted.length, 0);
  assert.equal(useRoomStore.getState().error, 'errors.roomTimeout');
});

test('connection errors release the join controls and remove the deferred join', t => {
  setup(t);
  socket.connected = false;
  useRoomStore.getState().joinRoom(room.code);
  trigger('connect_error', new Error('transport blocked'));
  assert.equal(useRoomStore.getState().error, 'errors.connection');
  assert.equal(useRoomStore.getState().isConnecting, false);
  trigger('connect');
  assert.equal(emitted.length, 0);
});

test('disconnecting during a join cancels its acknowledgment', t => {
  setup(t);
  useRoomStore.getState().joinRoom(room.code);
  const reply = emitted[0][2];
  trigger('disconnect', 'transport close');
  reply({ success: true, room });
  assert.equal(useRoomStore.getState().room, null);
  assert.equal(useRoomStore.getState().isConnecting, false);
});

test('Exit cancels acknowledgments and the pending request timer', t => {
  const clock = setup(t);
  useRoomStore.getState().joinRoom(room.code);
  const reply = emitted[0][2];
  useRoomStore.getState().leaveRoom();
  reply({ success: true, room });
  trigger('room:state', room);
  assert.equal(useRoomStore.getState().room, null);
  assert.equal(clock.timers.size, 0);
});

test('duplicate submissions produce one join and a room snapshot can complete it', t => {
  const clock = setup(t);
  useRoomStore.getState().joinRoom(room.code);
  useRoomStore.getState().joinRoom(room.code);
  assert.equal(emitted.length, 1);
  trigger('room:state', room);
  emitted[0][2]({ success: true, room });
  assert.equal(useRoomStore.getState().room.code, room.code);
  assert.equal(clock.timers.size, 0);
});

test('room creation failures and missing replies use the same bounded lifecycle', t => {
  const clock = setup(t);
  useRoomStore.getState().createRoom('75');
  emitted[0][2]({ success: false, error: 'Unable to create room' });
  assert.equal(useRoomStore.getState().isConnecting, false);
  assert.equal(useRoomStore.getState().error, 'Unable to create room');
  useRoomStore.getState().createRoom('90');
  clock.expire();
  assert.equal(useRoomStore.getState().error, 'errors.roomTimeout');
  assert.equal(useRoomStore.getState().isConnecting, false);
});
