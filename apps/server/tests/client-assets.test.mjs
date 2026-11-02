import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import ts from 'typescript';

const source = readFileSync(new URL('../src/client-assets.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replaceAll("'express'", JSON.stringify(import.meta.resolve('express')));
const { serveClient } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('production routes keep entry points fresh, cache hashed assets, and support installed-app deep links', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bingo-assets-'));
  const app = express();
  let server;
  try {
    await mkdir(path.join(directory, 'assets'));
    for (const [file, content] of Object.entries({ 'index.html': '<h1>Bingo test shell</h1>', 'sw.js': '// worker', 'manifest.json': '{}', 'assets/app-123.js': '// hashed asset' })) {
      await writeFile(path.join(directory, file), content);
    }
    assert.equal(serveClient(app, [path.join(directory, 'missing'), directory]), directory);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/', '/room/ABC123', '/settings']) {
      const response = await fetch(origin + route);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-cache');
      assert.match(await response.text(), /Bingo test shell/);
    }
    for (const route of ['/sw.js', '/manifest.json']) {
      const response = await fetch(origin + route);
      assert.equal(response.headers.get('cache-control'), 'no-cache');
      if (route === '/sw.js') assert.equal(response.headers.get('service-worker-allowed'), '/');
    }
    assert.match((await fetch(origin + '/assets/app-123.js')).headers.get('cache-control'), /immutable/);
    for (const route of ['/api/missing', '/socket.io/missing', '/assets/missing.js']) {
      assert.equal((await fetch(origin + route)).status, 404);
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
