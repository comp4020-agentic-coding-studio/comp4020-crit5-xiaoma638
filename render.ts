// Reads the state and moves what's already on the page. Every element the
// round needs is in index.html from the start --- twelve foe slots, one seal,
// pools of beams and shards --- so a frame sets attributes and never builds
// DOM. It is also the only file that knows which way the lane runs: `at()`
// turns a foe's single `d` into a point, across the screen on a wide viewport
// and down it on a tall one. Nothing else in the game has to care.

import { SEAL_D, SHARD_MS, type Game } from "./logic.ts";

const root = document.documentElement;
const stage = document.getElementById("stage") as unknown as SVGSVGElement;
const lineEl = document.getElementById("line") as unknown as SVGLineElement;
const lineGlow = document.getElementById("line-glow") as unknown as SVGCircleElement;
const staffEl = document.getElementById("staff") as unknown as SVGGElement;
const sealEl = document.getElementById("seal") as unknown as SVGGElement;
const sealCount = document.getElementById("seal-count") as unknown as SVGTextElement;

const foeSlots = [...stage.querySelectorAll<SVGGElement>(".foe")];
const beamSlots = [...stage.querySelectorAll<SVGLineElement>(".beam")];
const shardSlots = [...stage.querySelectorAll<SVGCircleElement>(".shard")];

// Read once, and again only when the viewport changes --- never in a frame.
let vertical = window.innerHeight > window.innerWidth;

export function measure(): void {
  vertical = window.innerHeight > window.innerWidth;
  // The box follows the viewport's shape, so the lane fills it either way
  // instead of sitting in a letterboxed square.
  stage.setAttribute("viewBox", vertical ? "0 0 46 100" : "0 0 100 56");
  layoutLane();
}

/** A foe's one number becomes a point. The only place direction lives. */
function at(d: number): [number, number] {
  return vertical ? [23, 88 - d * 68] : [12 + d * 82, 34];
}

function layoutLane(): void {
  const [ax, ay] = at(0);
  if (vertical) {
    lineEl.setAttribute("x1", "4");
    lineEl.setAttribute("x2", "42");
    lineEl.setAttribute("y1", String(ay));
    lineEl.setAttribute("y2", String(ay));
  } else {
    lineEl.setAttribute("x1", String(ax));
    lineEl.setAttribute("x2", String(ax));
    lineEl.setAttribute("y1", String(ay - 13));
    lineEl.setAttribute("y2", String(ay + 13));
  }
  lineGlow.setAttribute("cx", String(ax));
  lineGlow.setAttribute("cy", String(ay));
  staffEl.setAttribute("transform", `translate(${ax},${ay})`);

  const [sx, sy] = at(SEAL_D);
  sealEl.setAttribute("transform", `translate(${sx},${sy})`);
}

function show(el: Element, on: boolean): void {
  el.classList.toggle("off", !on);
}

export function render(g: Game): void {
  root.dataset.phase = g.phase;
  root.dataset.staff = String(g.staff);
  root.dataset.taught = g.taught ? "yes" : "no";

  for (const [i, slot] of foeSlots.entries()) {
    const foe = g.foes[i];
    show(slot, foe !== undefined);
    if (!foe) {
      delete slot.dataset.foe;
      continue;
    }
    const [x, y] = at(foe.d);
    slot.setAttribute("transform", `translate(${x},${y})`);
    slot.dataset.foe = String(foe.id);
    slot.classList.toggle("hurt", foe.hurt > 0);
    // The one foe of the opening pulses until it falls; after that, never.
    slot.classList.toggle("calling", !g.taught);
  }

  show(sealEl, g.seal !== null);
  if (g.seal) {
    sealCount.textContent = String(g.seal.hp);
    sealEl.classList.toggle("hurt", g.seal.hurt > 0);
    sealEl.classList.toggle("calling", g.broken === 0 && g.seal.hp === g.seal.maxHp);
    sealEl.dataset.left = String(g.seal.hp);
  }

  const [hx, hy] = at(0);
  for (const [i, slot] of beamSlots.entries()) {
    const beam = g.beams[i];
    show(slot, beam !== undefined);
    if (!beam) continue;
    const [tx, ty] = at(beam.to);
    slot.setAttribute("x1", String(hx));
    slot.setAttribute("y1", String(hy - (vertical ? 1.5 : 3.8)));
    slot.setAttribute("x2", String(tx));
    slot.setAttribute("y2", String(ty));
  }

  for (const [i, slot] of shardSlots.entries()) {
    const shard = g.shards[i];
    show(slot, shard !== undefined);
    if (!shard) continue;
    // Life left doubles as the trip home: 0.5 of the lane down to the staff.
    const travelled = shard.life / SHARD_MS;
    const [x, y] = at(SEAL_D * travelled);
    const spread = ((shard.id % 5) - 2) * 1.6 * travelled;
    slot.setAttribute("cx", String(x + (vertical ? spread : 0)));
    slot.setAttribute("cy", String(y + (vertical ? 0 : spread)));
    slot.setAttribute("opacity", String(Math.min(1, travelled * 1.6)));
  }
}

measure();
