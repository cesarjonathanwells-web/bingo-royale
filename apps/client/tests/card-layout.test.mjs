import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Compile the actual helper in memory so this suite also runs on Node 22.
const source = readFileSync(new URL('../src/lib/card-layout.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getCardLayout } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const layout = (width, height, count = 4, variant = '75') => getCardLayout({width,height,count,variant,headerHeight:34});

test('four cards use two real columns at 320px phone width without microscopic cells', () => {
  const result = layout(304, 260);
  assert.equal(result.columns, 2);
  assert.equal(result.maxWidth, 304);
  const cardWidth = (result.maxWidth - 4) / 2;
  assert.ok((cardWidth - 30) / 5 >= 24);
});

test('short landscape screens scroll instead of collapsing the card widths', () => {
  const result = layout(724, 80);
  assert.equal(result.columns, 2);
  assert.ok(result.maxWidth >= 304);
});

test('portrait phones do not inherit the old CSS single-column breakpoint', () => {
  const result = layout(374, 540);
  assert.equal(result.columns, 2);
  assert.ok(result.maxWidth <= 374);
});

test('very narrow screens use a readable full-width single column', () => {
  assert.deepEqual(layout(260, 240), {columns:1,maxWidth:260});
});

test('90-ball tickets remain full width until two readable tickets fit', () => {
  assert.deepEqual(layout(374, 540, 4, '90'), {columns:1,maxWidth:374});
  assert.equal(layout(700, 540, 4, '90').columns, 2);
});

test('one to four cards stay inside the available width for both variants', () => {
  for (const variant of ['75','90']) for (const count of [1,2,3,4]) {
    for (const width of [260,304,374,624,1000]) for (const height of [80,260,540]) {
      const result = layout(width,height,count,variant);
      assert.ok(result.maxWidth > 0 && result.maxWidth <= width);
    }
  }
});
