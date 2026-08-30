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

### 5. The change that came from playing it

Everything above was reasoned. This one was played.

Opened cold and moved to the first star, the round was over in about a second
and a half: take the star, pause to look for the next one, and something red
was already touching me. No sight of where it came from, no chance to read it.

The instinct was to raise the delay. The actual fault was narrower and worse: a
shade retraces the player *exactly*, so every spot it walks through is a spot
the player stood in --- and arming was decided by the clock alone. Pausing after
a star is the most natural thing anyone does, and the rule armed whatever was
retracing that exact spot directly into them. A longer delay would have moved
the coin toss later, not removed it.

So the wake rule now has two conditions rather than one: its time is up **and**
it is clear of the player. That is a fairness invariant, not a number, so it
went under test alongside the catching rule --- one case asserts a shade stays
asleep long past its hour while it is still on the player
([`f685d50`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/commit/f685d50)).

The same session said the red thing read as a monster rather than as a copy of
me, which is the whole premise. It now wears the player's own comet silhouette
--- outline while harmless, filled once it can catch you --- and the player is
a comet rather than a ball, so the shape carries the idea before the colour
does.

### 6. The metaphor was load-bearing, and I had it as decoration

Played again, the abstract version still failed the same line, for a reason I
had been treating as an art problem: two shapes touching each other is not a
reason to touch them. A glowing dot could be read as a hazard, or as scenery,
or the whole board as something to watch rather than steer, and no amount of
pulse or particle fixes that.

What fixed it was a metaphor that carries the rules for free: a mouse wants
cheese, a cat wants the mouse, a cat follows prints. That last one is the piece
nothing else supplied --- "why does the enemy retrace my exact route" was the
only question the design could not answer about itself, and a cat with its nose
down answers it before anyone asks ([`15efc54`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/commit/15efc54)).

Timing the round rather than looking at it then found two more: glued to the
pointer the mouse teleported, and the round was won in 3.5 seconds before the
first cat had finished arriving; and cheese was being placed at whichever legal
spot stood clearest of the cats, quietly routing every trip around the danger
in a game that is supposed to be about ground you have already covered.

### 7. A metaphor needs a source, not just a skin

Renaming the parts was not enough. The cat still arrived as a dashed outline on
empty floor --- a system announcing a spawn --- and a player read it as exactly
that. The mouse and the cheese worked because a kitchen accounts for both of
them; nothing in the room accounted for a cat.

So the cats sleep in a bed in the corner from the first frame, and eating
cheese wakes one: ear, eyes, stretch, out, nose down, follow
([`bcc69d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/commit/bcc69d9)). The warning is no longer a UI state, it is
an animal getting up, and the causal chain a player can now watch --- noise
wakes cat, cat leaves bed, cat finds prints --- is the same chain that explains
the rules.

The bed did not survive contact either, and the reason sharpened the lesson.
Four cats slept in it and one walked out --- true in the code, unreadable on
screen: a cat asleep, another chasing, no way to see they were the same
population. A heap of animals is not countable at a glance, so the fiction
could not carry the arithmetic the rules depend on.

Charging slots can. In a gallery at night the drones sit one to a cradle, and
one that has driven out leaves its cradle visibly empty --- four slots, two
empty, two machines on the floor ([`e3451d3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/commit/e3451d3)). Two other
things stop being lies there: a patrol drone that glides is a patrol drone,
where a cat that glides is a cat missing its legs; and a heat trace has a reason
to cool, so the thing chasing you is visibly reading exactly what you can see.

The general lesson, and the one I would take to any brief that says "no
instructions": every element has to be accounted for by the world it is in,
and the fiction has to be able to carry whatever the rules count. An
unexplained element does not become explained by being renamed.

## What the tests cannot judge

Whether a stranger reaches an ending inside five minutes, and whether the
opening really does teach itself. Those are settled by four people's hands at
the crit, not by the suite.
