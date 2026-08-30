// Canvas, and nothing that decides anything. It reads the state and draws it.
//
// The board's own box is the authority on size: measured here, on resize, and
// never inside a frame. Space is in short-side units, so `unit` is the only
// number that turns the game into pixels.

import {
  bedAt,
  catAt,
  CAT_DRAW,
    PLAYER_DRAW,
  sample,
  stageLength,
  STAR_HIT,
  type Cat,
  type Game,
  type Vec,
} from "./logic.ts";

const FLOOR = "#0d0b17";
const TILE = "rgba(190, 210, 255, 0.035)";
const PROP = "rgba(190, 210, 255, 0.055)";
const MOUSE = "#aac5de";
const MOUSE_EAR = "#8ba7c4";
const NOSE = "#ff9fb5";
const CHEESE = "#ffd166";
const CAT = "#e8794a";
const CAT_DARK = "#c95f38";
const PRINT = "rgba(170, 197, 222, 0.5)";

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

// --- the room -------------------------------------------------------------

/** A dark floor with a few things standing on it. Drawn from world size, so it
    re-lays itself on a rotation instead of sliding off the edge. */
function room(world: Vec): void {
  ctx.fillStyle = FLOOR;
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.strokeStyle = TILE;
  ctx.lineWidth = 1;
  const tile = 0.26;
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

  // A table with two legs, a carton, and a food bowl. Named things, so the
  // room reads as a room rather than as three grey rectangles.
  ctx.strokeStyle = PROP;
  ctx.lineWidth = px(0.009);
  const tableY = world.y * 0.5;
  for (const y of [tableY - 0.3, tableY + 0.3]) {
    ctx.strokeRect(px(world.x - 0.16), px(y - 0.055), px(0.055), px(0.32));
    ctx.beginPath();
    ctx.moveTo(px(world.x - 0.185), px(y - 0.055));
    ctx.lineTo(px(world.x - 0.06), px(y - 0.055));
    ctx.stroke();
  }

  const boxX = world.x * 0.72;
  const boxY = world.y * 0.84;
  ctx.strokeRect(px(boxX), px(boxY), px(0.26), px(0.17));
  ctx.beginPath();
  ctx.moveTo(px(boxX), px(boxY));
  ctx.lineTo(px(boxX + 0.055), px(boxY - 0.055));
  ctx.lineTo(px(boxX + 0.315), px(boxY - 0.055));
  ctx.lineTo(px(boxX + 0.26), px(boxY));
  ctx.moveTo(px(boxX + 0.055), px(boxY - 0.055));
  ctx.lineTo(px(boxX + 0.055), px(boxY - 0.115));
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(px(world.x * 0.3), px(world.y * 0.9), px(0.07), px(0.032), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px(world.x * 0.3), px(world.y * 0.9), px(0.045), px(0.02), 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** The bed the cats sleep in: a raised rim and a soft cushion. */
function bed(world: Vec): void {
  const at = bedAt(world);
  const r = px(0.115);
  ctx.fillStyle = "rgba(146, 120, 96, 0.22)";
  ellipse(px(at.x), px(at.y), r, r * 0.74);
  ctx.strokeStyle = "rgba(190, 160, 130, 0.45)";
  ctx.lineWidth = px(0.011);
  ctx.beginPath();
  ctx.ellipse(px(at.x), px(at.y), r, r * 0.74, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(120, 96, 76, 0.3)";
  ellipse(px(at.x), px(at.y) + px(0.012), r * 0.74, r * 0.5);
}

// --- what the mouse leaves behind ----------------------------------------

/** Paw prints, laid at a steady spacing along the trail and fading out. This
    is the thing a cat follows, so it has to be legible on its own. */
function prints(g: Game, from: number, to: number, lit: number): void {
  const span = to - from;
  if (span <= 0) return;

  let carried = 0;
  let previous: { x: number; y: number; t: number } | null = null;
  let side = 1;

  for (const point of g.trail) {
    if (point.t < from) {
      previous = point;
      continue;
    }
    if (point.t > to) break;
    if (previous) {
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const gone = Math.hypot(dx, dy);
      carried += gone;
      if (carried >= 0.042 && gone > 1e-6) {
        carried = 0;
        side = -side;
        const heading = Math.atan2(dy, dx);
        const age = (to - point.t) / span;
        ctx.globalAlpha = (0.15 + lit * 0.75) * (1 - age) * (1 - age) + 0.06 * (1 - age);
        ctx.fillStyle = PRINT;
        facing(px(point.x), px(point.y), heading, () => {
          const off = px(0.016) * side;
          ellipse(0, off, px(0.009), px(0.006));
          ellipse(px(0.011), off + px(0.006) * side, px(0.0035), px(0.003));
          ellipse(px(0.009), off - px(0.007) * side, px(0.0035), px(0.003));
        });
      }
    }
    previous = point;
  }
  ctx.globalAlpha = 1;
}

// --- the cast -------------------------------------------------------------

function mouse(x: number, y: number, heading: number, sniff: number): void {
  facing(x, y, heading, () => {
    const r = px(PLAYER_DRAW);

    ctx.strokeStyle = MOUSE_EAR;
    ctx.lineWidth = px(0.004);
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.quadraticCurveTo(-r * 2.4, -r * 0.5, -r * 3.1, r * 0.5);
    ctx.stroke();

    ctx.fillStyle = MOUSE_EAR;
    ellipse(-r * 0.1, -r * 0.85, r * 0.42, r * 0.42);
    ellipse(-r * 0.1, r * 0.85, r * 0.42, r * 0.42);

    ctx.fillStyle = MOUSE;
    ellipse(-r * 0.15, 0, r * 1.15, r * 0.85);
    ellipse(r * 0.75, 0, r * 0.62, r * 0.55);

    // The nose twitches when cheese is close.
    ctx.fillStyle = NOSE;
    ellipse(r * (1.3 + sniff * 0.08), 0, r * 0.17, r * 0.15);
  });
}

/** A cat, seen from above and a little in front: round head, two triangle
    ears, an oval body, four feet that alternate as it runs, whiskers, and a
    long tail carried in a curve. Half again the size of the mouse. */
function catBody(r: number, gait: number, curl: number): void {
  const stride = Math.sin(gait) * r * 0.34;
  const bob = Math.abs(Math.sin(gait)) * r * 0.05;
  const squash = 1 - curl * 0.35;

  // Tail: swings opposite the legs when running, wraps the body when curled.
  ctx.strokeStyle = CAT;
  ctx.lineWidth = r * 0.19;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.95 * squash, 0);
  if (curl > 0.5) {
    ctx.quadraticCurveTo(-r * 1.5, r * 1.1, r * 0.3, r * 1.05);
  } else {
    ctx.quadraticCurveTo(-r * 1.9, -stride * 1.4, -r * 2.1, r * 0.55 - stride);
  }
  ctx.stroke();

  // Feet, two a side, alternating front to back.
  ctx.fillStyle = CAT_DARK;
  for (const side of [-1, 1]) {
    for (const [i, along] of [0.42, -0.42].entries()) {
      const swing = i === 0 ? stride : -stride;
      ellipse(
        r * along + swing * (1 - curl),
        side * r * 0.62 * squash,
        r * 0.19,
        r * 0.15,
      );
    }
  }

  ctx.fillStyle = CAT;
  ellipse(-r * 0.05, -bob, r * 1.0 * squash, r * 0.68);

  const headX = r * (0.92 - curl * 0.45);
  const headY = -bob - curl * r * 0.12;

  // Ears first, so the head sits over their base.
  ctx.beginPath();
  ctx.moveTo(headX - r * 0.1, headY - r * 0.42);
  ctx.lineTo(headX - r * 0.02, headY - r * 1.02);
  ctx.lineTo(headX + r * 0.42, headY - r * 0.5);
  ctx.moveTo(headX - r * 0.1, headY + r * 0.42);
  ctx.lineTo(headX - r * 0.02, headY + r * 1.02);
  ctx.lineTo(headX + r * 0.42, headY + r * 0.5);
  ctx.fill();

  ctx.fillStyle = CAT;
  ellipse(headX, headY, r * 0.56, r * 0.52);

  // Whiskers.
  ctx.strokeStyle = "rgba(255, 226, 210, 0.5)";
  ctx.lineWidth = r * 0.045;
  for (const side of [-1, 1]) {
    for (const lift of [-0.12, 0.12]) {
      ctx.beginPath();
      ctx.moveTo(headX + r * 0.34, headY + side * r * 0.16);
      ctx.lineTo(headX + r * 0.95, headY + side * r * (0.3 + lift));
      ctx.stroke();
    }
  }

  // Eyes: shut to a line while curled, open once it is up.
  ctx.strokeStyle = "#2a0f08";
  ctx.lineWidth = r * 0.075;
  ctx.fillStyle = "#2a0f08";
  for (const side of [-1, 1]) {
    const ex = headX + r * 0.2;
    const ey = headY + side * r * 0.22;
    if (curl > 0.45) {
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.13, ey);
      ctx.lineTo(ex + r * 0.13, ey);
      ctx.stroke();
    } else {
      ellipse(ex, ey, r * 0.1, r * 0.13);
    }
  }
}

/** A very soft shadow, so the cast stands on the floor rather than over it. */
function contact(x: number, y: number, r: number): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ellipse(x, y + r * 0.5, r * 0.95, r * 0.4);
}

function cat(g: Game, c: Cat, x: number, y: number, heading: number): void {
  const r = px(CAT_DRAW) * 1.5;
  const asleep = c.state === "sleeping";
  const waking = c.state === "waking";

  // Curled tight asleep, uncurling as it wakes, up on its feet after that.
  const wake = waking ? Math.min(1, c.stateFor / stageLength(c, "waking")) : 0;
  const curl = asleep ? 1 : waking ? 1 - wake : 0;

  // Breathing while it sleeps; a stretch on the way up; a run once it is out.
  const breathe = asleep ? 1 + Math.sin(g.elapsed * 1.7 + c.id) * 0.035 : 1;
  const stretch = waking && wake > 0.55 ? 1 + Math.sin((wake - 0.55) * 7) * 0.13 : 1;
  const gait = c.state === "leaving" || c.state === "tracking" ? g.elapsed * 13 : 0;

  // Asleep it faces into its bed; awake it faces where it is going.
  const facingWay = asleep || waking ? 0.5 : heading;
  const dip = c.state === "sniffing" ? r * 0.14 : 0;

  contact(x, y + dip, r);
  facing(x, y + dip, facingWay, () => {
    ctx.save();
    ctx.scale(breathe * stretch, breathe / stretch);
    catBody(r, gait, curl);
    ctx.restore();

    // An ear twitches on the very first beat of waking: the noise reached it.
    if (waking && wake < 0.3) {
      ctx.fillStyle = CAT;
      const flick = Math.sin(c.stateFor * 30) * r * 0.16;
      ctx.beginPath();
      ctx.moveTo(r * 0.4, -r * 0.42);
      ctx.lineTo(r * 0.5 + flick, -r * 1.05);
      ctx.lineTo(r * 0.85, -r * 0.5);
      ctx.fill();
    }
  });
}

function cheese(x: number, y: number, wobble: number): void {
  facing(x, y, wobble * 0.14, () => {
    const r = px(STAR_HIT) * 1.5;
    glow(CHEESE, px(0.045));
    ctx.fillStyle = CHEESE;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.95, r * 0.7);
    ctx.lineTo(-r * 0.95, r * 0.7);
    ctx.closePath();
    ctx.fill();
    clearGlow();
    ctx.fillStyle = "rgba(120, 82, 10, 0.75)";
    ellipse(0, r * 0.16, r * 0.19, r * 0.19);
    ellipse(-r * 0.4, r * 0.46, r * 0.13, r * 0.13);
    ellipse(r * 0.42, r * 0.42, r * 0.11, r * 0.11);
  });
}

export function draw(g: Game, reduced: boolean): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  room(g.world);
  bed(g.world);

  if (g.shake > 0 && !reduced) {
    const decay = g.shake / 420;
    const amount = px(0.012) * decay;
    ctx.translate(Math.sin(g.elapsed * 92) * amount, Math.cos(g.elapsed * 77) * amount);
  }

  if (g.phase === "lost") {
    ctx.fillStyle = "rgba(255, 100, 124, 0.09)";
    ctx.fillRect(-cssW, -cssH, cssW * 3, cssH * 3);
  }

  // After cheese the fresh prints light up, a beat before a cat puts its nose
  // down on them. That pairing is the only teaching this game gets to do.
  const lit = g.flash > 0 ? Math.min(1, g.flash / 700) : 0;
  // Long enough that every cat is standing on prints it can be seen reading.
  // A cat walking over bare floor is just a cat coming at you; the prints are
  // what make it a consequence.
  prints(g, g.elapsed - 3, g.elapsed, lit);

  if (g.star) {
    const age = g.elapsed - g.star.born;
    // Scent, drifting off it.
    ctx.strokeStyle = CHEESE;
    ctx.lineWidth = px(0.004);
    for (let i = 0; i < 3; i++) {
      const rise = (age * 0.5 + i * 0.34) % 1;
      ctx.globalAlpha = (1 - rise) * 0.28;
      ctx.beginPath();
      const sx = px(g.star.x) + px(0.02) * (i - 1);
      const sy = px(g.star.y) - px(0.05) - px(0.09) * rise;
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + px(0.022), sy - px(0.03), sx, sy - px(0.06));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    cheese(px(g.star.x), px(g.star.y), Math.sin(age * 3.1));
  }

  for (const c of g.cats) {
    const at = catAt(g, c);
    if (!at) continue;
    // Face along the prints it is reading. Coming out of the bed that means
    // the start of the trail, not wherever the mouse is now, or it arrives
    // looking the wrong way.
    const readAt = c.state === "tracking" ? g.elapsed - c.delay : c.anchor;
    const before = sample(g.trail, readAt - 0.09);
    const now = sample(g.trail, readAt);
    let heading = 0;
    if (before && now) {
      const dx = now.x - before.x;
      const dy = now.y - before.y;
      if (dx * dx + dy * dy > 1e-8) heading = Math.atan2(dy, dx);
    }
    if (c.state === "leaving") {
      const start = sample(g.trail, c.anchor);
      if (start) heading = Math.atan2(start.y - c.from.y, start.x - c.from.x);
    }

    // Asleep they lie in a heap rather than in one spot, so the bed reads as
    // holding more than one of them.
    let dx = 0;
    let dy = 0;
    if (c.state === "sleeping") {
      const i = c.id - 10;
      dx = ((i % 2) - 0.5) * px(0.062);
      dy = (Math.floor(i / 2) - 0.5) * px(0.052);
    }
    cat(g, c, px(at.x) + dx, px(at.y) + dy, heading);
  }

  if (g.phase !== "lost") {
    const near = g.star
      ? Math.max(0, 1 - Math.hypot(g.player.x - g.star.x, g.player.y - g.star.y) / 0.28)
      : 0;
    mouse(px(g.player.x), px(g.player.y), g.heading, near * Math.abs(Math.sin(g.elapsed * 11)));
  } else {
    const age = Math.min(1, (g.elapsed - g.endedAt) / 0.5);
    ctx.strokeStyle = CAT;
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
    ctx.strokeStyle = ring.kind === "caught" ? CAT : CHEESE;
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
    ctx.fillStyle = p.kind === "caught" ? CAT : CHEESE;
    ctx.beginPath();
    ctx.arc(px(p.x), px(p.y), px(p.kind === "lure" ? 0.0035 : 0.005), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
