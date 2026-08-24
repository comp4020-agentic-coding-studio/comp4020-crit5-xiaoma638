import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

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
