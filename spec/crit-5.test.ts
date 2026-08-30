import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { initial, SEALS, STAFF, SURGE, step, type Game } from "../logic.ts";

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

// The one rule of this game put under a focused test, as the spec asks. It is
// the rule the whole thing turns on: a hit spent on the crystal is a hit not
// spent on what's walking at you, and this is what that spend buys. It runs on
// the pure state machine --- no DOM, no clock --- so it stays true while the
// look of the thing changes underneath it.

function midRound(over: Partial<Game> = {}): Game {
  return { ...initial(), phase: "playing", cooldown: 0, staff: 0, ...over };
}

function sealAt(hp: number): Game["seal"] {
  return { id: 99, index: 0, hp, maxHp: SEALS[0], hurt: 0 };
}

describe("spec: breaking a seal is what arms the staff", () => {
  it("shatters on the hit that takes its last point, and moves the staff up", () => {
    const before = midRound({ seal: sealAt(1) });
    const after = step(before, { kind: "seal" }, 0);

    expect(after.broken).toBe(1);
    expect(after.staff, "a broken seal is the only thing that arms the staff").toBe(1);
    expect(
      after.seal?.id,
      "that seal is gone --- whatever stands there now is the next one",
    ).not.toBe(before.seal?.id);
  });

  it("leaves the lane bare once the last seal falls, and calls the surge", () => {
    const last = SEALS.length - 1;
    const after = step(
      midRound({
        broken: last,
        staff: STAFF.length - 1,
        seal: { id: 99, index: last, hp: 1, maxHp: SEALS[last], hurt: 0 },
      }),
      { kind: "seal" },
      0,
    );

    expect(after.seal, "nothing else rises --- the round has somewhere to end").toBeNull();
    expect(after.surgeLeft, "the last break is what starts the ending").toBe(SURGE);
  });

  it("stands while it still has points, and the staff waits", () => {
    const after = step(midRound({ seal: sealAt(2) }), { kind: "seal" }, 0);

    expect(after.seal?.hp).toBe(1);
    expect(after.staff, "the staff moves on the break, not on the hit").toBe(0);
  });

  it("spends the staff's cooldown on the hit", () => {
    const after = step(midRound({ seal: sealAt(2) }), { kind: "seal" }, 0);

    expect(
      after.cooldown,
      "without a cooldown there is no cost to a hit, and no choice to make",
    ).toBe(STAFF[0].cooldown);
  });

  it("ignores a hit while the staff is still cooling", () => {
    const cooling = midRound({ seal: sealAt(1), cooldown: 100 });
    const after = step(cooling, { kind: "seal" }, 0);

    expect(after.seal?.hp, "a cooling staff fires nothing").toBe(1);
    expect(after.staff).toBe(0);
  });
});
