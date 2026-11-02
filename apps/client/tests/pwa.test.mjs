import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const precache = ['/offline.html', '/assets/app.js', '/icons/icon-192.png'];
const source = readFileSync(new URL('../src/pwa/service-worker.js', import.meta.url), 'utf8')
  .replace('__BUILD_VERSION__', 'test').replace('__PRECACHE_ASSETS__', JSON.stringify(precache));
function worker() {
  const handlers = new Map(), stores = new Map(), requests = [];
  let offline = false, skips = 0;
  const key = request => new URL(typeof request === 'string' ? request : request.url, 'https://bingo.test').pathname;
  const caches = {
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(urls) { for (const url of urls) entries.set(key(url), new Response(key(url))); },
        async match(request) { return entries.get(key(request))?.clone(); },
        async put(request, response) { entries.set(key(request), response); },
      };
    },
  };
  class RelativeRequest extends Request { constructor(url, options) { super(new URL(url, 'https://bingo.test'), options); } }
  vm.runInNewContext(source, { Request: RelativeRequest, URL, Response, caches,
    fetch: async request => { requests.push(request.url); if (offline) throw Error('offline'); return new Response('fresh network response'); },
    self: { location: { origin: 'https://bingo.test' }, clients: { async claim() {} }, skipWaiting() { skips++; },
      addEventListener(type, handler) { handlers.set(type, handler); } },
  });
  return {
    stores, requests, offline() { offline = true; }, skips: () => skips,
    async lifecycle(name) { let pending; handlers.get(name)({ waitUntil(promise) { pending = promise; } }); await pending; },
    async fetch(path, options = {}) {
      let response;
      handlers.get('fetch')({ request: { url: new URL(path, 'https://bingo.test').href, method: 'GET', mode: 'cors', ...options },
        respondWith(promise) { response = promise; } });
      return response;
    },
  };
}

test('static assets are precached without forcing an update into active games', async () => {
  const w = worker(); await w.lifecycle('install');
  assert.deepEqual([...w.stores.get('bingo-static-test').keys()], precache);
  assert.equal(w.skips(), 0);
  assert.equal(await (await w.fetch('/assets/app.js')).text(), '/assets/app.js');
  assert.equal(w.requests.length, 0);
});

test('credentials, socket traffic, POSTs, and external requests bypass the worker', async () => {
  const w = worker();
  for (const path of ['/api/auth/me', '/api', '/socket.io/?transport=polling', 'https://other.test/assets/app.js']) {
    assert.equal(await w.fetch(path), undefined);
  }
  assert.equal(await w.fetch('/assets/app.js', { method: 'POST' }), undefined);
  assert.equal(await w.fetch('/images/unlisted.png'), undefined);
});

test('deep links use fresh HTML online and an honest offline fallback without caching room pages', async () => {
  const w = worker(); await w.lifecycle('install');
  assert.equal(await (await w.fetch('/room/ABC123', { mode: 'navigate' })).text(), 'fresh network response');
  assert.equal(w.stores.get('bingo-static-test').has('/room/ABC123'), false);
  w.offline();
  assert.equal(await (await w.fetch('/room/ABC123', { mode: 'navigate' })).text(), '/offline.html');
});

test('activation deletes only outdated Bingo static caches', async () => {
  const w = worker(); await w.lifecycle('install');
  w.stores.set('bingo-static-old', new Map()); w.stores.set('unrelated-app', new Map());
  await w.lifecycle('activate');
  assert.deepEqual([...w.stores.keys()], ['bingo-static-test', 'unrelated-app']);
});

test('install manifest references real, correctly sized PNGs including a maskable icon', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert(manifest.icons.some(icon => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const png = readFileSync(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
