import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Compile the actual helper in memory so this suite also runs on Node 22.
const source = readFileSync(new URL('../src/lib/card-layout.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getCardLayout, getCardHeaderHeight } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const layout = (width, height, count = 4, variant = '75') => getCardLayout({width,height,count,variant,headerHeight:34});

test('four cards use two real columns at 320px phone width without microscopic cells', () => {
  const result = layout(304, 260);
  assert.equal(result.columns, 2);
  assert.equal(result.maxWidth, 304);
  const cardWidth = (result.maxWidth - 8) / 2;
  assert.ok((cardWidth - 28) / 5 >= 24);
});

test('short landscape screens scroll instead of collapsing the card widths', () => {
  const result = layout(724, 80);
  assert.equal(result.columns, 4);
  assert.equal(result.maxWidth, 724);
  const cardWidth = (result.maxWidth - 24) / 4;
  assert.ok((cardWidth - 28) / 5 >= 24);
});

test('landscape safe-area height reductions keep four readable cards in one row', () => {
  const result = layout(852, 180);
  assert.deepEqual(result, { columns: 4, maxWidth: 852 });
  const cardWidth = (result.maxWidth - 24) / 4;
  assert.ok(cardWidth >= 148);
});

test('short 90-ball layouts use one row only when every ticket fits readably', () => {
  assert.deepEqual(layout(1000, 80, 3, '90'), { columns: 3, maxWidth: 1000 });
  assert.deepEqual(layout(1000, 80, 4, '90'), { columns: 2, maxWidth: 1000 });
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

test('wide desktop layouts give four 75-ball cards one large row', () => {
  const result = layout(1560, 640);
  assert.equal(result.columns, 4);
  assert.equal(result.maxWidth, 1560);
  assert.ok((result.maxWidth - 24) / 4 > 380);
});

test('three cards can fill a wide board in three columns', () => {
  const result = layout(1300, 650, 3);
  assert.equal(result.columns, 3);
  assert.equal(result.maxWidth, 1300);
});

test('a single card grows beyond the former 420px cap but respects its square height', () => {
  assert.deepEqual(layout(1300, 720, 1), { columns: 1, maxWidth: 686 });
  assert.deepEqual(layout(540, 800, 1), { columns: 1, maxWidth: 540 });
});

test('single-card sizing does not reserve rows for hidden carousel cards', () => {
  const single = layout(1000, 600, 1);
  const all = layout(1000, 600, 4);
  const allCardWidth = (all.maxWidth - 8 * (all.columns - 1)) / all.columns;
  assert.ok(single.maxWidth > allCardWidth * 1.5);
});

test('fluid headers fit without width feedback at container padding breakpoints', () => {
  for (const height of [280, 282, 284, 390, 392, 394, 720]) {
    const options = { width: 1000, height, count: 1, variant: '75' };
    const result = getCardLayout(options);
    assert.ok(result.maxWidth + getCardHeaderHeight(result.maxWidth) <= height);
    assert.deepEqual(getCardLayout(options), result);
    assert.ok(result.maxWidth + .1 + getCardHeaderHeight(result.maxWidth + .1) > height);
  }
});

test('90-ball sizing accounts for minimum row heights and grows wide tickets', () => {
  assert.deepEqual(layout(900, 420, 1, '90'), { columns: 1, maxWidth: 900 });
  const result = layout(1500, 600, 4, '90');
  assert.equal(result.columns, 2);
  assert.ok((result.maxWidth - 8) / 2 > 700);
});

test('height constraints can choose a denser row without violating readable minimums', () => {
  const result = layout(724, 240);
  assert.equal(result.columns, 4);
  assert.ok((result.maxWidth - 24) / 4 >= 148);
});

test('unmeasured or invalid dimensions do not produce NaN or infinite layouts', () => {
  assert.deepEqual(layout(0, 0), { columns: 1, maxWidth: 0 });
  assert.deepEqual(layout(NaN, 540), { columns: 1, maxWidth: 0 });
  assert.deepEqual(layout(374, Infinity), { columns: 2, maxWidth: 374 });
});

test('one to four cards stay inside the available width for both variants', () => {
  for (const variant of ['75','90']) for (const count of [1,2,3,4]) {
    for (const width of [260,304,374,624,1000,1560]) for (const height of [80,260,540,900]) {
      const result = layout(width,height,count,variant);
      assert.ok(result.maxWidth > 0 && result.maxWidth <= width);
      assert.ok(Number.isInteger(result.columns) && result.columns >= 1 && result.columns <= count);
      const cardWidth = (result.maxWidth - 8 * (result.columns - 1)) / result.columns;
      assert.ok(cardWidth >= Math.min(width, variant === '75' ? 148 : 324) - .01);
    }
  }
});
