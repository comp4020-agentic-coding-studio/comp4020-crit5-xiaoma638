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

/** The drones are asleep in their bay from the first frame. Cheese wakes one:
    ears, eyes, a stretch, out of the bay, nose to the floor, and only then does
    it follow. Nothing before "hunting" can touch anyone --- and none of it is
    a system announcing a spawn, it is an animal being woken by a noise. */
export type DroneState = "docked" | "booting" | "leaving" | "locking" | "hunting";

export interface Drone {
  id: number;
  /** Seconds behind you it reads the trail. */
  delay: number;
  state: DroneState;
  /** Seconds spent in the current stage. */
  stateFor: number;
  /** Elapsed time when it woke. The prints it will follow start here. */
  anchor: number;
  /** Which charging slot it sits in, and where that slot is. */
  slot: number;
  from: Vec;
  /** Live position while it is driving out. Null until it undocks. */
  pos: Vec | null;
  /** True once it can actually catch you. */
  live: boolean;
}

// Arriving takes exactly as long as the drone runs behind you, split three ways.
// That is not decoration: it means the moment its nose comes up, the prints it
// has been standing over are the ones it starts to follow, with no jump.
export function stageLength(drone: Drone, state: DroneState): number {
  return state === "booting" ? BOOTING_S : state === "locking" ? LOCKING_S : 0;
}

/** Just clear of the cradle: where a drone waits if the trace is not ready.
    Never back inside the bay --- a drone that reverses onto its charger reads
    as broken, which is exactly what it was. */
export function entryFor(g: Game, drone: Drone): Vec {
  const slot = slotAt(g.world, drone.slot, DELAYS.length);
  return { x: slot.x + 0.22, y: slot.y };
}

/** The spot on the trace a launching drone is driving to: where the player was
    `delay` ago, which is the cold end of the trace and therefore nowhere near
    them. Driving to where they picked the gem up meant crossing straight over
    whoever had not moved since. */
export function launchTarget(g: Game, drone: Drone): Vec {
  return sample(g.trail, g.elapsed - drone.delay) ?? g.trail[0] ?? entryFor(g, drone);
}

/** The security bay, along the left wall. */
export function bayAt(world: Vec): Vec {
  return { x: world.x * 0.1, y: world.y * 0.5 };
}

/** Charging slots run down the bay, so an empty one is countable. */
export function slotAt(world: Vec, slot: number, of: number): Vec {
  const bay = bayAt(world);
  return { x: bay.x, y: bay.y + (slot - (of - 1) / 2) * world.y * 0.13 };
}

export interface Gem {
  x: number;
  y: number;
  born: number;
}

export type Spark = "gem" | "caught" | "won" | "lure";

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
/** How many drones belong at a given count: the first after one piece of cheese,
    then another every second piece after that. */
export function dronesDue(score: number): number {
  return score < 1 ? 0 : Math.min(DELAYS.length, 1 + Math.floor((score - 1) / 2));
}

export const PLAYER_HIT = 0.02;
export const DRONE_HIT = 0.017;
export const GEM_HIT = 0.032;

/** Drawn a little larger than they catch, so a near miss reads as a near miss. */
export const PLAYER_DRAW = 0.027;
export const DRONE_DRAW = 0.027;

/** How far behind each one reads the trail. The first hangs well back: it is
    the one that has to be understood rather than survived. */
export const DELAYS = [3, 2.2, 1.8, 1.5] as const;

/** It drives out at a shade under your pace, so the crossing is watchable and
    the first one cannot beat you to anywhere. */
export const DRONE_SPEED = 0.33;

/** Crossing the hall to reach the trace. A shade above the player's pace, or a
    moving target could never be reached at all. */
export const LAUNCH_SPEED = 0.52;

/** Powering up in the cradle. The drive out then takes as long as it takes. */
const BOOTING_S = 0.9;
/** Scanner down on the trace, at minimum. */
const LOCKING_S = 0.7;

/** It will not start hunting while it is this close to you, however long it has
    waited. Starting on top of someone is not difficulty, it is a coin toss they
    lose. */
export const SAFE_WAKE = 0.17;

/** A mouse runs; it does not teleport. Chasing the cursor at a fixed pace is
    what gives distance a cost and dodging a technique --- glued to the pointer,
    any drone can be escaped by flicking the wrist, and the round is over in
    seconds because crossing the room is free. */
const RUN = 0.42;
/** Eases to a stop inside this, so it settles instead of jittering. */
const ARRIVE = 0.05;

// Must outlast the longest delay any drone can end up with, and a drone that
// drove the length of the hall adopts however long that drive took. Keep less
// than that and `sample` returns null for the trace it is standing on, which
// silently pins it wherever the fallback points.
const TRAIL_KEEP_MS = 12_000;
const MAX_PARTICLES = 180;
const MAX_RINGS = 12;

const GEM_MARGIN = 0.13;
const GEM_MIN_FROM_PLAYER = 0.34;
const GEM_MAX_FROM_PLAYER = 0.95;
const GEM_MIN_FROM_DRONE = 0.17;

export interface Game {
  phase: Phase;
  /** Distance covered on foot, which drives the walk cycle. */
  stride: number;
  /** Which way the comet points. Radians. */
  heading: number;
  /** Milliseconds left of the trail lighting up after a gem. */
  flash: number;
  /** Seconds until the gem throws another thread towards the player. */
  lureIn: number;
  /** Seconds of play. Pausing stops this, so the drones stay in step. */
  elapsed: number;
  player: Vec;
  target: Vec;
  trail: TrailPoint[];
  drones: Drone[];
  gem: Gem | null;
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

/** Where a drone is on screen, through all four stages of arriving. */
export function droneAt(g: Game, drone: Drone): Vec | null {
  if (drone.state === "docked" || drone.state === "booting") {
    return slotAt(g.world, drone.slot, DELAYS.length);
  }

  // Where the trace it was sent for begins. It drives to that spot and holds
  // over it; by the time its scanner comes up, the trail has caught up to the
  // same place, so following starts without a jump.
  const start = drone.pos ?? sample(g.trail, g.elapsed - drone.delay) ?? entryFor(g, drone);

  if (drone.state === "leaving") return drone.pos ?? slotAt(g.world, drone.slot, DELAYS.length);
  if (drone.state === "locking") return start;
  // Out on the floor and waiting is fine; reversing into the charger is not.
  return sample(g.trail, g.elapsed - drone.delay) ?? entryFor(g, drone);
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
    stride: 0,
    heading: 0,
    flash: 0,
    lureIn: 0.25,
    elapsed: 0,
    player: { ...player },
    target: { ...player },
    trail: [{ x: player.x, y: player.y, t: 0 }],
    // All of them, asleep in the bay. Visible from the first frame, which is
    // its own kind of warning, and harmless until something wakes one.
    drones: DELAYS.map((delay, i) => ({
      id: 10 + i,
      delay,
      state: "docked" as DroneState,
      stateFor: i * 0.7,
      anchor: 0,
      slot: i,
      from: bayAt(world),
      pos: null,
      live: false,
    })),
    // Close enough that it is taken almost by accident, which is the lesson.
    gem: { x: player.x + 0.19, y: player.y - 0.1, born: 0 },
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

function placeGem(g: Game, drones: Vec[]): [Gem, number] {
  let seed = g.seed;
  let best: Gem | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < 40; attempt++) {
    const [rx, s1] = random(seed);
    const [ry, s2] = random(s1);
    seed = s2;

    const x = GEM_MARGIN + rx * (g.world.x - GEM_MARGIN * 2);
    const y = GEM_MARGIN + ry * (g.world.y - GEM_MARGIN * 2);
    const here = { x, y };

    const fromPlayer = Math.hypot(x - g.player.x, y - g.player.y);
    if (fromPlayer < GEM_MIN_FROM_PLAYER || fromPlayer > GEM_MAX_FROM_PLAYER) continue;

    let nearestDrone = Infinity;
    for (const s of drones) nearestDrone = Math.min(nearestDrone, Math.hypot(x - s.x, y - s.y));
    if (nearestDrone < GEM_MIN_FROM_DRONE) continue;

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
      x: GEM_MARGIN + rx * (g.world.x - GEM_MARGIN * 2),
      y: GEM_MARGIN + ry * (g.world.y - GEM_MARGIN * 2),
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
    gem: g.gem ? { ...g.gem } : null,
    player: { ...g.player },
    target: { ...g.target },
    world: input.world ? { ...input.world } : { ...g.world },
    trail: g.trail,
    drones: g.drones,
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
    next.stride = g.stride + move;
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

  const here = next.drones
    .map((s) => droneAt(next, s))
    .filter((p): p is Vec => p !== null);

  // Each drone walks its arrival forward. Nothing before "hunting" can touch
  // anyone, and hunting itself waits until the drone is clear of the player: a
  // drone reads the prints exactly, so the spot it is on is a spot the player
  // stood in, and pausing after cheese is the most natural thing anyone does.
  next.drones = next.drones.map((drone, i) => {
    const stateFor = drone.stateFor + dt;
    // Docked is not a stage that times out --- only an alarm ends it.
    if (drone.state === "docked") return { ...drone, stateFor };

    if (drone.state === "booting") {
      return stateFor < BOOTING_S
        ? { ...drone, stateFor }
        : {
            ...drone,
            state: "leaving" as DroneState,
            stateFor: 0,
            pos: slotAt(next.world, drone.slot, DELAYS.length),
          };
    }

    if (drone.state === "leaving") {
      // It drives, a frame at a time, and arriving is what ends this stage ---
      // not a timer, so a long crossing takes long and is watched the whole way.
      const from = drone.pos ?? slotAt(next.world, drone.slot, DELAYS.length);
      const target = launchTarget(next, drone);
      const dx = target.x - from.x;
      const dy = target.y - from.y;
      const far = Math.hypot(dx, dy);
      if (far <= LAUNCH_SPEED * dt * 1.5) {
        return { ...drone, state: "locking" as DroneState, stateFor: 0, pos: target };
      }
      const move = LAUNCH_SPEED * dt;
      return {
        ...drone,
        stateFor,
        pos: { x: from.x + (dx / far) * move, y: from.y + (dy / far) * move },
      };
    }

    if (drone.state === "locking") {
      // It is already standing on the trace it will follow, `delay` behind, so
      // hunting picks up exactly where the scan stopped.
      return stateFor >= LOCKING_S
        ? { ...drone, state: "hunting" as DroneState, stateFor: 0, pos: null }
        : { ...drone, stateFor };
    }
    if (drone.live) return { ...drone, stateFor };
    const at = here[i];
    if (!at) return { ...drone, stateFor };
    const gap = Math.hypot(at.x - next.player.x, at.y - next.player.y);
    return gap < SAFE_WAKE ? { ...drone, stateFor } : { ...drone, stateFor, live: true };
  });

  // Caught by where you have already been.
  for (const [i, drone] of next.drones.entries()) {
    const at = here[i];
    if (!at || !drone.live) continue;
    if (overlaps(next.player, PLAYER_HIT, at, DRONE_HIT)) {
      next.phase = "lost";
      next.endedAt = next.elapsed;
      burst(next, next.player, "caught", 26);
      next.shake = 420;
      return next;
    }
  }

  if (next.gem) {
    // The gem leans towards whoever is close, and keeps throwing threads of
    // itself their way. Nothing here says "collect me"; it just behaves like
    // something that wants to be reached.
    const reach = Math.hypot(next.player.x - next.gem.x, next.player.y - next.gem.y);
    if (reach < 0.24 && reach > 0.001) {
      const pull = (1 - reach / 0.24) * 1.1 * dt;
      next.gem.x += (next.player.x - next.gem.x) * pull;
      next.gem.y += (next.player.y - next.gem.y) * pull;
    }

    next.lureIn -= dt;
    if (next.lureIn <= 0) {
      next.lureIn = 0.22;
      const away = Math.atan2(next.player.y - next.gem.y, next.player.x - next.gem.x);
      next.particles = [
        ...next.particles,
        {
          x: next.gem.x,
          y: next.gem.y,
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

  if (next.gem && overlaps(next.player, PLAYER_HIT, next.gem, GEM_HIT)) {
    // The first one is the whole lesson, so it lands twice as hard.
    burst(next, next.gem, "gem", g.score === 0 ? 30 : 16);
    next.score = g.score + 1;
    // And the route lights up, a beat before something starts walking it.
    next.flash = g.score === 0 ? 1400 : 850;
    next.lureIn = 0.25;

    if (next.score >= WIN_AT) {
      next.phase = "won";
      next.endedAt = next.elapsed;
      next.gem = null;
      burst(next, next.player, "won", 40);
      return next;
    }

    // The noise wakes one of them. Nothing is created; something opens an eye.
    const awake = next.drones.filter((c) => c.state !== "docked").length;
    if (awake < dronesDue(next.score)) {
      let woken = false;
      next.drones = next.drones.map((c) => {
        if (woken || c.state !== "docked") return c;
        woken = true;
        return { ...c, state: "booting" as DroneState, stateFor: 0, anchor: next.elapsed };
      });
    }

    const [gem, seed] = placeGem(next, here);
    next.gem = gem;
    next.seed = seed;
  }

  return next;
}
