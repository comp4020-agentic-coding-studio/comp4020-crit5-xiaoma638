// The whole game as a pure state machine: no DOM, no timers, no ambient
// randomness. `step` is the only thing that advances time, and it takes the
// elapsed milliseconds as an argument, so a test can play a whole round in a
// loop without waiting for one. The seed travels in the state rather than in a
// closure, so stepping the same state twice gives the same answer twice.
//
// A foe's position is one number, `d` --- 1 at the far end of the lane, 0 at
// the line it must not reach. Nothing in here knows whether that lane runs
// across the screen or down it; render.ts decides that, which is how the
// desktop and phone viewports share this file untouched.

export type Phase = "opening" | "playing" | "won" | "lost";

/** Each break moves the staff one step along this table. */
export const STAFF = [
  { damage: 1, cooldown: 250 },
  { damage: 2, cooldown: 180 },
  { damage: 4, cooldown: 120 },
] as const;

/** Hits to break each crystal, in the order they rise. */
export const SEALS = [5, 10, 18] as const;

/** Ceilings decided before the loop, not after a slow frame. */
export const MAX_FOES = 12;
export const MAX_EFFECTS = 24;

/** Foes to see off once the last seal breaks. */
export const SURGE = 8;

export const SEAL_D = 0.5;

const HURT_MS = 120;
const BEAM_MS = 110;
const SHARD_MS = 620;

/** Spawn gap, easing down as the round goes on. */
const GAP_FROM = 2200;
const GAP_TO = 900;
const GAP_EASE_MS = 90_000;

type Kind = { speed: number; hp: number };

const KINDS: Kind[] = [
  { speed: 0.09, hp: 1 },
  { speed: 0.14, hp: 1 },
  { speed: 0.06, hp: 3 },
];

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

export interface Beam {
  id: number;
  to: number;
  life: number;
}

export interface Shard {
  id: number;
  d: number;
  life: number;
}

export interface Game {
  phase: Phase;
  staff: number;
  cooldown: number;
  foes: Foe[];
  seal: Seal | null;
  broken: number;
  beams: Beam[];
  shards: Shard[];
  spawnTimer: number;
  /** Foes still to be sent once the last seal breaks; -1 until then. */
  surgeLeft: number;
  /** False until the first foe falls --- the opening highlight watches this. */
  taught: boolean;
  elapsed: number;
  nextId: number;
  seed: number;
}

export type Input = { kind: "foe"; id: number } | { kind: "seal" } | null;

function nextRandom(seed: number): [number, number] {
  const s = (seed * 1664525 + 1013904223) >>> 0;
  return [s / 0x100000000, s];
}

export function initial(seed = 1): Game {
  return {
    phase: "opening",
    staff: 0,
    cooldown: 0,
    // One slow foe, alone, so there is something to act on and time to find it.
    foes: [{ id: 1, d: 1, speed: 0.035, hp: 1, maxHp: 1, hurt: 0 }],
    seal: null,
    broken: 0,
    beams: [],
    shards: [],
    spawnTimer: GAP_FROM,
    surgeLeft: -1,
    taught: false,
    elapsed: 0,
    nextId: 2,
    seed,
  };
}

function raise(index: number, id: number): Seal {
  return { id, index, hp: SEALS[index], maxHp: SEALS[index], hurt: 0 };
}

/** Newest wins once a pool is full: an old beam is worth less than a new one. */
function pooled<T>(list: T[], item: T): T[] {
  const next = [...list, item];
  return next.length > MAX_EFFECTS ? next.slice(next.length - MAX_EFFECTS) : next;
}

export function step(g: Game, input: Input, dtMs: number): Game {
  const dt = dtMs / 1000;
  let {
    phase,
    staff,
    cooldown,
    foes,
    seal,
    broken,
    beams,
    shards,
    spawnTimer,
    surgeLeft,
    taught,
    nextId,
    seed,
  } = g;

  cooldown = Math.max(0, cooldown - dtMs);

  const live = phase === "opening" || phase === "playing";

  // --- what the player spent this frame's shot on -------------------------
  if (live && input && cooldown <= 0) {
    const { damage } = STAFF[staff];

    if (input.kind === "foe") {
      const target = foes.find((f) => f.id === input.id);
      if (target) {
        foes = foes.map((f) =>
          f.id === target.id ? { ...f, hp: f.hp - damage, hurt: HURT_MS } : f,
        );
        beams = pooled(beams, { id: nextId++, to: target.d, life: BEAM_MS });
        cooldown = STAFF[staff].cooldown;
      }
    } else if (input.kind === "seal" && seal) {
      const hp = seal.hp - damage;
      beams = pooled(beams, { id: nextId++, to: SEAL_D, life: BEAM_MS });
      cooldown = STAFF[staff].cooldown;

      if (hp <= 0) {
        // The hit that empties a seal is the one that arms the staff.
        broken += 1;
        staff = Math.min(staff + 1, STAFF.length - 1);
        for (let i = 0; i < 6; i++) {
          shards = pooled(shards, { id: nextId++, d: SEAL_D, life: SHARD_MS });
        }
        seal = broken < SEALS.length ? raise(broken, nextId++) : null;
        if (broken >= SEALS.length) surgeLeft = SURGE;
      } else {
        seal = { ...seal, hp, hurt: HURT_MS };
      }
    }
  }

  // --- the lane -----------------------------------------------------------
  if (live) {
    foes = foes.map((f) => ({
      ...f,
      d: Math.max(0, f.d - f.speed * dt),
      hurt: Math.max(0, f.hurt - dtMs),
    }));

    if (foes.some((f) => f.d <= 0)) phase = "lost";

    const felled = foes.filter((f) => f.hp <= 0);
    if (felled.length > 0) {
      foes = foes.filter((f) => f.hp > 0);
      if (!taught) {
        // First foe down: the lesson landed, so the seal can rise.
        taught = true;
        phase = phase === "lost" ? "lost" : "playing";
        seal = raise(0, nextId++);
      }
    }
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
          speed: surging ? kind.speed * 1.25 : kind.speed,
          hp: kind.hp,
          maxHp: kind.hp,
          hurt: 0,
        },
      ];
      if (surging) surgeLeft -= 1;

      const ease = Math.min(1, g.elapsed / GAP_EASE_MS);
      spawnTimer = (GAP_FROM + (GAP_TO - GAP_FROM) * ease) * (surging ? 0.55 : 1);
    }
  }

  if (phase === "playing" && surgeLeft === 0 && foes.length === 0) phase = "won";

  // --- effects age out ----------------------------------------------------
  beams = beams
    .map((b) => ({ ...b, life: b.life - dtMs }))
    .filter((b) => b.life > 0);
  shards = shards
    .map((s) => ({ ...s, life: s.life - dtMs }))
    .filter((s) => s.life > 0);

  return {
    phase,
    staff,
    cooldown,
    foes,
    seal,
    broken,
    beams,
    shards,
    spawnTimer,
    surgeLeft,
    taught,
    elapsed: g.elapsed + dtMs,
    nextId,
    seed,
  };
}
