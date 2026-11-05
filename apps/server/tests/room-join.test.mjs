import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

// Run the real handlers, room lock, and room store without binding a port.
// Only Redis and completed-game persistence are replaced by local fixtures.
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'bingo-room-join-'));
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
  for (const match of [...javascript.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)]) {
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
const store = await importSource('apps/server/src/redis/room-store.ts');
const { registerRoomHandlers } = await importSource('apps/server/src/socket/handlers/room.ts');
const { CallerManager } = await importSource('apps/server/src/services/caller.ts');
const rooms = [];
let serial = 0;
afterEach(async () => {
  for (const code of rooms.splice(0)) {
    CallerManager.stopCalling(code);
    await store.deleteRoom(code);
  }
});
after(async () => { await rm(temporary, { recursive: true, force: true }); });

async function fixture(playerLimit = 50) {
  const sockets = [];
  const broadcast = (target, event, data, excluded) => {
    for (const socket of sockets) {
      if (socket !== excluded && (socket.id === target || socket.channels.has(target))) {
        socket.emit(event, data);
      }
    }
  };
  const io = {
    to(target) { return { emit(event, data) { broadcast(target, event, data); } }; },
    in(target) { return { fetchSockets: async () => sockets.filter(s => s.channels.has(target)) }; },
  };
  const makeSocket = (userId, name = userId) => {
    const socket = {
      id: `join-socket-${++serial}`, data: { user: { id: userId, name } },
      handlers: new Map(), channels: new Set(), events: [],
      on(event, handler) { this.handlers.set(event, handler); },
      emit(event, data) { this.events.push({ event, data: structuredClone(data) }); },
      async join(code) { this.channels.add(code); },
      async leave(code) { this.channels.delete(code); },
      to(target) { return { emit(event, data) { broadcast(target, event, data, socket); } }; },
    };
    sockets.push(socket);
    registerRoomHandlers(socket, io);
    return socket;
  };
  const host = makeSocket(`host-${serial}`, 'Host');
  const created = await act(host, 'room:create', { variant: '75', playerLimit });
  assert.equal(created.success, true);
  rooms.push(created.room.code);
  return { host, code: created.room.code, makeSocket };
}

async function act(socket, event, data, acknowledged = true) {
  let reply;
  await socket.handlers.get(event)(data, ...(acknowledged ? [value => { reply = value; }] : []));
  return reply;
}

test('a second player receives the lobby and the host sees their arrival', async () => {
  const f = await fixture();
  const guest = f.makeSocket('guest');
  const reply = await act(guest, 'room:join', { code: f.code });
  assert.equal(reply.success, true);
  assert.equal(reply.room.players.length, 2);
  assert.equal(guest.data.roomCode, f.code);
  assert.equal(guest.channels.has(f.code), true);
  assert.equal(guest.events.find(e => e.event === 'room:state').data.code, f.code);
  assert.equal(f.host.events.find(e => e.event === 'room:player_joined').data.player.id, 'guest');
});

test('formatted and plain codes serialize concurrent joins into the same room', async () => {
  const f = await fixture();
  const alice = f.makeSocket('alice');
  const bob = f.makeSocket('bob');
  const formatted = ` ${f.code.slice(0, 3).toLowerCase()} - ${f.code.slice(3).toLowerCase()} `;
  const replies = await Promise.all([
    act(alice, 'room:join', { code: formatted }),
    act(bob, 'room:join', { code: f.code }),
  ]);
  assert(replies.every(reply => reply.success));
  assert.deepEqual(new Set((await store.getPlayers(f.code)).map(p => p.id)),
    new Set([f.host.data.user.id, 'alice', 'bob']));
  assert.equal(alice.data.roomCode, f.code);
});

test('missing, malformed and unknown codes acknowledge failure without joining', async () => {
  const f = await fixture();
  for (const [code, message] of [[undefined, 'Room code is required'], ['12!', 'Invalid room code'],
    [123456, 'Invalid room code'], ['ZZZZZZ', 'Room not found']]) {
    const guest = f.makeSocket(`invalid-${serial}`);
    const reply = await act(guest, 'room:join', { code });
    assert.equal(reply.success, false);
    assert(reply.error.startsWith(message));
    assert.equal(guest.channels.size, 0);
    assert.equal(guest.data.roomCode, undefined);
    assert.equal(guest.events.filter(e => e.event === 'error').length, 0);
  }
});

test('legacy clients receive terminal errors for rejected codes and full rooms', async () => {
  const f = await fixture(2);
  await act(f.makeSocket('accepted'), 'room:join', { code: f.code });
  for (const [code, message] of [['', 'Room code is required'], ['BAD!', 'Invalid room code'],
    ['ZZZZZZ', 'Room not found'], [f.code, 'Room is full']]) {
    const guest = f.makeSocket(`legacy-${serial}`);
    await act(guest, 'room:join', { code }, false);
    const errors = guest.events.filter(e => e.event === 'error');
    assert.equal(errors.length, 1);
    assert(errors[0].data.message.startsWith(message));
    assert.equal(guest.channels.size, 0);
  }
  assert.equal((await store.getPlayers(f.code)).length, 2);
});

test('rejoining an existing player returns room state without duplicate player rows', async () => {
  const f = await fixture(2);
  const original = f.makeSocket('reconnecting');
  await act(original, 'room:join', { code: f.code });
  const reconnect = f.makeSocket('reconnecting');
  const reply = await act(reconnect, 'room:join', { code: f.code });
  assert.equal(reply.success, true);
  assert.equal(reply.room.players.length, 2);
  assert.equal(reply.room.players.find(p => p.id === 'reconnecting').connected, true);
  assert(f.host.events.some(e => e.event === 'room:player_updated' && e.data.playerId === 'reconnecting'));
});
