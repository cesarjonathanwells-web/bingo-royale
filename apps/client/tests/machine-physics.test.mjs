import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Compile the actual module in memory so this suite also runs on Node 22.
const source = readFileSync(new URL('../src/lib/machine-physics.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { BALL_RADIUS, createMachine, stepMachine, agitate, setSimmer, numberBalls } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const inside = machine => machine.balls.every(ball =>
  Number.isFinite(ball.x) && Number.isFinite(ball.y) && Math.hypot(ball.x, ball.y) <= 1 - BALL_RADIUS + 1e-6);
const run = (machine, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) stepMachine(machine, 1 / 60); };

test('a new machine holds every ball, at rest in the lower half of the globe', () => {
  const machine = createMachine(18, 8, 5);
  assert.equal(machine.balls.length, 18);
  assert.ok(inside(machine));
  assert.equal(machine.asleep, true);
  assert.equal(stepMachine(machine, 1 / 60), false, 'a resting machine needs no redraw');
  const centre = machine.balls.reduce((sum, ball) => sum + ball.y, 0) / machine.balls.length;
  assert.ok(centre > 0.2, `pile should sit low in the globe (mean y ${centre})`);
});

test('balls in the same layer never end a step overlapping', () => {
  const machine = createMachine(18, 3, 5);
  agitate(machine);
  for (let frame = 0; frame < 240; frame++) {
    stepMachine(machine, 1 / 60);
    for (const a of machine.balls) for (const b of machine.balls) {
      if (a.id >= b.id || a.layer !== b.layer) continue;
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > BALL_RADIUS * 2 * 0.8, `balls ${a.id} and ${b.id} overlap at frame ${frame}`);
    }
  }
});

test('a call lifts the balls, they stay inside the glass, then settle and sleep', () => {
  const machine = createMachine(18, 8, 5);
  const restingTop = Math.min(...machine.balls.map(ball => ball.y));
  agitate(machine);
  let highest = restingTop;
  for (let frame = 0; frame < 90; frame++) {
    assert.equal(stepMachine(machine, 1 / 60), true);
    assert.ok(inside(machine), `a ball left the globe at frame ${frame}`);
    highest = Math.min(highest, ...machine.balls.map(ball => ball.y));
  }
  assert.ok(highest < restingTop - 0.3, 'the blower should throw balls well above the resting pile');
  run(machine, 12);
  assert.equal(machine.asleep, true, 'the pile should come to rest');
  assert.ok(inside(machine));
  assert.ok(machine.balls.every(ball => Math.abs(Math.hypot(ball.nx, ball.ny, ball.nz) - 1) < 1e-6), 'number discs stay unit vectors');
});

test('simmering keeps the machine awake between calls; turning it off lets it rest', () => {
  const machine = createMachine(12, 5, 5);
  setSimmer(machine, true);
  run(machine, 6);
  assert.equal(machine.asleep, false);
  assert.ok(inside(machine));
  setSimmer(machine, false);
  run(machine, 12);
  assert.equal(machine.asleep, true);
});

test('the same seed gives the same machine; long frames are clamped', () => {
  const a = createMachine(18, 42, 5);
  const b = createMachine(18, 42, 5);
  assert.deepEqual(a.balls.map(ball => [ball.x, ball.y]), b.balls.map(ball => [ball.x, ball.y]));
  agitate(a);
  stepMachine(a, 30); // a tab that was asleep for 30 seconds
  assert.ok(inside(a));
});

test('balls carry only uncalled numbers that match their colour', () => {
  const machine = createMachine(18, 8, 5);
  const called = new Set();
  numberBalls(machine, called, 75, true);
  const first = machine.balls.map(ball => ball.number);
  assert.equal(new Set(first).size, 18, 'numbers are unique');
  assert.ok(machine.balls.every(ball => ball.number >= 1 && ball.number <= 75 && Math.floor((ball.number - 1) / 15) === ball.color));
  // Calling a number that is on a ball gives that ball a different, still uncalled number.
  called.add(first[0]);
  numberBalls(machine, called, 75, true);
  assert.notEqual(machine.balls[0].number, first[0]);
  assert.deepEqual(machine.balls.slice(1).map(ball => ball.number), first.slice(1), 'other balls keep their numbers');
  assert.ok(machine.balls.every(ball => !called.has(ball.number)));
  // With a whole column called, its balls take another column's colour.
  for (let n = 1; n <= 15; n++) called.add(n);
  numberBalls(machine, called, 75, true);
  assert.ok(machine.balls.every(ball => ball.number > 15 && Math.floor((ball.number - 1) / 15) === ball.color));
});

test('90-ball machines use one colour and numbers up to 90; an empty pool leaves discs blank', () => {
  const machine = createMachine(18, 8, 1);
  numberBalls(machine, new Set(), 90, false);
  assert.ok(machine.balls.every(ball => ball.color === 0 && ball.number >= 1 && ball.number <= 90));
  const everything = new Set(Array.from({ length: 90 }, (_, i) => i + 1));
  numberBalls(machine, everything, 90, false);
  assert.ok(machine.balls.every(ball => ball.number === 0));
});
