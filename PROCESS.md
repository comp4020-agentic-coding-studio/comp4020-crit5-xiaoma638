# Process overview

## What I built

**One Second Behind** --- a gallery at night, gems in cases, and patrol drones
that follow the heat you leave on the floor. The route you take now is the route
you will have to avoid, so playing it is what teaches it.

## The moments that mattered

**A test falsified the design, not the code.** A playthrough test plays a whole
round against the pure machine and asserts the outcome. It failed in a way I had
not predicted: the greedy line simply *won*, which meant the trade the game was
built on did not exist. Every screenshot still looked right
([`fc543b1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/commit/fc543b1)). It now asserts that greed loses, so a
later tuning pass that flattens the trade goes red instead of reaching the crit.

**Playing it found an unfair death, and my first fix was wrong.** Opened cold, a
round ended a second and a half in: take the first pickup, pause to look around,
and something was already touching me. The instinct was to lengthen the delay.
The actual fault was that arming consulted the clock and not the distance --- a
pursuer retraces you exactly, so it walks through spots you stood in. A longer
delay moves that coin toss later; it does not remove it. Waking now needs time
**and** clearance, which is an invariant, so it went under test
([`f685d50`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/commit/f685d50)).

**The fiction has to carry what the rules count.** Four cats asleep in one bed
with one walking out was true in code and unreadable on screen. Charging
cradles are countable: four slots, two empty, two machines on the floor
([`e3451d3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-xiaoma638/commit/e3451d3)).

## What the tests cannot judge

Whether a stranger reaches an ending inside five minutes, and whether the
opening teaches itself. Four people's hands settle those, not the suite.
