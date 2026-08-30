import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { aim, initial, PER_BREAK, SEALS, SQUAD_START, SURGE, step, type Game, type Input } from "../logic.ts";

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

// The one rule of this game put under a focused test, as the spec asks. The
// squad fires on its own; all you decide is where that fire points, so the
// cost of going for a crystal is a stretch of time with nothing shooting at
// what's walking in. This is what that spend buys.
//
// It runs on the pure state machine --- no DOM, no clock --- so it stays true
// while the look of the thing changes underneath it.

function atCrystal(hp: number, over: Partial<Game> = {}): Game {
  const g = initial(3);
  return {
    ...g,
    foes: [],
    seal: { id: 99, index: 0, hp, maxHp: SEALS[0], hurt: 0 },
    focus: { kind: "seal" },
    // One round already in flight, a hair short of the crystal.
    bullets: [{ id: 50, d: 0.5, target: { kind: "seal" } }],
    ...over,
  };
}

describe("spec: breaking a crystal is what frees someone", () => {
  it("frees one of you on the hit that empties it, and raises the next", () => {
    const before = atCrystal(1);
    const after = step(before, null, 100);

    expect(after.allies.length, "a broken crystal is the only thing that grows the squad").toBe(
      before.allies.length + PER_BREAK,
    );
    expect(after.broken).toBe(1);
    expect(after.seal?.id, "that crystal is gone --- what stands there now is the next").not.toBe(
      before.seal?.id,
    );
  });

  it("holds while it still has points, and the squad stays the size it was", () => {
    const before = atCrystal(2);
    const after = step(before, null, 100);

    expect(after.seal?.hp).toBe(1);
    expect(after.allies.length, "the squad grows on the break, not on the hit").toBe(
      before.allies.length,
    );
  });

  it("leaves the lane bare once the last crystal falls, and calls the surge", () => {
    const last = SEALS.length - 1;
    const after = step(
      atCrystal(1, {
        broken: last,
        seal: { id: 99, index: last, hp: 1, maxHp: SEALS[last], hurt: 0 },
      }),
      null,
      100,
    );

    expect(after.seal, "nothing else rises --- the round has somewhere to end").toBeNull();
    expect(after.surgeLeft, "the last break is what starts the ending").toBe(SURGE);
  });
});

describe("spec: your one input is where the squad points", () => {
  it("shoots the nearest shade when you have said nothing", () => {
    const g: Game = {
      ...initial(3),
      foes: [
        { id: 10, d: 0.8, speed: 0.07, hp: 2, maxHp: 2, hurt: 0 },
        { id: 11, d: 0.3, speed: 0.07, hp: 2, maxHp: 2, hurt: 0 },
      ],
      seal: { id: 99, index: 0, hp: 5, maxHp: SEALS[0], hurt: 0 },
    };

    expect(aim(g), "an untouched game still defends itself").toEqual({ kind: "foe", id: 11 });
  });

  it("holds the crystal once you pick it, with shades still closing", () => {
    const g: Game = {
      ...initial(3),
      foes: [{ id: 11, d: 0.3, speed: 0.07, hp: 2, maxHp: 2, hurt: 0 }],
      seal: { id: 99, index: 0, hp: 5, maxHp: SEALS[0], hurt: 0 },
    };

    const after = step(g, { kind: "seal" }, 16);
    expect(aim(after), "that is the whole trade --- fire spent here is fire not spent there").toEqual(
      { kind: "seal" },
    );
  });

  it("falls back to the lane when what you picked is gone", () => {
    const g: Game = {
      ...initial(3),
      foes: [{ id: 11, d: 0.3, speed: 0.07, hp: 2, maxHp: 2, hurt: 0 }],
      focus: { kind: "foe", id: 404 },
    };

    expect(aim(g), "a squad aimed at nothing would just watch").toEqual({ kind: "foe", id: 11 });
  });
});

// The rest of the spec's first line is a claim about a whole round rather than
// one transition, so these play it out: a round has to be losable, and it has
// to end somewhere.

const FRAME = 16;

function play(choose: (g: Game) => Input, limitMs = 300_000): Game {
  let g = initial(7);
  for (let t = 0; t < limitMs; t += FRAME) {
    if (g.phase !== "playing") break;
    g = step(g, choose(g), FRAME);
  }
  return g;
}

describe("spec: a round ends somewhere", () => {
  it("is lost by holding the crystal while the lane fills --- a wrong move is possible", () => {
    const g = play((state) => (state.seal ? { kind: "seal" } : null));

    expect(g.phase, "fire spent on the crystal is fire not spent on the lane").toBe("lost");
  });

  it("is winnable: hold the lane, take the crystals in the gaps, see off the surge", () => {
    const g = play((state) => {
      const nearest = [...state.foes].sort((a, b) => a.d - b.d)[0];
      // Go for the crystal only while nothing is close enough to matter.
      if (nearest && nearest.d < 0.5) return { kind: "foe", id: nearest.id };
      return state.seal ? { kind: "seal" } : null;
    });

    expect(g.phase, "a game you cannot finish has no ending to reach").toBe("won");
    expect(g.broken).toBe(SEALS.length);
    expect(g.allies.length, "every crystal is two more of you").toBe(
      SQUAD_START + SEALS.length * PER_BREAK,
    );
  });
});
