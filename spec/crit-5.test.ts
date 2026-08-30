import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  initial,
  overlaps,
  PLAYER_HIT,
  SHADE_HIT,
  step,
  WIN_AT,
  type Game,
} from "../logic.ts";

// The mechanically checkable lines of this week's published spec.
//
// Still to write, once the mechanic exists — these need the game before they
// can say anything true:
//   - "it can be lost: a wrong move is possible, and play ends somewhere"
//   - "one rule of the game has a focused automated test"
//
// Only a person at the crit can judge the rest: whether a stranger reaches an
// ending inside five minutes, whether a change came from playing rather than
// reading, and whether the direction, grounding and correction can be
// accounted for.

const DIST = resolve("dist");

function shipped(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? shipped(path) : [relative(DIST, path).split(sep).join("/")];
  });
}

const home = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;

// Phrases that only appear when a page is explaining itself. An invitation
// ("Start", "Play") is allowed and is the point; a lesson is not.
const TEACHING = [
  /how to play/i,
  /\binstructions?\b/i,
  /\btutorial\b/i,
  /\bhow it works\b/i,
  /\bcontrols\b/i,
  /\brules\b/i,
  /\byour (goal|objective|aim)\b/i,
  /\bthe (goal|objective|aim) (is|of)\b/i,
  /\bpress\b[^.!?]{0,24}\bto\b/i,
  /\buse (the )?(arrow keys|wasd|mouse|keyboard)\b/i,
];

describe("spec: it teaches itself", () => {
  it("ships no instructions page", () => {
    const pages = shipped().filter((name) => /(^|\/)(help|instructions?|howto|how-to|rules|tutorial|guide)[^/]*\.html$/i.test(name));
    expect(pages, "the spec allows no instructions anywhere — a separate page is still anywhere").toEqual([]);
  });

  it("carries no how-to text in anything it ships", () => {
    const offenders = shipped()
      .filter((name) => /\.(html|js|css|json|txt|svg)$/i.test(name))
      .flatMap((name) => {
        const text = readFileSync(join(DIST, name), "utf8");
        return TEACHING.filter((pattern) => pattern.test(text)).map((pattern) => `${name}: ${pattern}`);
      });
    expect(offenders, "play has to teach whatever comes after the first move").toEqual([]);
  });

  it("keeps the README out of the teaching business", () => {
    const readme = readFileSync(resolve("README.md"), "utf8");
    const offenders = TEACHING.filter((pattern) => pattern.test(readme)).map(String);
    expect(offenders, "the spec says no instructions on screen or off, and the README is off").toEqual([]);
  });

  it("opens with something to act on rather than something to read", () => {
    const main = home.querySelector("main");
    expect(main, "the home page ships no main landmark").not.toBeNull();

    const actionable = main?.querySelectorAll("button, canvas, [role='button'], [tabindex], input, select") ?? [];
    expect(
      actionable.length,
      "the opening screen has to make the first move obvious, and prose is not a move",
    ).toBeGreaterThan(0);

    const prose = (main?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(prose, "the starter's placeholder copy is still on the page").not.toMatch(/Replace this with your prototype/i);
  });
});

// The one rule this game turns on, put under a focused test as the spec asks:
// a shade is where you were, and touching one ends the round. It is a pure
// function of two circles, so it can be checked exactly --- including the
// graze, where the call between "caught" and "just made it" actually lives.
//
// All of this runs on the machine, not the canvas, so it stays true while the
// look of the thing changes underneath it.

const HERE = { x: 0.5, y: 0.5 };
const REACH = PLAYER_HIT + SHADE_HIT;

describe("spec: a shade catches you", () => {
  it("catches when the two circles overlap", () => {
    const onTop = { x: HERE.x + REACH * 0.5, y: HERE.y };

    expect(overlaps(HERE, PLAYER_HIT, onTop, SHADE_HIT)).toBe(true);
  });

  it("does not catch when they are clear of each other", () => {
    const away = { x: HERE.x + REACH * 3, y: HERE.y };

    expect(overlaps(HERE, PLAYER_HIT, away, SHADE_HIT)).toBe(false);
  });

  it("reads an exact graze as a miss", () => {
    const grazing = { x: HERE.x + REACH, y: HERE.y };

    expect(
      overlaps(HERE, PLAYER_HIT, grazing, SHADE_HIT),
      "touching at exactly the sum of the radii is the near miss that makes a fast pass feel fair",
    ).toBe(false);
  });

  it("still misses a hair outside, and catches a hair inside", () => {
    const outside = { x: HERE.x + REACH * 1.001, y: HERE.y };
    const inside = { x: HERE.x + REACH * 0.999, y: HERE.y };

    expect(overlaps(HERE, PLAYER_HIT, outside, SHADE_HIT)).toBe(false);
    expect(overlaps(HERE, PLAYER_HIT, inside, SHADE_HIT)).toBe(true);
  });
});

/** A round already under way, with the trail parked on one spot. */
function standing(over: Partial<Game> = {}): Game {
  return {
    ...initial(),
    elapsed: 5,
    player: { ...HERE },
    target: { ...HERE },
    trail: [
      { x: HERE.x, y: HERE.y, t: 2.5 },
      { x: HERE.x, y: HERE.y, t: 5 },
    ],
    star: null,
    ...over,
  };
}

describe("spec: the round ends where it should", () => {
  it("is lost the moment an armed shade reaches the player", () => {
    const g = standing({ shades: [{ id: 1, delay: 1.2, armedAt: 0 }] });

    const after = step(g, { target: HERE }, 16);

    expect(after.phase, "standing where you stood is what loses this game").toBe("lost");
  });

  it("does not lose to one that has not armed yet", () => {
    const g = standing({ shades: [{ id: 1, delay: 1.2, armedAt: 60 }] });

    const after = step(g, { target: HERE }, 16);

    expect(
      after.phase,
      "a shade fades up before it can catch you, so nothing arrives without warning",
    ).toBe("playing");
  });

  it("reaches the present on the eighth star", () => {
    const g = standing({
      score: WIN_AT - 1,
      shades: [],
      star: { x: HERE.x, y: HERE.y, born: 0 },
    });

    const after = step(g, { target: HERE }, 16);

    expect(after.phase, "a game you cannot finish has no ending to reach").toBe("won");
    expect(after.score).toBe(WIN_AT);
  });
});
