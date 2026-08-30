// Canvas, and nothing that decides anything. It reads the state and draws it.
//
// The board's own box is the authority on size: measured here, on resize, and
// never inside a frame. Space is in short-side units, so `unit` is the only
// number that turns the game into pixels.

import {
  bayAt,
  DELAYS,
  droneAt,
  DRONE_DRAW,
  GEM_HIT,
  PLAYER_DRAW,
  sample,
  slotAt,
  stageLength,
  type Drone,
  type Game,
  type Vec,
} from "./logic.ts";

const FLOOR = "#07070e";
const GRID = "rgba(122, 162, 220, 0.045)";
const CASE_LINE = "rgba(150, 190, 235, 0.3)";
const THIEF = "#4de3ff";
const GEM = "#ffd166";
const ALERT = "#ff3b52";
const IDLE = "#44557a";

const canvas = document.getElementById("board") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

let unit = 1;
let cssW = 0;
let cssH = 0;
let dpr = 1;
let left = 0;
let top = 0;

export function resize(): Vec {
  const rect = canvas.getBoundingClientRect();
  cssW = rect.width || 1;
  cssH = rect.height || 1;
  left = rect.left;
  top = rect.top;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  unit = Math.min(cssW, cssH);
  return { x: cssW / unit, y: cssH / unit };
}

/** A client point in game space. Reads only the cached box. */
export function toWorld(clientX: number, clientY: number): Vec {
  return { x: (clientX - left) / unit, y: (clientY - top) / unit };
}

function px(v: number): number {
  return v * unit;
}

function glow(color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function clearGlow(): void {
  ctx.shadowBlur = 0;
}

function facing(x: number, y: number, heading: number, draw: () => void): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  draw();
  ctx.restore();
}

function ellipse(x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(x: number, y: number, r: number, sides: number, turn: number): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = turn + (i / sides) * Math.PI * 2;
    const point = [x + Math.cos(a) * r, y + Math.sin(a) * r] as const;
    if (i === 0) ctx.moveTo(point[0], point[1]);
    else ctx.lineTo(point[0], point[1]);
  }
  ctx.closePath();
}

// --- the gallery ----------------------------------------------------------

/** Floor, plinths, and the security bay along one wall. Every fixture is a
    thing with a job, so the room reads as a place rather than as scenery. */
function gallery(g: Game): void {
  const world = g.world;
  ctx.fillStyle = FLOOR;
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  const tile = 0.24;
  ctx.beginPath();
  for (let x = 0; x <= world.x + tile; x += tile) {
    ctx.moveTo(px(x), 0);
    ctx.lineTo(px(x), cssH);
  }
  for (let y = 0; y <= world.y + tile; y += tile) {
    ctx.moveTo(0, px(y));
    ctx.lineTo(cssW, px(y));
  }
  ctx.stroke();

  // Pillars down the middle of the hall.
  ctx.strokeStyle = "rgba(150, 190, 235, 0.16)";
  ctx.lineWidth = px(0.01);
  for (const at of [0.32, 0.68]) {
    for (const y of [0.22, 0.78]) {
      ctx.beginPath();
      ctx.arc(px(world.x * at), px(world.y * y), px(0.055), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px(world.x * at), px(world.y * y), px(0.036), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  securityBay(g);
}

/** The bay: a lit alcove with one charging slot per drone. A slot someone has
    driven out of is visibly empty, which is how a player can tell that the
    thing chasing them is the thing that was parked there. */
function securityBay(g: Game): void {
  const bay = bayAt(g.world);
  const slots = DELAYS.length;
  const half = (g.world.y * 0.13 * slots) / 2;

  ctx.fillStyle = "rgba(28, 40, 66, 0.5)";
  ctx.fillRect(0, px(bay.y - half), px(bay.x + 0.075), px(half * 2));
  ctx.strokeStyle = "rgba(150, 190, 235, 0.28)";
  ctx.lineWidth = px(0.008);
  ctx.beginPath();
  ctx.moveTo(px(bay.x + 0.075), px(bay.y - half));
  ctx.lineTo(px(bay.x + 0.075), px(bay.y + half));
  ctx.stroke();

  for (const drone of g.drones) {
    const at = slotAt(g.world, drone.slot, slots);
    const home = drone.state === "docked" || drone.state === "booting";
    ctx.strokeStyle = home ? "rgba(150, 190, 235, 0.3)" : "rgba(255, 59, 82, 0.32)";
    ctx.lineWidth = px(0.006);
    ctx.strokeRect(px(at.x - 0.06), px(at.y - 0.05), px(0.12), px(0.1));
    if (!home) {
      // An empty cradle, still lit: that one is out on the floor.
      ctx.fillStyle = "rgba(255, 59, 82, 0.09)";
      ctx.fillRect(px(at.x - 0.06), px(at.y - 0.05), px(0.12), px(0.1));
    }
  }
}

// --- the heat the thief leaves --------------------------------------------

/** The trail as a cooling heat trace: white where it is fresh, red as it goes,
    gone soon after. A drone reads it, which is why it fades at all. */
function trace(g: Game, from: number, to: number, lit: number): void {
  const span = to - from;
  if (span <= 0) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let previous: { x: number; y: number; t: number } | null = null;
  for (const point of g.trail) {
    if (point.t < from) {
      previous = point;
      continue;
    }
    if (point.t > to) break;
    if (previous) {
      const age = (to - point.t) / span;
      const heat = 1 - age;
      ctx.strokeStyle =
        heat > 0.72
          ? "#fff2e6"
          : heat > 0.42
            ? "#ffb347"
            : heat > 0.18
              ? "#ff6a3c"
              : "#b02a34";
      ctx.globalAlpha = (0.2 + lit * 0.7) * heat * heat + 0.1 * heat;
      ctx.lineWidth = px(0.006 + heat * 0.012);
      ctx.beginPath();
      ctx.moveTo(px(previous.x), px(previous.y));
      ctx.lineTo(px(point.x), px(point.y));
      ctx.stroke();
    }
    previous = point;
  }
  ctx.globalAlpha = 1;
}

// --- the cast -------------------------------------------------------------

function thief(x: number, y: number, heading: number, near: number): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ellipse(x, y + px(0.012), px(PLAYER_DRAW) * 0.95, px(PLAYER_DRAW) * 0.4);

  facing(x, y, heading, () => {
    const r = px(PLAYER_DRAW) * 1.3;
    glow(THIEF, px(0.05 + near * 0.03));
    ctx.fillStyle = THIEF;
    // Shoulders and a head, from above.
    ellipse(-r * 0.1, 0, r * 0.78, r * 1.0);
    ellipse(r * 0.42, 0, r * 0.6, r * 0.6);
    clearGlow();
    ctx.fillStyle = "#dffbff";
    ellipse(r * 0.5, 0, r * 0.26, r * 0.26);
  });
}

function drone(g: Game, d: Drone, x: number, y: number, heading: number): void {
  const r = px(DRONE_DRAW) * 1.55;
  const docked = d.state === "docked";
  const booting = d.state === "booting";
  const woken = !docked && !booting;
  const boot = booting ? Math.min(1, d.stateFor / stageLength(d, "booting")) : 0;
  const hot = docked ? 0 : booting ? boot : 1;

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ellipse(x, y + r * 0.5, r * 0.9, r * 0.34);

  facing(x, y, heading, () => {
    // Chassis: a hexagon, so nothing about it reads as an animal.
    ctx.fillStyle = docked ? "#1b2540" : "#241a2a";
    polygon(0, 0, r, 6, 0);
    ctx.fill();
    ctx.strokeStyle = docked ? IDLE : ALERT;
    ctx.globalAlpha = 0.35 + hot * 0.65;
    ctx.lineWidth = r * 0.11;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // A scanner ring that spins once it is awake.
    const spin = woken ? g.elapsed * 3.4 : g.elapsed * 0.5;
    ctx.strokeStyle = docked ? IDLE : ALERT;
    ctx.globalAlpha = 0.25 + hot * 0.6;
    ctx.lineWidth = r * 0.09;
    ctx.setLineDash([r * 0.5, r * 0.42]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.32, spin, spin + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // The eye. Dim on the charger, a hard red once it has a trace.
    if (docked) {
      ctx.fillStyle = IDLE;
      ctx.globalAlpha = 0.5 + Math.sin(g.elapsed * 1.6 + d.id) * 0.25;
      ellipse(0, 0, r * 0.32, r * 0.32);
      ctx.globalAlpha = 1;
    } else {
      glow(ALERT, px(0.04 + hot * 0.03));
      ctx.fillStyle = ALERT;
      ellipse(0, 0, r * (0.3 + hot * 0.06), r * (0.3 + hot * 0.06));
      clearGlow();
      ctx.fillStyle = "#ffd9de";
      ellipse(r * 0.08, 0, r * 0.12, r * 0.12);
    }

    // Locking on: a scanning cone thrown down the trace ahead of it.
    if (d.state === "locking") {
      const sweep = Math.sin(d.stateFor * 6) * 0.4;
      ctx.fillStyle = "rgba(255, 59, 82, 0.14)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r * 3.4, sweep - 0.34, sweep + 0.34);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function gem(x: number, y: number, wobble: number, age: number): void {
  const r = px(GEM_HIT) * 1.35;

  // The case it stands in.
  ctx.strokeStyle = CASE_LINE;
  ctx.lineWidth = px(0.006);
  ctx.strokeRect(x - r * 1.7, y - r * 1.7, r * 3.4, r * 3.4);
  ctx.strokeStyle = "rgba(150, 190, 235, 0.14)";
  ctx.beginPath();
  ctx.moveTo(x - r * 1.7, y + r * 0.6);
  ctx.lineTo(x + r * 1.7, y - r * 1.1);
  ctx.stroke();

  for (let i = 0; i < 2; i++) {
    const wave = (age * 0.7 + i * 0.5) % 1;
    ctx.strokeStyle = GEM;
    ctx.globalAlpha = (1 - wave) * 0.22;
    ctx.lineWidth = px(0.004);
    ctx.beginPath();
    ctx.arc(x, y, r * (1.6 + wave * 1.9), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const beat = 1 + wobble * 0.08;
  glow(GEM, px(0.05));
  ctx.fillStyle = GEM;
  ctx.beginPath();
  ctx.moveTo(x, y - r * beat);
  ctx.lineTo(x + r * 0.72 * beat, y);
  ctx.lineTo(x, y + r * beat);
  ctx.lineTo(x - r * 0.72 * beat, y);
  ctx.closePath();
  ctx.fill();
  clearGlow();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.moveTo(x, y - r * beat);
  ctx.lineTo(x + r * 0.72 * beat, y);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

export function draw(g: Game, reduced: boolean): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gallery(g);

  if (g.shake > 0 && !reduced) {
    const decay = g.shake / 420;
    const amount = px(0.012) * decay;
    ctx.translate(Math.sin(g.elapsed * 92) * amount, Math.cos(g.elapsed * 77) * amount);
  }

  if (g.phase === "lost") {
    ctx.fillStyle = "rgba(255, 59, 82, 0.1)";
    ctx.fillRect(-cssW, -cssH, cssW * 3, cssH * 3);
  }

  // The alarm: the trace flares as a gem leaves its case, a beat before
  // something starts reading it.
  const lit = g.flash > 0 ? Math.min(1, g.flash / 700) : 0;
  trace(g, g.elapsed - 3, g.elapsed, lit);

  if (g.gem) {
    const age = g.elapsed - g.gem.born;
    gem(px(g.gem.x), px(g.gem.y), Math.sin(age * 3.1), age);
  }

  for (const d of g.drones) {
    const at = droneAt(g, d);
    if (!at) continue;

    // Look along the trace the way it is about to travel, not the way the
    // thief arrived. Parked over the start of a trace, those are opposite.
    const readAt = d.state === "hunting" ? g.elapsed - d.delay : d.anchor;
    const here = sample(g.trail, readAt);
    const ahead = sample(g.trail, readAt + 0.12) ?? sample(g.trail, readAt + 0.04);
    let heading = 0;
    if (here && ahead) {
      const dx = ahead.x - here.x;
      const dy = ahead.y - here.y;
      if (dx * dx + dy * dy > 1e-8) heading = Math.atan2(dy, dx);
    }
    if (d.state === "docked" || d.state === "booting") heading = 0;
    if (d.state === "leaving") {
      const start = sample(g.trail, d.anchor);
      const slot = slotAt(g.world, d.slot, DELAYS.length);
      if (start) heading = Math.atan2(start.y - slot.y, start.x - slot.x);
    }

    drone(g, d, px(at.x), px(at.y), heading);
  }

  if (g.phase !== "lost") {
    const near = g.gem
      ? Math.max(0, 1 - Math.hypot(g.player.x - g.gem.x, g.player.y - g.gem.y) / 0.28)
      : 0;
    thief(px(g.player.x), px(g.player.y), g.heading, near);
  } else {
    const age = Math.min(1, (g.elapsed - g.endedAt) / 0.5);
    ctx.strokeStyle = ALERT;
    ctx.globalAlpha = 1 - age * 0.55;
    ctx.lineWidth = px(0.006);
    for (let i = 0; i < 5; i++) {
      const from = (i / 5) * Math.PI * 2 + age * 0.5;
      ctx.beginPath();
      ctx.arc(px(g.player.x), px(g.player.y), px(PLAYER_DRAW + age * 0.03), from, from + 0.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  for (const ring of g.rings) {
    const age = 1 - ring.life / ring.max;
    ctx.strokeStyle = ring.kind === "caught" ? ALERT : GEM;
    ctx.globalAlpha = (1 - age) * 0.7;
    ctx.lineWidth = px(0.005);
    ctx.beginPath();
    ctx.arc(px(ring.x), px(ring.y), px(0.02 + age * 0.14), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const shown = reduced ? Math.ceil(g.particles.length * 0.35) : g.particles.length;
  for (let i = 0; i < shown; i++) {
    const p = g.particles[i];
    ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.9;
    ctx.fillStyle = p.kind === "caught" ? ALERT : GEM;
    ctx.beginPath();
    ctx.arc(px(p.x), px(p.y), px(p.kind === "lure" ? 0.0035 : 0.005), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
