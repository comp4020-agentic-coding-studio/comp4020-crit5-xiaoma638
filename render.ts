// Canvas, and nothing that decides anything. It reads the state and draws it.
//
// The board's own box is the authority on size: measured here, on resize, and
// never inside a frame. Space is in short-side units, so `unit` is the only
// number that turns the game into pixels.

import {
  PLAYER_DRAW,
  sample,
  SHADE_DRAW,
  shadeAt,
  STAR_HIT,
  type Game,
  type Shade,
  type Vec,
} from "./logic.ts";

const INK = "#070814";
const PLAYER = "#67f5ff";
const SHADE = "#ff647c";
const STAR = "#ffd166";

const canvas = document.getElementById("board") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

let unit = 1;
let cssW = 0;
let cssH = 0;
let dpr = 1;
let left = 0;
let top = 0;

/** Measure the board and return its shape in short-side units. */
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

/** A comet: a round head facing `heading`, drawn back into a tail. The shades
    wear the same shape, because a shade is not a monster --- it is a copy of
    you, and the silhouette is what says so. */
function comet(x: number, y: number, heading: number, r: number, tail: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.quadraticCurveTo(-tail * 0.45, r * 0.62, -tail, 0);
  ctx.quadraticCurveTo(-tail * 0.45, -r * 0.62, 0, -r);
  ctx.closePath();
  ctx.restore();
}

/** Which way a shade is facing: the direction you were going back then. */
function shadeHeading(g: Game, shade: Shade): number {
  const t = g.elapsed - shade.delay;
  const before = sample(g.trail, t - 0.07);
  const now = sample(g.trail, t);
  if (!before || !now) return 0;
  const dx = now.x - before.x;
  const dy = now.y - before.y;
  return dx * dx + dy * dy < 1e-8 ? 0 : Math.atan2(dy, dx);
}

/** A four-pointed sparkle, drawn with concave sides. */
function sparkle(x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
}

function ribbon(
  g: Game,
  from: number,
  to: number,
  color: string,
  width: number,
  peak: number,
): void {
  const span = to - from;
  if (span <= 0) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = px(width);

  let previous: { x: number; y: number; t: number } | null = null;
  for (const point of g.trail) {
    if (point.t < from) {
      previous = point;
      continue;
    }
    if (point.t > to) break;
    if (previous) {
      const age = (to - point.t) / span;
      ctx.globalAlpha = peak * (1 - age) * (1 - age);
      ctx.beginPath();
      ctx.moveTo(px(previous.x), px(previous.y));
      ctx.lineTo(px(point.x), px(point.y));
      ctx.stroke();
    }
    previous = point;
  }
  ctx.globalAlpha = 1;
}

export function draw(g: Game, reduced: boolean): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, cssW, cssH);

  if (g.shake > 0 && !reduced) {
    // Derived from the clock, so a redraw of the same state looks the same.
    const decay = g.shake / 420;
    const amount = px(0.012) * decay;
    ctx.translate(
      Math.sin(g.elapsed * 92) * amount,
      Math.cos(g.elapsed * 77) * amount,
    );
  }

  if (g.phase === "lost") {
    ctx.fillStyle = "rgba(255, 100, 124, 0.09)";
    ctx.fillRect(-cssW, -cssH, cssW * 3, cssH * 3);
  }

  // Where they are walking: the same trail, read further back.
  for (const shade of g.shades) {
    const t = g.elapsed - shade.delay;
    ribbon(g, t - 0.38, t, SHADE, 0.014, shade.live ? 0.42 : 0.2);
  }
  // After a star the whole route lights up, a beat before something starts
  // walking it. That pairing is the only teaching this game gets to do.
  const lit = g.flash > 0 ? Math.min(1, g.flash / 700) : 0;
  ribbon(g, g.elapsed - 0.7 - lit * 1.6, g.elapsed, PLAYER, 0.018 + lit * 0.006, 0.8 + lit * 0.2);

  if (g.star) {
    const age = g.elapsed - g.star.born;
    // Rings going out on a slow pulse: something with a pull, not a decoration.
    for (let i = 0; i < 2; i++) {
      const wave = ((age * 0.75 + i * 0.5) % 1);
      ctx.strokeStyle = STAR;
      ctx.globalAlpha = (1 - wave) * 0.3;
      ctx.lineWidth = px(0.004);
      ctx.beginPath();
      ctx.arc(px(g.star.x), px(g.star.y), px(0.03 + wave * 0.1), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const beat = 1 + Math.sin(age * 4.6) * 0.11;
    glow(STAR, px(0.06));
    ctx.fillStyle = STAR;
    sparkle(px(g.star.x), px(g.star.y), px(STAR_HIT * 1.2 * beat));
    ctx.fill();
    clearGlow();
  }

  for (const shade of g.shades) {
    const at = shadeAt(g, shade);
    if (!at) continue;
    // Fades up while it is still harmless, so nothing arrives without warning.
    const arming = Math.min(1, Math.max(0, (g.elapsed - (shade.wakeAt - 1)) / 1));
    const live = shade.live;
    // Outline only until it wakes, then filled: the same shape as the player,
    // in red, so it reads as a copy rather than as something that wandered in.
    comet(px(at.x), px(at.y), shadeHeading(g, shade), px(SHADE_DRAW), px(0.07));
    if (live) {
      ctx.globalAlpha = 0.82;
      glow(SHADE, px(0.055));
      ctx.fillStyle = SHADE;
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.3 + arming * 0.45;
      ctx.strokeStyle = SHADE;
      ctx.lineWidth = px(0.005);
      ctx.setLineDash([px(0.02), px(0.014)]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    clearGlow();
    ctx.globalAlpha = 1;
  }

  if (g.phase !== "lost") {
    // Brighter the closer the star is: the comet reacts to it before you do.
    const near = g.star
      ? Math.max(0, 1 - Math.hypot(g.player.x - g.star.x, g.player.y - g.star.y) / 0.3)
      : 0;
    glow(PLAYER, px(0.07 + near * 0.05));
    ctx.fillStyle = PLAYER;
    comet(px(g.player.x), px(g.player.y), g.heading, px(PLAYER_DRAW), px(0.075 + near * 0.03));
    ctx.fill();
    clearGlow();
    ctx.fillStyle = "#eafeff";
    ctx.beginPath();
    ctx.arc(px(g.player.x), px(g.player.y), px(PLAYER_DRAW * 0.44), 0, Math.PI * 2);
    ctx.fill();
  } else {
    // A ring that came apart where you were caught.
    const age = Math.min(1, (g.elapsed - g.endedAt) / 0.5);
    ctx.strokeStyle = SHADE;
    ctx.globalAlpha = 1 - age * 0.55;
    ctx.lineWidth = px(0.006);
    for (let i = 0; i < 5; i++) {
      const from = (i / 5) * Math.PI * 2 + age * 0.5;
      ctx.beginPath();
      ctx.arc(
        px(g.player.x),
        px(g.player.y),
        px(PLAYER_DRAW + age * 0.03),
        from,
        from + 0.7,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  for (const ring of g.rings) {
    const age = 1 - ring.life / ring.max;
    ctx.strokeStyle = ring.kind === "caught" ? SHADE : STAR;
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
    ctx.fillStyle = p.kind === "caught" ? SHADE : STAR;
    ctx.beginPath();
    ctx.arc(px(p.x), px(p.y), px(p.kind === "lure" ? 0.0035 : 0.005), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
