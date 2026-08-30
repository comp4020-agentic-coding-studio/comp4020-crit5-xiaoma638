# Process overview

## What I built

**One Second Behind** --- a browser game with one mechanic: a glowing dot
follows your pointer, and about a second later a shade begins walking the exact
path you just walked. Every star adds another one, on its own delay. The skill
is that the route you take now is the route you will have to avoid, so the game
teaches itself by being played rather than by being read.

## The moments that mattered

### 1. Two builds thrown away, because the picture needed explaining

The first build was an instrument-like "break the seal" click game; the second
rebuilt it as a squad, bullets and a numbered gate
([`48c539d...c51b553`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/compare/48c539d...c51b553)). Both were playable
and green. Both failed the same line of the spec: a stranger could not tell
from the opening screen what anything was.

The obvious move was to keep patching the art. The call I made instead was that
"teaches itself in ten seconds" is a property of the **mechanic**, not of the
illustration --- so a design that needs a legend cannot be lit into one. The
third build makes the mechanic and the lesson the same event: take a star, and
watch something red retrace your own loop
([`3235c01`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/commit/3235c01)).

I knew this rather than guessed it because the second build had already been
played by someone who was not me, and the first thing they said was that they
could not tell what the left-hand side was.

### 2. A test caught a hole no screenshot could

In the squad build I wrote a playthrough test that plays a whole round frame by
frame against the pure machine. It failed in a way I had not predicted: holding
fire on the crystal from the first second **won**. Ten seconds of shooting, no
pressure, no trade --- the entire design premise was absent, and every
screenshot still looked correct
([`fc543b1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/commit/fc543b1)).

That test became a balance sensor rather than a one-off check: it asserts that
the greedy line *loses*, so a later tuning pass that flattens the trade goes
red instead of surviving to the crit.

### 3. Two bugs that only looking could find

Both came from Chrome at the two marking viewports, and neither was visible to
`pnpm check` ([`3235c01`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/commit/3235c01)):

- The board's real size can arrive **after** the module runs, and the opening
  is placed from it --- so the player started off-centre from a size that was
  never true. It now re-places the round while it is still the opening.
- Sizing a canvas clears it, and the observer that resizes it ran after a draw.
  A running loop hides that on the next frame; a paused or finished board just
  went blank.

The first is the same failure as the Assignment 1 note in `CLAUDE.md` about a
component that sizes itself from something other than its own box --- so it
went into the harness rather than only into the fix.

### 4. Deciding what a graze means

The collision rule is a pure function of two circles, which let me choose the
boundary deliberately rather than inherit it: touching at exactly the sum of
the radii reads as a **miss**. The tests pin all four cases --- clear overlap,
clear separation, the exact graze, and a hair either side of it --- because
that one call is what makes a fast pass feel fair rather than cheap.

## What the tests cannot judge

Whether a stranger reaches an ending inside five minutes, and whether the
opening really does teach itself. Those are settled by four people's hands at
the crit, not by the suite.
