# One Second Behind

A small neon game, built for COMP4020 Crit 5. Static HTML/CSS/TypeScript on
Vite, deployed to GitHub Pages.

The game teaches itself by being played, so there is nothing about it here.

## Working on it

```sh
mise install       # the Node and pnpm versions this repo is tested against
pnpm install
pnpm dev             # local dev server
pnpm check           # typecheck, build, and the spec suite
pnpm check:evidence  # the process-evidence check CI runs before shipping
pnpm build           # produce dist/
```

## What's where

- `logic.ts` --- the whole round as data plus one pure `step`. No DOM, no
  timers, no ambient randomness: the seed travels in the state, so the same
  round replays the same way and the tests need no clock. Space is measured in
  short-side units, so a phone and a monitor get the same game rather than the
  same pixels.
- `render.ts` --- canvas, and nothing that decides anything.
- `main.ts` --- the loop, and the only place input enters.
- `spec/` --- the shipped invariants, plus this week's contract tests.
- `PROCESS.md` --- how the work came together, with citations.
- `reflections/crit-5.md` --- this week's reflection.
