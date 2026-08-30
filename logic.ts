// The whole game as data plus one pure step. No DOM, no timers, no ambient
// randomness: `step` takes the elapsed milliseconds, and the seed travels in
// the state, so a test can play a round in a loop and get the same round twice.
//
// Space is measured in short-side units: 1.0 is the shorter edge of the board,
// whichever that is. Every radius and speed below is written in those units, so
// a phone and a monitor get the same game rather than the same pixels.

export interface Vec {
  x: number;
  y: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

/** A cat arrives in stages, and none of the early ones can touch you: eyes at
    the edge first, then it comes in, then its nose goes down on the prints ---
    only after all that does it start following them. */
export type CatState = "looming" | "entering" | "sniffing" | "tracking";

export interface Cat {
  id: number;
  /** Seconds behind you it reads the trail. */
  delay: number;
  state: CatState;
  /** Seconds spent in the current stage. */
  stateFor: number;
  /** Elapsed time when it was sent. The prints it will follow start here. */
  anchor: number;
  /** Just off the edge, where it comes in from. */
  from: Vec;
  /** True once it can actually catch you. */
  live: boolean;
}

// Arriving takes exactly as long as the cat runs behind you, split three ways.
// That is not decoration: it means the moment its nose comes up, the prints it
// has been standing over are the ones it starts to follow, with no jump.
const LOOMING = 0.42;
const ENTERING = 0.24;
const SNIFFING = 0.34;

export function stageLength(cat: Cat, state: CatState): number {
  const share = state === "looming" ? LOOMING : state === "entering" ? ENTERING : SNIFFING;
  return cat.delay * share;
}

export interface Star {
  x: number;
  y: number;
  born: number;
}

export type Spark = "star" | "caught" | "won" | "lure";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: Spark;
}

export interface Ring {
  x: number;
  y: number;
  life: number;
  max: number;
  kind: Spark;
}

export type Phase = "playing" | "lost" | "won";

export const WIN_AT = 8;
/** How many cats belong at a given count: the first after one piece of cheese,
    then another every second piece after that. */
export function catsDue(score: number): number {
  return score < 1 ? 0 : Math.min(DELAYS.length, 1 + Math.floor((score - 1) / 2));
}

export const PLAYER_HIT = 0.02;
export const CAT_HIT = 0.02;
export const STAR_HIT = 0.032;

/** Drawn a little larger than they catch, so a near miss reads as a near miss. */
export const PLAYER_DRAW = 0.027;
export const CAT_DRAW = 0.027;

/** How far behind each one reads the trail. The first hangs well back: it is
    the one that has to be understood rather than survived. */
export const DELAYS = [2.5, 1.9, 1.5, 1.3] as const;

/** It will not start hunting while it is this close to you, however long it has
    waited. Starting on top of someone is not difficulty, it is a coin toss they
    lose. */
export const SAFE_WAKE = 0.17;

/** A mouse runs; it does not teleport. Chasing the cursor at a fixed pace is
    what gives distance a cost and dodging a technique --- glued to the pointer,
    any cat can be escaped by flicking the wrist, and the round is over in
    seconds because crossing the room is free. */
const RUN = 0.42;
/** Eases to a stop inside this, so it settles instead of jittering. */
const ARRIVE = 0.05;

const TRAIL_KEEP_MS = 2600;
const MAX_PARTICLES = 180;
const MAX_RINGS = 12;

const STAR_MARGIN = 0.13;
const STAR_MIN_FROM_PLAYER = 0.34;
const STAR_MAX_FROM_PLAYER = 0.95;
const STAR_MIN_FROM_SHADE = 0.17;

export interface Game {
  phase: Phase;
  /** Which way the comet points. Radians. */
  heading: number;
  /** Milliseconds left of the trail lighting up after a star. */
  flash: number;
  /** Seconds until the star throws another thread towards the player. */
  lureIn: number;
  /** Seconds of play. Pausing stops this, so the cats stay in step. */
  elapsed: number;
  player: Vec;
  target: Vec;
  trail: TrailPoint[];
  cats: Cat[];
  star: Star | null;
  score: number;
  particles: Particle[];
  rings: Ring[];
  shake: number;
  endedAt: number;
  world: Vec;
  nextId: number;
  seed: number;
}

/** The rule the whole game turns on, on its own so it can be tested alone. */
export function overlaps(a: Vec, ar: number, b: Vec, br: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const reach = ar + br;
  // Strictly inside: grazing at exactly the sum of the radii is a near miss,
  // which is the call that makes a fast pass feel fair rather than cheap.
  return dx * dx + dy * dy < reach * reach;
}

function random(seed: number): [number, number] {
  const s = (seed * 1664525 + 1013904223) >>> 0;
  return [s / 0x100000000, s];
}

/** Where a cat is on screen, through all four stages of arriving. */
export function catAt(g: Game, cat: Cat): Vec | null {
  if (cat.state === "looming") return cat.from;

  // Where the prints it was sent for begin. It walks to that spot and waits
  // over it; by the time it looks up, the trail has caught up to the same
  // place, so following starts without a jump.
  const start = sample(g.trail, cat.anchor) ?? cat.from;

  if (cat.state === "entering") {
    const t = Math.min(1, cat.stateFor / stageLength(cat, "entering"));
    const eased = t * t * (3 - 2 * t);
    return {
      x: cat.from.x + (start.x - cat.from.x) * eased,
      y: cat.from.y + (start.y - cat.from.y) * eased,
    };
  }
  if (cat.state === "sniffing") return start;
  return sample(g.trail, g.elapsed - cat.delay) ?? start;
}

/** Just off whichever edge is nearest, so it comes in from the room. */
function edgeNear(p: Vec, world: Vec): Vec {
  const gaps = [p.x, world.x - p.x, p.y, world.y - p.y];
  const nearest = Math.min(...gaps);
  if (nearest === gaps[0]) return { x: -0.07, y: p.y };
  if (nearest === gaps[1]) return { x: world.x + 0.07, y: p.y };
  if (nearest === gaps[2]) return { x: p.x, y: -0.07 };
  return { x: p.x, y: world.y + 0.07 };
}

/** The trail, read at a moment in time. Null before the trail reaches back. */
export function sample(trail: TrailPoint[], t: number): Vec | null {
  if (trail.length === 0 || t < trail[0].t) return null;
  for (let i = trail.length - 1; i >= 0; i--) {
    const a = trail[i];
    if (a.t > t) continue;
    const b = trail[i + 1];
    if (!b || b.t === a.t) return { x: a.x, y: a.y };
    const f = (t - a.t) / (b.t - a.t);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  return null;
}

export function initial(world: Vec = { x: 1.6, y: 1 }, seed = 1): Game {
  const player = { x: world.x / 2, y: world.y / 2 };
  return {
    phase: "playing",
    heading: 0,
    flash: 0,
    lureIn: 0.25,
    elapsed: 0,
    player: { ...player },
    target: { ...player },
    trail: [{ x: player.x, y: player.y, t: 0 }],
    // None yet. Nothing hunts you until you have taken something.
    cats: [],
    // Close enough that it is taken almost by accident, which is the lesson.
    star: { x: player.x + 0.19, y: player.y - 0.1, born: 0 },
    score: 0,
    particles: [],
    rings: [],
    shake: 0,
    endedAt: 0,
    world: { ...world },
    nextId: 2,
    seed,
  };
}

function placeStar(g: Game, cats: Vec[]): [Star, number] {
  let seed = g.seed;
  let best: Star | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < 40; attempt++) {
    const [rx, s1] = random(seed);
    const [ry, s2] = random(s1);
    seed = s2;

    const x = STAR_MARGIN + rx * (g.world.x - STAR_MARGIN * 2);
    const y = STAR_MARGIN + ry * (g.world.y - STAR_MARGIN * 2);
    const here = { x, y };

    const fromPlayer = Math.hypot(x - g.player.x, y - g.player.y);
    if (fromPlayer < STAR_MIN_FROM_PLAYER || fromPlayer > STAR_MAX_FROM_PLAYER) continue;

    let nearestShade = Infinity;
    for (const s of cats) nearestShade = Math.min(nearestShade, Math.hypot(x - s.x, y - s.y));
    if (nearestShade < STAR_MIN_FROM_SHADE) continue;

    // The first spot that clears the guards, not the safest one on the board.
    // Preferring the safest quietly routed every trip around the danger, which
    // is the opposite of a game about ground you have already covered.
    best = { x, y, born: g.elapsed };
    bestScore = 1;
    break;
  }

  if (!best) {
    const [rx, s1] = random(seed);
    const [ry, s2] = random(s1);
    seed = s2;
    best = {
      x: STAR_MARGIN + rx * (g.world.x - STAR_MARGIN * 2),
      y: STAR_MARGIN + ry * (g.world.y - STAR_MARGIN * 2),
      born: g.elapsed,
    };
  }
  return [best, seed];
}

function burst(g: Game, at: Vec, kind: Spark, count: number): void {
  let seed = g.seed;
  for (let i = 0; i < count; i++) {
    const [ra, s1] = random(seed);
    const [rs, s2] = random(s1);
    seed = s2;
    const angle = ra * Math.PI * 2;
    const speed = (0.18 + rs * 0.5) * (kind === "won" ? 1.4 : 1);
    g.particles.push({
      x: at.x,
      y: at.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: kind === "won" ? 1500 : 620,
      max: kind === "won" ? 1500 : 620,
      kind,
    });
  }
  if (g.particles.length > MAX_PARTICLES) {
    g.particles.splice(0, g.particles.length - MAX_PARTICLES);
  }
  g.rings.push({ x: at.x, y: at.y, life: 480, max: 480, kind });
  if (g.rings.length > MAX_RINGS) g.rings.splice(0, g.rings.length - MAX_RINGS);
  g.seed = seed;
}

export interface Input {
  /** Where the pointer or the keys want the player to be. */
  target?: Vec;
  /** Board shape, in short-side units. */
  world?: Vec;
}

export function step(g: Game, input: Input, dtMs: number): Game {
  const dt = dtMs / 1000;
  const next: Game = {
    ...g,
    star: g.star ? { ...g.star } : null,
    player: { ...g.player },
    target: { ...g.target },
    world: input.world ? { ...input.world } : { ...g.world },
    trail: g.trail,
    cats: g.cats,
    particles: g.particles.map((p) => ({ ...p })),
    rings: g.rings.map((r) => ({ ...r })),
  };

  // Effects keep running after the round is over --- that is the ending.
  for (const p of next.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - Math.min(1, 2.2 * dt);
    p.vy *= 1 - Math.min(1, 2.2 * dt);
    p.life -= dtMs;
  }
  next.particles = next.particles.filter((p) => p.life > 0);
  for (const r of next.rings) r.life -= dtMs;
  next.rings = next.rings.filter((r) => r.life > 0);
  next.shake = Math.max(0, next.shake - dtMs);
  next.flash = Math.max(0, next.flash - dtMs);

  if (g.phase !== "playing") return next;

  next.elapsed = g.elapsed + dt;
  if (input.target) next.target = { ...input.target };

  const dx = next.target.x - next.player.x;
  const dy = next.target.y - next.player.y;
  const far = Math.hypot(dx, dy);
  if (far > 1e-6) {
    const pace = RUN * Math.min(1, far / ARRIVE);
    const move = Math.min(far, pace * dt);
    next.player.x += (dx / far) * move;
    next.player.y += (dy / far) * move;
  }
  next.player.x = Math.min(Math.max(next.player.x, 0.02), next.world.x - 0.02);
  next.player.y = Math.min(Math.max(next.player.y, 0.02), next.world.y - 0.02);

  // Which way it is pointing, eased so a flick of the wrist does not spin it.
  const moved = Math.hypot(next.player.x - g.player.x, next.player.y - g.player.y);
  if (moved > 0.0004) {
    let turn = Math.atan2(next.player.y - g.player.y, next.player.x - g.player.x) - next.heading;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    next.heading += turn * Math.min(1, 14 * dt);
  }

  const cutoff = next.elapsed - TRAIL_KEEP_MS / 1000;
  const trail = [...g.trail, { x: next.player.x, y: next.player.y, t: next.elapsed }];
  let drop = 0;
  while (drop + 1 < trail.length && trail[drop + 1].t < cutoff) drop++;
  next.trail = drop > 0 ? trail.slice(drop) : trail;

  const here = next.cats
    .map((s) => catAt(next, s))
    .filter((p): p is Vec => p !== null);

  // Each cat walks its arrival forward. Nothing before "tracking" can touch
  // anyone, and tracking itself waits until the cat is clear of the player: a
  // cat reads the prints exactly, so the spot it is on is a spot the player
  // stood in, and pausing after cheese is the most natural thing anyone does.
  next.cats = next.cats.map((cat, i) => {
    const stateFor = cat.stateFor + dt;
    const onward: Record<string, CatState> = {
      looming: "entering",
      entering: "sniffing",
      sniffing: "tracking",
    };
    if (cat.state !== "tracking") {
      return stateFor < stageLength(cat, cat.state)
        ? { ...cat, stateFor }
        : { ...cat, state: onward[cat.state], stateFor: 0 };
    }
    if (cat.live) return { ...cat, stateFor };
    const at = here[i];
    if (!at) return { ...cat, stateFor };
    const gap = Math.hypot(at.x - next.player.x, at.y - next.player.y);
    return gap < SAFE_WAKE ? { ...cat, stateFor } : { ...cat, stateFor, live: true };
  });

  // Caught by where you have already been.
  for (const [i, cat] of next.cats.entries()) {
    const at = here[i];
    if (!at || !cat.live) continue;
    if (overlaps(next.player, PLAYER_HIT, at, CAT_HIT)) {
      next.phase = "lost";
      next.endedAt = next.elapsed;
      burst(next, next.player, "caught", 26);
      next.shake = 420;
      return next;
    }
  }

  if (next.star) {
    // The star leans towards whoever is close, and keeps throwing threads of
    // itself their way. Nothing here says "collect me"; it just behaves like
    // something that wants to be reached.
    const reach = Math.hypot(next.player.x - next.star.x, next.player.y - next.star.y);
    if (reach < 0.24 && reach > 0.001) {
      const pull = (1 - reach / 0.24) * 1.1 * dt;
      next.star.x += (next.player.x - next.star.x) * pull;
      next.star.y += (next.player.y - next.star.y) * pull;
    }

    next.lureIn -= dt;
    if (next.lureIn <= 0) {
      next.lureIn = 0.22;
      const away = Math.atan2(next.player.y - next.star.y, next.player.x - next.star.x);
      next.particles = [
        ...next.particles,
        {
          x: next.star.x,
          y: next.star.y,
          vx: Math.cos(away) * 0.2,
          vy: Math.sin(away) * 0.2,
          life: 700,
          max: 700,
          kind: "lure",
        },
      ];
      if (next.particles.length > MAX_PARTICLES) {
        next.particles.splice(0, next.particles.length - MAX_PARTICLES);
      }
    }
  }

  if (next.star && overlaps(next.player, PLAYER_HIT, next.star, STAR_HIT)) {
    // The first one is the whole lesson, so it lands twice as hard.
    burst(next, next.star, "star", g.score === 0 ? 30 : 16);
    next.score = g.score + 1;
    // And the route lights up, a beat before something starts walking it.
    next.flash = g.score === 0 ? 1400 : 850;
    next.lureIn = 0.25;

    if (next.score >= WIN_AT) {
      next.phase = "won";
      next.endedAt = next.elapsed;
      next.star = null;
      burst(next, next.player, "won", 40);
      return next;
    }

    if (next.cats.length < catsDue(next.score)) {
      const delay = DELAYS[next.cats.length];
      next.cats = [
        ...next.cats,
        {
          id: next.nextId++,
          delay,
          state: "looming",
          stateFor: 0,
          anchor: next.elapsed,
          from: edgeNear(next.player, next.world),
          live: false,
        },
      ];
    }

    const [star, seed] = placeStar(next, here);
    next.star = star;
    next.seed = seed;
  }

  return next;
}
