// The loop, and the only place input enters. Pointer, touch and keys all end
// up as one thing: where the player is trying to be.

import { initial, step, type Game, type Input, type Vec } from "./logic.ts";
import { draw, resize, toWorld } from "./render.ts";

const board = document.getElementById("board") as HTMLCanvasElement;
const ending = document.getElementById("ending") as HTMLDivElement;
const verdict = document.getElementById("verdict") as HTMLParagraphElement;
const again = document.getElementById("again") as HTMLButtonElement;
const slots = [...document.querySelectorAll<HTMLLIElement>("#tally li")];
const root = document.documentElement;

const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

let world: Vec = resize();
let game: Game = initial(world, (performance.now() * 1000) & 0xffff);
let pointer: Vec | null = null;
let last = 0;
let running = true;
let shown = -1;
let phase = "";

const held = new Set<string>();
const KEYS: Record<string, Vec> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

function restart(): void {
  world = resize();
  game = initial(world, (performance.now() * 1000) & 0xffff);
  pointer = null;
  held.clear();
  last = 0;
  paint(true);
}

function paint(force: boolean): void {
  if (force || game.score !== shown) {
    shown = game.score;
    for (const [i, slot] of slots.entries()) slot.classList.toggle("on", i < shown);
  }
  if (force || game.phase !== phase) {
    phase = game.phase;
    root.dataset.phase = phase;
    ending.hidden = phase === "playing";
    // Short enough to read at a glance, and it says how it went, not how to play.
    verdict.textContent =
      phase === "won" ? "OUT CLEAN" : phase === "lost" ? "DETECTED" : "";
    if (phase !== "playing") again.focus();
  }
}

board.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (game.phase !== "playing") {
    restart();
    return;
  }
  pointer = toWorld(event.clientX, event.clientY);
  board.focus();
});

board.addEventListener("pointermove", (event) => {
  event.preventDefault();
  if (game.phase !== "playing") return;
  pointer = toWorld(event.clientX, event.clientY);
});

window.addEventListener("keydown", (event) => {
  if (event.key in KEYS) {
    event.preventDefault();
    held.add(event.key);
  }
});
window.addEventListener("keyup", (event) => held.delete(event.key));

again.addEventListener("click", (event) => {
  event.stopPropagation();
  restart();
});

new ResizeObserver(() => {
  const next = resize();
  const changed = next.x !== world.x || next.y !== world.y;
  world = next;
  // The board's real size can arrive after this module runs, and the opening
  // is placed from it --- the player in the middle, the first gem an easy
  // reach away. Re-place the round while it is still the opening rather than
  // leave someone starting off-centre from a size that was never true.
  if (changed && game.elapsed < 0.4 && game.score === 0 && game.phase === "playing") {
    game = initial(world, game.seed);
    paint(true);
  }
  // Sizing the canvas clears it. While the loop is running the next frame
  // covers that, but a paused or finished board would just go blank.
  draw(game, calm.matches);
}).observe(board);

// Away is paused: the drones are one clock behind you, and a tab that keeps
// running while nobody is watching would hand them the round.
function setRunning(on: boolean): void {
  running = on;
  if (on) last = 0;
}
document.addEventListener("visibilitychange", () => setRunning(!document.hidden));
window.addEventListener("blur", () => setRunning(false));
window.addEventListener("focus", () => setRunning(true));

function frame(now: number): void {
  requestAnimationFrame(frame);
  if (!running) return;

  const dt = last === 0 ? 16 : Math.min(50, now - last);
  last = now;

  const input: Input = { world };
  if (held.size > 0) {
    // Keys nudge the same target the pointer sets, so both roads lead in.
    const move = { x: 0, y: 0 };
    for (const key of held) {
      const step = KEYS[key];
      move.x += step.x;
      move.y += step.y;
    }
    const length = Math.hypot(move.x, move.y) || 1;
    const speed = 1.25 * (dt / 1000);
    const from = pointer ?? game.player;
    pointer = {
      x: Math.min(Math.max(from.x + (move.x / length) * speed, 0), world.x),
      y: Math.min(Math.max(from.y + (move.y / length) * speed, 0), world.y),
    };
  }
  if (pointer) input.target = pointer;

  game = step(game, input, dt);
  paint(false);
  draw(game, calm.matches);
}

paint(true);
requestAnimationFrame(frame);
