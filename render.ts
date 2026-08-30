// Reads the state and moves what's already on the page. Every element a round
// needs is in index.html from the start --- squad, shade slots, bullet and
// shard pools --- so a frame sets attributes and never builds DOM.
//
// It is also the only file that knows which way the lane runs. `place()` turns
// a position along the lane plus an offset across it into a point: across a
// wide viewport, down a tall one. Nothing else in the game has to care.

import { aim, SEAL_D, SHARD_MS, type Game } from "./logic.ts";

const root = document.documentElement;
const stage = document.getElementById("stage") as unknown as SVGSVGElement;
const lineEl = document.getElementById("line") as unknown as SVGLineElement;
const lineGlow = document.getElementById("line-glow") as unknown as SVGCircleElement;
const sealEl = document.getElementById("seal") as unknown as SVGGElement;
const sealCount = document.getElementById("seal-count") as unknown as SVGTextElement;

const allySlots = [...stage.querySelectorAll<SVGGElement>(".ally")];
const foeSlots = [...stage.querySelectorAll<SVGGElement>(".foe")];
const bulletSlots = [...stage.querySelectorAll<SVGCircleElement>(".bullet")];
const shardSlots = [...stage.querySelectorAll<SVGCircleElement>(".shard")];

// Read once, and again only when the viewport changes --- never in a frame.
let vertical = window.innerHeight > window.innerWidth;
/** World units across the lane. Set so the box matches the viewport's shape
    exactly: any other ratio letterboxes or crops, and a crop slides the whole
    lane sideways while every coordinate in it stays right. */
let width = 56;

export function measure(): void {
  // The board's own box, not the window's. They are not always the same, and
  // sizing the world from the window puts a correct coordinate in the wrong
  // place --- every element shifts together and nothing in the state is wrong.
  const { width: w, height: h } = stage.getBoundingClientRect();
  if (w === 0 || h === 0) return;
  vertical = h > w;
  width = 100 * (vertical ? w / h : h / w);
  stage.setAttribute(
    "viewBox",
    vertical ? `0 0 ${width.toFixed(2)} 100` : `0 0 100 ${width.toFixed(2)}`,
  );
  layoutLane();
}

/** Along the lane, and across it. The only place direction lives. */
function place(d: number, across: number): [number, number] {
  const mid = width / 2;
  return vertical ? [mid + across, 88 - d * 68] : [12 + d * 82, mid + across];
}

/** Shades fan out so a crowd reads as a crowd, deterministically by id. */
function foeAcross(id: number): number {
  return (((id * 37) % 9) - 4) * 2.1;
}

/** Two ranks of four: eight people still have to fit across the lane. */
const RANK = 4;

function allyAcross(slot: number, count: number): number {
  const wide = Math.min(count, RANK);
  return ((slot % RANK) - (wide - 1) / 2) * 6.4;
}

function allyAlong(slot: number): number {
  return -0.045 - Math.floor(slot / RANK) * 0.042;
}

function layoutLane(): void {
  const [ax, ay] = place(0, 0);
  if (vertical) {
    lineEl.setAttribute("x1", "2");
    lineEl.setAttribute("x2", String(width - 2));
    lineEl.setAttribute("y1", String(ay));
    lineEl.setAttribute("y2", String(ay));
  } else {
    const reach = Math.min(15, width / 2 - 2);
    lineEl.setAttribute("x1", String(ax));
    lineEl.setAttribute("x2", String(ax));
    lineEl.setAttribute("y1", String(ay - reach));
    lineEl.setAttribute("y2", String(ay + reach));
  }
  lineGlow.setAttribute("cx", String(ax));
  lineGlow.setAttribute("cy", String(ay));

  const [sx, sy] = place(SEAL_D, 0);
  sealEl.setAttribute("transform", `translate(${sx},${sy})`);
}

function show(el: Element, on: boolean): void {
  el.classList.toggle("off", !on);
}

function put(el: Element, d: number, across: number): void {
  const [x, y] = place(d, across);
  el.setAttribute("transform", `translate(${x},${y})`);
}

export function render(g: Game): void {
  const at = aim(g);

  root.dataset.phase = g.phase;
  root.dataset.squad = String(g.allies.length);
  root.dataset.started = g.elapsed > 4500 ? "yes" : "no";

  for (const [i, slot] of allySlots.entries()) {
    const ally = g.allies[i];
    show(slot, ally !== undefined);
    if (ally) put(slot, allyAlong(ally.slot), allyAcross(ally.slot, g.allies.length));
  }

  for (const [i, slot] of foeSlots.entries()) {
    const foe = g.foes[i];
    show(slot, foe !== undefined);
    if (!foe) {
      delete slot.dataset.foe;
      continue;
    }
    put(slot, foe.d, foeAcross(foe.id));
    slot.dataset.foe = String(foe.id);
    slot.classList.toggle("hurt", foe.hurt > 0);
    slot.classList.toggle("aimed", at?.kind === "foe" && at.id === foe.id);
  }

  show(sealEl, g.seal !== null);
  if (g.seal) {
    sealCount.textContent = String(g.seal.hp);
    sealEl.classList.toggle("hurt", g.seal.hurt > 0);
    sealEl.classList.toggle("aimed", at?.kind === "seal");
    // The crystal drains as it takes hits, so the post itself reads as a meter.
    sealEl.style.setProperty("--left", String(g.seal.hp / g.seal.maxHp));
  }

  for (const [i, slot] of bulletSlots.entries()) {
    const bullet = g.bullets[i];
    show(slot, bullet !== undefined);
    if (!bullet) continue;

    const target = bullet.target;
    const endD = target.kind === "seal" ? SEAL_D : (g.foes.find((f) => f.id === target.id)?.d ?? 1);
    const endAcross = target.kind === "seal" ? 0 : foeAcross(target.id);
    // Leaves the squad spread out and converges on what it was aimed at.
    const fromAcross = (((bullet.id % 4) - 1.5) * 6.6);
    const t = endD <= 0 ? 1 : Math.min(1, bullet.d / endD);
    const [x, y] = place(bullet.d, fromAcross + (endAcross - fromAcross) * t);
    slot.setAttribute("cx", String(x));
    slot.setAttribute("cy", String(y));
  }

  for (const [i, slot] of shardSlots.entries()) {
    const shard = g.shards[i];
    show(slot, shard !== undefined);
    if (!shard) continue;
    // Life left doubles as the trip home, from the crystal back to the squad.
    const left = shard.life / SHARD_MS;
    const [x, y] = place(SEAL_D * left, (((shard.id % 7) - 3) * 2.2) * left);
    slot.setAttribute("cx", String(x));
    slot.setAttribute("cy", String(y));
    slot.setAttribute("opacity", String(Math.min(1, left * 1.7)));
  }
}

measure();

// The board can settle after this module runs --- first layout, a rotation, a
// phone's address bar sliding away. Watching the element itself catches every
// one of those, and a stale world size puts correct coordinates in the wrong
// place without anything in the state being wrong.
new ResizeObserver(() => measure()).observe(stage);
