// The loop, and the only place input enters. A pointer press names what was
// hit --- the element itself carries the foe's id --- so nothing here measures
// the page or converts coordinates.

import { initial, step, type Game, type Input } from "./logic.ts";
import { render } from "./render.ts";

let game: Game = initial((performance.now() * 1000) & 0xffff);
let pending: Input = null;
let last = 0;

const stage = document.getElementById("stage") as unknown as SVGSVGElement;
const again = document.getElementById("again") as HTMLButtonElement;

function aimAt(target: EventTarget | null): void {
  const hit = (target as Element | null)?.closest<Element>(".foe, #seal");
  if (!hit) return;
  if (hit.id === "seal") pending = { kind: "seal" };
  else if (hit instanceof SVGElement && hit.dataset.foe) {
    pending = { kind: "foe", id: Number(hit.dataset.foe) };
  }
}

stage.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  aimAt(event.target);
});

// role="button" and a tabindex are only true if the keys work.
stage.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  aimAt(event.target);
});

again.addEventListener("click", () => {
  game = initial((performance.now() * 1000) & 0xffff);
  render(game);
});

function frame(now: number): void {
  // Clamped: a backgrounded tab must not hand the lane one enormous step and
  // walk every shade through the line at once.
  const dt = last === 0 ? 16 : Math.min(50, now - last);
  last = now;

  game = step(game, pending, dt);
  pending = null;
  render(game);

  requestAnimationFrame(frame);
}

render(game);
requestAnimationFrame(frame);
