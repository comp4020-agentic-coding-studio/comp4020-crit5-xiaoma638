import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  CAT_HIT,
  catsDue,
  DELAYS,
  initial,
  overlaps,
  PLAYER_HIT,
  SAFE_WAKE,
  step,
  WIN_AT,
  type Cat,
  type CatState,
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
// a cat is where you were, and touching one ends the round. It is a pure
// function of two circles, so it can be checked exactly --- including the
// graze, where the call between "caught" and "just made it" actually lives.
//
// All of this runs on the machine, not the canvas, so it stays true while the
// look of the thing changes underneath it.

const HERE = { x: 0.5, y: 0.5 };
const REACH = PLAYER_HIT + CAT_HIT;

describe("spec: a cat catches you", () => {
  it("catches when the two circles overlap", () => {
    const onTop = { x: HERE.x + REACH * 0.5, y: HERE.y };

    expect(overlaps(HERE, PLAYER_HIT, onTop, CAT_HIT)).toBe(true);
  });

  it("does not catch when they are clear of each other", () => {
    const away = { x: HERE.x + REACH * 3, y: HERE.y };

    expect(overlaps(HERE, PLAYER_HIT, away, CAT_HIT)).toBe(false);
  });

  it("reads an exact graze as a miss", () => {
    const grazing = { x: HERE.x + REACH, y: HERE.y };

    expect(
      overlaps(HERE, PLAYER_HIT, grazing, CAT_HIT),
      "touching at exactly the sum of the radii is the near miss that makes a fast pass feel fair",
    ).toBe(false);
  });

  it("still misses a hair outside, and catches a hair inside", () => {
    const outside = { x: HERE.x + REACH * 1.001, y: HERE.y };
    const inside = { x: HERE.x + REACH * 0.999, y: HERE.y };

    expect(overlaps(HERE, PLAYER_HIT, outside, CAT_HIT)).toBe(false);
    expect(overlaps(HERE, PLAYER_HIT, inside, CAT_HIT)).toBe(true);
  });
});

/** A cat mid-hunt unless told otherwise, parked wherever the trail is. */
function cat(over: Partial<Cat> = {}): Cat {
  return {
    id: 1,
    delay: 1.2,
    state: "tracking",
    stateFor: 9,
    anchor: 0,
    from: { x: 0, y: 0 },
    live: false,
    ...over,
  };
}

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
  it("is lost the moment an armed cat reaches the player", () => {
    const g = standing({ cats: [cat({ live: true })] });

    const after = step(g, { target: HERE }, 16);

    expect(after.phase, "standing where you stood is what loses this game").toBe("lost");
  });

  it("does not lose to one that has not armed yet", () => {
    const g = standing({ cats: [cat({ state: "sniffing", stateFor: 0 })] });

    const after = step(g, { target: HERE }, 16);

    expect(
      after.phase,
      "a cat fades up before it can catch you, so nothing arrives without warning",
    ).toBe("playing");
  });

  it("reaches the present on the eighth star", () => {
    const g = standing({
      score: WIN_AT - 1,
      cats: [],
      star: { x: HERE.x, y: HERE.y, born: 0 },
    });

    const after = step(g, { target: HERE }, 16);

    expect(after.phase, "a game you cannot finish has no ending to reach").toBe("won");
    expect(after.score).toBe(WIN_AT);
  });
});

// The fairness rule, which is worth as much as the catching rule. A cat
// retraces you exactly, so the spot it is walking through is a spot you stood
// in --- and standing still after taking a star is the most natural thing
// anyone does. Waking one on top of somebody is not difficulty, it is a coin
// toss they lose, and losing a round you never saw coming reads as a broken
// game rather than a hard one.

describe("spec: a cat will not wake on top of you", () => {
  it("stays asleep past its hour while it is still on the player", () => {
    // Its time is long past, and it is retracing the exact spot she is on.
    const g = standing({ cats: [cat()] });

    const after = step(g, { target: HERE }, 16);

    expect(after.cats[0].live, "time alone must not be enough to arm one").toBe(false);
    expect(after.phase, "and so the round survives standing still").toBe("playing");
  });

  it("wakes once it is clear of the player", () => {
    const clear = { x: HERE.x + SAFE_WAKE * 2, y: HERE.y };
    const g = standing({
      cats: [cat()],
      // The trail now runs through somewhere she is not.
      trail: [
        { x: clear.x, y: clear.y, t: 2.5 },
        { x: clear.x, y: clear.y, t: 5 },
      ],
    });

    const after = step(g, { target: HERE }, 16);

    expect(after.cats[0].live, "clear of her, it is fair game").toBe(true);
    expect(after.phase).toBe("playing");
  });
});

// Nothing that is still arriving can end a round. A cat announces itself from
// the edge, comes in, and puts its nose down on the prints before it follows
// them --- and someone who has just taken cheese and paused is standing on a
// spot those prints run through, so every one of those stages has to be safe
// even at point-blank range.

describe("spec: an arriving cat cannot catch anyone", () => {
  const arriving: CatState[] = ["looming", "entering", "sniffing"];

  for (const state of arriving) {
    it(`survives a ${state} cat sitting right on the player`, () => {
      const g = standing({ cats: [cat({ state, stateFor: 0, from: { ...HERE } })] });

      const after = step(g, { target: HERE }, 16);

      expect(after.phase, `a ${state} cat is an announcement, not a threat`).toBe("playing");
      expect(after.cats[0].live).toBe(false);
    });
  }

  it("only ends the round once one is tracking and has been clear of you", () => {
    const g = standing({ cats: [cat({ live: true })] });

    expect(step(g, { target: HERE }, 16).phase).toBe("lost");
  });
});

describe("spec: cats arrive on the cheese, never before", () => {
  it("sends none until the first piece is taken", () => {
    expect(catsDue(0)).toBe(0);
  });

  it("sends the first on the first piece, then one every second piece", () => {
    expect(catsDue(1)).toBe(1);
    expect(catsDue(2)).toBe(1);
    expect(catsDue(3)).toBe(2);
    expect(catsDue(5)).toBe(3);
    expect(catsDue(7)).toBe(4);
  });

  it("never sends more than it has delays for", () => {
    expect(catsDue(99)).toBe(DELAYS.length);
  });

  it("opens with nothing hunting", () => {
    expect(initial().cats, "the first piece of cheese is taken in peace").toEqual([]);
  });
});
