// The whole game as a pure state machine: no DOM, no timers, no ambient
// randomness. `step` is the only thing that advances time, and it takes the
// elapsed milliseconds as an argument, so a test can play a whole round in a
// loop without waiting for one. The seed travels in the state rather than in a
// closure, so stepping the same state twice gives the same answer twice.
//
// Everything on the lane carries one number, `d` --- 0 at the line your squad
// holds, 1 at the far end shades walk in from. Nothing in here knows whether
// that lane runs across the screen or down it; render.ts decides that, which
// is how the desktop and phone viewports share this file untouched.
//
// The squad fires on its own. The player's whole input is where that fire
// points, so the cost of going for the crystal is a stretch of time with
// nothing shooting at what's walking in.

export type Phase = "playing" | "won" | "lost";

export type Target = { kind: "foe"; id: number } | { kind: "seal" };
/** Null means the squad falls back to whatever is closest. */
export type Focus = Target | null;
export type Input = Focus;

/** Hits to break each crystal, in the order they rise. */
export const SEALS = [36, 70, 110] as const;

/** Where the squad starts. */
export const SQUAD_START = 2;

/** How many a break frees. Two, because the jump has to be seen, not counted. */
export const PER_BREAK = 2;

/** Ceilings decided before the loop, not after a slow frame. */
export const MAX_FOES = 14;
export const MAX_BULLETS = 40;
export const MAX_SHARDS = 24;

/** Shades to see off once the last crystal breaks. */
export const SURGE = 12;

export const SEAL_D = 0.52;

/** Seconds of lane a bullet covers per second. */
const BULLET_SPEED = 1.05;
const FIRE_MS = 470;
const HURT_MS = 110;
export const SHARD_MS = 620;

const GAP_FROM = 2600;
const GAP_TO = 900;
const GAP_EASE_MS = 80_000;

type Kind = { speed: number; hp: number };

const KINDS: Kind[] = [
  { speed: 0.072, hp: 6 },
  { speed: 0.105, hp: 6 },
  { speed: 0.048, hp: 14 },
];

export interface Ally {
  id: number;
  slot: number;
  cooldown: number;
}

export interface Foe {
  id: number;
  d: number;
  speed: number;
  hp: number;
  maxHp: number;
  hurt: number;
}

export interface Seal {
  id: number;
  index: number;
  hp: number;
  maxHp: number;
  hurt: number;
}

export interface Bullet {
  id: number;
  d: number;
  target: Target;
}

export interface Shard {
  id: number;
  life: number;
}

export interface Game {
  phase: Phase;
  /** True once the first shade is down --- what lets the first crystal rise. */
  opened: boolean;
  allies: Ally[];
  foes: Foe[];
  bullets: Bullet[];
  seal: Seal | null;
  broken: number;
  focus: Focus;
  shards: Shard[];
  spawnTimer: number;
  surgeLeft: number;
  elapsed: number;
  nextId: number;
  seed: number;
}

function nextRandom(seed: number): [number, number] {
  const s = (seed * 1664525 + 1013904223) >>> 0;
  return [s / 0x100000000, s];
}

export function initial(seed = 1): Game {
  return {
    phase: "playing",
    opened: false,
    allies: Array.from({ length: SQUAD_START }, (_, i) => ({
      id: 1000 + i,
      slot: i,
      // Staggered, so the squad reads as several people rather than one gun.
      cooldown: FIRE_MS * (0.3 + i * 0.25),
    })),
    // One shade, walking in slowly and alone: the squad shoots at it without
    // being asked, which is the whole lesson.
    foes: [{ id: 2, d: 1, speed: 0.05, hp: 5, maxHp: 5, hurt: 0 }],
    bullets: [],
    seal: null,
    broken: 0,
    focus: null,
    shards: [],
    spawnTimer: GAP_FROM,
    surgeLeft: -1,
    elapsed: 0,
    nextId: 3,
    seed,
  };
}

function raise(index: number, id: number): Seal {
  return { id, index, hp: SEALS[index], maxHp: SEALS[index], hurt: 0 };
}

function capped<T>(list: T[], ceiling: number): T[] {
  return list.length > ceiling ? list.slice(list.length - ceiling) : list;
}

/** Where a target sits right now, or null if it is already gone. */
function targetD(g: Game, t: Target): number | null {
  if (t.kind === "seal") return g.seal ? SEAL_D : null;
  return g.foes.find((f) => f.id === t.id)?.d ?? null;
}

/** What the squad is actually shooting at: your call, else what's closest. */
export function aim(g: Game): Target | null {
  if (g.focus && targetD(g, g.focus) !== null) return g.focus;
  let nearest: Foe | null = null;
  for (const f of g.foes) if (!nearest || f.d < nearest.d) nearest = f;
  return nearest ? { kind: "foe", id: nearest.id } : null;
}

export function step(g: Game, input: Input, dtMs: number): Game {
  const dt = dtMs / 1000;
  let {
    phase,
    opened,
    allies,
    foes,
    bullets,
    seal,
    broken,
    focus,
    shards,
    spawnTimer,
    surgeLeft,
    nextId,
    seed,
  } = g;

  if (phase !== "playing") {
    return { ...g, elapsed: g.elapsed + dtMs };
  }

  // --- where you pointed --------------------------------------------------
  if (input !== null) focus = input;
  if (focus && targetD(g, focus) === null) focus = null;

  const at = aim({ ...g, focus });

  // --- the squad fires on its own ----------------------------------------
  allies = allies.map((a) => {
    const cooldown = a.cooldown - dtMs;
    if (cooldown > 0 || !at) return { ...a, cooldown };
    bullets = [...bullets, { id: nextId++, d: 0, target: at }];
    return { ...a, cooldown: cooldown + FIRE_MS };
  });
  bullets = capped(bullets, MAX_BULLETS);

  // --- bullets travel, and land ------------------------------------------
  const survived: Bullet[] = [];
  for (const b of bullets) {
    const d = b.d + BULLET_SPEED * dt;
    const where = targetD({ ...g, foes, seal }, b.target);

    if (where === null) continue; // whatever it was aimed at is already gone
    if (d < where) {
      survived.push({ ...b, d });
      continue;
    }

    const t = b.target;
    if (t.kind === "foe") {
      foes = foes.map((f) => (f.id === t.id ? { ...f, hp: f.hp - 1, hurt: HURT_MS } : f));
    } else if (seal) {
      const hp = seal.hp - 1;
      if (hp > 0) {
        seal = { ...seal, hp, hurt: HURT_MS };
      } else {
        // The hit that empties a crystal is the one that frees someone.
        broken += 1;
        for (let k = 0; k < PER_BREAK; k++) {
          allies = [...allies, { id: nextId++, slot: allies.length, cooldown: k * 190 }];
        }
        for (let i = 0; i < 7; i++) {
          shards = [...shards, { id: nextId++, life: SHARD_MS }];
        }
        shards = capped(shards, MAX_SHARDS);
        seal = broken < SEALS.length ? raise(broken, nextId++) : null;
        if (broken >= SEALS.length) surgeLeft = SURGE;
        focus = null;
      }
    }
  }
  bullets = survived;

  // --- the lane -----------------------------------------------------------
  foes = foes.map((f) => ({
    ...f,
    d: Math.max(0, f.d - f.speed * dt),
    hurt: Math.max(0, f.hurt - dtMs),
  }));

  if (foes.some((f) => f.d <= 0)) phase = "lost";

  const standing = foes.length;
  foes = foes.filter((f) => f.hp > 0);
  if (foes.length < standing && !opened) {
    // The squad has now shown what it does unasked. Only then is there a
    // choice worth putting in front of anyone.
    opened = true;
    seal = raise(0, nextId++);
  }

  // --- who arrives next ---------------------------------------------------
  if (phase === "playing" && surgeLeft !== 0) {
    spawnTimer -= dtMs;
    if (spawnTimer <= 0 && foes.length < MAX_FOES) {
      const [roll, s1] = nextRandom(seed);
      seed = s1;
      const kind = KINDS[Math.floor(roll * KINDS.length)];
      const surging = surgeLeft > 0;
      foes = [
        ...foes,
        {
          id: nextId++,
          d: 1,
          speed: surging ? kind.speed * 1.2 : kind.speed,
          hp: kind.hp,
          maxHp: kind.hp,
          hurt: 0,
        },
      ];
      if (surging) surgeLeft -= 1;

      const ease = Math.min(1, g.elapsed / GAP_EASE_MS);
      spawnTimer = (GAP_FROM + (GAP_TO - GAP_FROM) * ease) * (surging ? 0.5 : 1);
    }
  }

  if (phase === "playing" && surgeLeft === 0 && foes.length === 0) phase = "won";

  shards = shards
    .map((s) => ({ ...s, life: s.life - dtMs }))
    .filter((s) => s.life > 0);

  return {
    phase,
    opened,
    allies,
    foes,
    bullets,
    seal,
    broken,
    focus,
    shards,
    spawnTimer,
    surgeLeft,
    elapsed: g.elapsed + dtMs,
    nextId,
    seed,
  };
}
