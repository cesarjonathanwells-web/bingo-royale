// Ball machine simulation for the call stage.
//
// Coordinates are in globe radii: the globe is the unit circle centred on the
// origin, +y points down. Balls sit in two depth layers so the globe looks
// full; balls only collide with others in their own layer.

export const BALL_RADIUS = 0.2;
const WALL = 1 - BALL_RADIUS - 0.02;
const GRAVITY = 15;
const STEP = 1 / 120;
const MAX_STEPS_PER_FRAME = 6;

export interface MachineBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 = back layer, 1 = front layer. */
  layer: 0 | 1;
  /** Index into the stage's colour list. */
  color: number;
  /** Unit vector to the centre of the white number disc; z points at the viewer. */
  nx: number;
  ny: number;
  nz: number;
  /** In-plane turn of the number on its disc, in radians. */
  spin: number;
  /** The number printed on the ball; 0 while it has none. */
  number: number;
}

export interface Machine {
  balls: MachineBall[];
  /** 0 = at rest, 1 = full blower. Decays toward zero after each call. */
  energy: number;
  /** When true, a ball pops every second or so while the blower is quiet. */
  simmer: boolean;
  asleep: boolean;
  random: () => number;
  carry: number;
  quietFor: number;
  nextPop: number;
}

/** Small seeded generator so layouts and tests are repeatable. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds a machine with `count` balls already resting at the bottom of the globe. */
export function createMachine(count: number, seed = 1, colors = 5): Machine {
  const random = seededRandom(seed);
  const balls: MachineBall[] = [];
  for (let id = 0; id < count; id++) {
    const layer = (id % 2) as 0 | 1;
    // Drop each ball into the lowest free spot of its layer.
    let best: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * WALL;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      if (best && y <= best.y) continue;
      const free = balls.every(other => other.layer !== layer
        || Math.hypot(other.x - x, other.y - y) >= BALL_RADIUS * 2);
      if (free) best = { x, y };
    }
    if (!best) break;
    const disc = randomUnit(random);
    balls.push({
      id, layer, color: id % colors, x: best.x, y: best.y, vx: 0, vy: 0,
      nx: disc[0], ny: disc[1], nz: Math.abs(disc[2]),
      spin: (random() - 0.5) * 1.2, number: 0,
    });
  }
  const machine: Machine = {
    balls, energy: 0, simmer: false, asleep: false, random,
    carry: 0, quietFor: 0, nextPop: 1,
  };
  // Let the pile come to rest so the first frame is already settled.
  for (let i = 0; i < 480 && !machine.asleep; i++) integrate(machine);
  machine.asleep = true;
  return machine;
}

/** Turns the blower up, as when a number is called. */
export function agitate(machine: Machine, amount = 1): void {
  machine.energy = Math.max(machine.energy, Math.min(1, amount));
  machine.asleep = false;
  machine.quietFor = 0;
}

/** Enables or disables the gentle popping between calls. */
export function setSimmer(machine: Machine, simmer: boolean): void {
  machine.simmer = simmer;
  if (simmer) { machine.asleep = false; machine.quietFor = 0; }
}

/**
 * Advances the machine by `seconds` of real time.
 * Returns false once everything is at rest and nothing needs redrawing.
 */
export function stepMachine(machine: Machine, seconds: number): boolean {
  if (machine.asleep) return false;
  machine.carry += Math.min(seconds, STEP * MAX_STEPS_PER_FRAME);
  while (machine.carry >= STEP) {
    machine.carry -= STEP;
    integrate(machine);
    if (machine.asleep) return false;
  }
  return true;
}

function integrate(machine: Machine): void {
  const { balls, random } = machine;
  const energy = machine.energy;
  machine.energy = energy < 0.01 ? 0 : energy * Math.exp(-STEP / 0.8);

  // Between calls, pop one resting ball now and then.
  if (machine.simmer && energy < 0.15) {
    machine.nextPop -= STEP;
    if (machine.nextPop <= 0 && balls.length > 0) {
      machine.nextPop = 0.8 + random() * 1.1;
      const candidates = balls.filter(ball => ball.y > 0.25 && Math.abs(ball.x) < 0.6);
      const ball = candidates[Math.floor(random() * candidates.length)];
      if (ball) {
        ball.vy = -(3.4 + random() * 1.6);
        ball.vx = (random() - 0.5) * 1.8;
      }
    }
  }

  let fastest = 0;
  for (const ball of balls) {
    let ax = 0;
    let ay = GRAVITY;
    if (energy > 0) {
      // Air jet up the middle, spilling outward near the top: a fountain.
      const column = Math.max(0, 1 - Math.abs(ball.x) / 0.7);
      const low = ball.y > -0.35 ? 1 : 0.25;
      ay -= energy * (40 + 34 * random()) * column * low;
      // Turbulence keeps the cloud mixing instead of hugging the glass.
      ax += energy * (46 * (random() - 0.5) + (ball.y < -0.3 ? Math.sign(ball.x || random() - 0.5) * 4 : 0));
      ay += energy * 20 * (random() - 0.5);
    }
    ball.vx = (ball.vx + ax * STEP) * 0.9985;
    ball.vy = (ball.vy + ay * STEP) * 0.9985;
    ball.x += ball.vx * STEP;
    ball.y += ball.vy * STEP;

    // Glass wall.
    const distance = Math.hypot(ball.x, ball.y);
    if (distance > WALL) {
      const nx = ball.x / distance;
      const ny = ball.y / distance;
      ball.x = nx * WALL;
      ball.y = ny * WALL;
      const along = ball.vx * nx + ball.vy * ny;
      if (along > 0) {
        ball.vx -= (1 + 0.42) * along * nx;
        ball.vy -= (1 + 0.42) * along * ny;
        ball.vx *= 0.985;
        ball.vy *= 0.985;
      }
    }
  }

  // Ball against ball, within each layer.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]!;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]!;
        if (a.layer !== b.layer) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const gap = dx * dx + dy * dy;
        const reach = BALL_RADIUS * 2;
        if (gap >= reach * reach || gap === 0) continue;
        const distance = Math.sqrt(gap);
        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = (reach - distance) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (closing < 0) {
          const impulse = -(1 + 0.5) * closing / 2;
          a.vx -= impulse * nx; a.vy -= impulse * ny;
          b.vx += impulse * nx; b.vy += impulse * ny;
        }
      }
    }
  }

  for (const ball of balls) {
    // Keep corrected balls inside the glass.
    const distance = Math.hypot(ball.x, ball.y);
    if (distance > WALL) { ball.x *= WALL / distance; ball.y *= WALL / distance; }
    // Resting contact: kill the tiny bounce that never ends.
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed < 0.12 && energy < 0.02) { ball.vx *= 0.8; ball.vy *= 0.8; }
    fastest = Math.max(fastest, speed);
    // Roll the number disc with the motion.
    const wx = ball.vy / BALL_RADIUS * 0.55 * STEP;
    const wy = -ball.vx / BALL_RADIUS * 0.55 * STEP;
    const dx = wy * ball.nz;
    const dy = -wx * ball.nz;
    const dz = wx * ball.ny - wy * ball.nx;
    const nx = ball.nx + dx;
    const ny = ball.ny + dy;
    const nz = ball.nz + dz;
    const length = Math.hypot(nx, ny, nz) || 1;
    ball.nx = nx / length; ball.ny = ny / length; ball.nz = nz / length;
    ball.spin += ball.vx / BALL_RADIUS * 0.25 * STEP;
  }

  if (!machine.simmer && machine.energy === 0 && fastest < 0.25) {
    machine.quietFor += STEP;
    if (machine.quietFor > 0.5) {
      for (const ball of balls) { ball.vx = 0; ball.vy = 0; }
      machine.asleep = true;
    }
  } else {
    machine.quietFor = 0;
  }
}

function randomUnit(random: () => number): [number, number, number] {
  const z = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const flat = Math.sqrt(1 - z * z);
  return [Math.cos(angle) * flat, Math.sin(angle) * flat, z];
}

/**
 * Prints an uncalled number on every ball. A ball keeps its number until that
 * number is called; in 75-ball the number always matches the ball's colour
 * (B 1-15, I 16-30, ...), recolouring the ball when its column runs out.
 */
export function numberBalls(machine: Machine, called: ReadonlySet<number>, total: number, columns: boolean): void {
  const taken = new Set<number>();
  for (const ball of machine.balls) {
    if (ball.number && !called.has(ball.number) && ball.number <= total && !taken.has(ball.number)) taken.add(ball.number);
    else ball.number = 0;
  }
  const free: number[] = [];
  for (let n = 1; n <= total; n++) if (!called.has(n) && !taken.has(n)) free.push(n);
  for (const ball of machine.balls) {
    if (ball.number || free.length === 0) continue;
    const matching = columns ? free.filter(n => Math.floor((n - 1) / 15) === ball.color) : free;
    const pool = matching.length > 0 ? matching : free;
    const pick = pool[Math.floor(machine.random() * pool.length)]!;
    free.splice(free.indexOf(pick), 1);
    ball.number = pick;
    if (columns) ball.color = Math.floor((pick - 1) / 15);
  }
}
