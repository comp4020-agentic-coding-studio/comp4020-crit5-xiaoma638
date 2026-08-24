# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo. It's marked live in Chrome against the
deployed URL at two viewports --- 1920×1080 (desktop) and 390×844 (phone) ---
and both count in full, so make that artefact good at both.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- typecheck,
  build, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI; run `pnpm dlx linkinator ./dist --silent`
  locally against a fresh `pnpm build` for the links check without waiting for
  CI.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Commit when the checks pass. Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so the deployed head is the only place a broken one shows up.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
and the spec with `&&`), so an early failure like a broken build stops the later
sensors from running for that push; fix it and push again to see the rest. While
the repo is private (all week, until you ship) the CI jobs stay skipped ---
`pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `tsc --noEmit` runs first in `pnpm check`, so a type error
  stops the roster before the build even starts. The types are extra
  backpressure: a red here is the compiler telling you a claim in the code is
  false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `CLAUDE.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

**Lint is no longer in the roster.** Assignment 1 ran `oxlint` and `stylelint`
in `pnpm check`; the current starter template drops both, so nothing now reads
your CSS or flags non-idiomatic TypeScript. That's a sensor you used to have and
don't --- if something starts slipping through, wiring one back in is your call
and belongs in `check`.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack is swappable

Out of the box this is plain HTML/CSS/TypeScript on Vite, and every `.html` file
in the repo is a page: add pages, link them, and the build picks them up with no
config. That's a default, not a rule (unless the week's spec says otherwise).
You can swap in Astro or any other static generator, because nothing in CI names
a tool --- the whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so configure your generator's base path --- this
template's Vite config uses relative asset URLs to sidestep that, but most
generators (Astro included) need `base` set explicitly, and getting it wrong
looks fine locally while every asset 404s on the live URL. And commit the
updated `pnpm-lock.yaml`: CI installs with `--frozen-lockfile`.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `CLAUDE.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `CLAUDE.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.

This file and the sensors you wire into `check` carry across the course --- both
come with you into next week's repo. The prototype doesn't: source, and the
tests answering this week's published spec, stay behind. `spec/README.md` draws
the line.

## Working method (carried forward from week 3)

For substantial tasks, follow this sequence:

1. **Understand** --- the relevant spec requirement, the user need, the
   relevant files, and how the result will be verified. Don't modify several
   files immediately after a broad request.
2. **Plan** --- before a multi-file change, give a concise plan: intended
   outcome, files likely to change, and how it'll be checked. Keep it
   realistic.
3. **Implement** --- one meaningful slice at a time. Prefer small,
   understandable changes over unrelated refactors.
4. **Verify** --- run the relevant checks, inspect the rendered result at both
   viewports, and correct failures before continuing.
5. **Document** --- update process evidence (`PROCESS.md`, commits) as the work
   happens, not reconstructed at the end.

## Task reports

Before a substantial task, briefly state the requirement being addressed, the
likely files involved, and how the result will be checked. After it, briefly
report what changed, why, the checks actually run, and whether both viewports
were inspected. Keep reports short for small edits, and be honest about
anything not checked.

## Commit discipline

Commit meaningful stages, not one final dump. Use specific messages describing
what changed and why (e.g. "Add hero section with race facts"), not vague ones
("update", "changes", "fix stuff"). Commit only after the relevant checks pass
--- never knowingly commit a broken state.

## Carried forward from Assignment 1

Each of these came from something that actually went wrong building the
solar-distance prototype. They're written down so the same failure costs less
the second time.

- **Propose the commit; don't wait to be asked.** The rule above already said
  "not one final dump", and Assignment 1 was still written across a week and
  committed the day before it was due --- a rule nobody acts on is not a
  harness. So: whenever `pnpm check` goes red to green, or a task finishes,
  stop and offer a commit with a specific message before starting the next
  thing.

- **Green checks are not a rendered page.** Nothing in the roster looks at
  layout. Every viewport bug this week --- the illusion's ring collapsing, the
  labels colliding near dawn --- was invisible to `pnpm check` and obvious
  within seconds at 390x844. Open both marking viewports before calling a
  visual change done.

- **Say whether a visual claim was seen or computed.** When `agent-browser`
  isn't installed, geometry can still be worked out on paper --- but a
  calculated result and an observed one are different kinds of evidence, and
  reporting the first as if it were the second is how a confident wrong fix
  ships. Name which one it is, every time.

- **A component positioned internally in px owns its own box size.** The
  Ebbinghaus figure placed every ring dot absolutely, in px, against a 146px
  cluster; a breakpoint then narrowed the cluster to 132px. The dots didn't
  move with it, so the ring collapsed onto the centre disc and the illusion
  stopped demonstrating anything --- with every check still green, because
  nothing measures whether a figure still means what it claims. If a breakpoint
  needs a component smaller, scale it rather than resize it, and when a scale
  is mirrored in a custom property other elements derive from, change both or
  neither.

- **A passing local build says nothing about the deployed site.** `public/` sat
  untracked through the whole build: `pnpm build` passed because the files were
  on disk, and the deploy would have lost every clip and the globe texture.
  After adding an asset, confirm it's tracked, and prefer formats the marking
  browser is guaranteed to accept --- the clips were `.mov`, which Pages serves
  as `video/quicktime` and Chrome is under no obligation to play. Declare the
  type explicitly rather than leaving the browser to sniff it.

- **Check an asset's real dimensions against the size it renders at.** The two
  clips were 2940px wide and displayed at about 500px: 41MB of video that could
  never reach the screen, on a page whose argument depends on the reader
  actually watching them.

- **The stated idea and the built artefact have to agree.** `PROCESS.md`
  claimed the page celebrated the children's curiosity while the page itself
  ended on Confucius's restraint. A marker reads the claim first and then looks
  for it, so read the two against each other before shipping and fix whichever
  one is wrong.

## Carried forward from Crit 4

These came from building Grid 32, the 4×8 synthesised instrument. Some are
mistakes, some are moves that worked and should be repeated on purpose.

- **The first answer is about eighty per cent, and the missing twenty is mine
  to name.** "Add visual feedback" returned circles, pulses and a glow, all
  white --- a fair answer to a loose question, which is why it took three
  rounds to get past. Naming the actual contents (triangles, five-pointed
  stars, an arc that draws itself, orbiting dots, a ring turned in 3D, a
  curated palette per scene instead of white) landed finished in one pass
  ([`b21b5c7...4a54578`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xiaoma638/compare/b21b5c7...4a54578)).
  Don't re-prompt for "better". Re-prompt with the list.

- **Two instructions, each carried out correctly, can cancel each other out.**
  "Tune it to do re mi" and "make the instrument families cross over instead of
  one per row" were both done exactly as asked; together they left only two
  pitched cells on any row, so the scale was in the code and inaudible in the
  room. Nothing was red. After a change that touches the same surface as an
  earlier one, go back and re-test the earlier one's claim by hand --- and look
  for the arrangement that satisfies both rather than reverting either
  ([`21a95d8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xiaoma638/commit/21a95d8)).

- **State up front what the tests cannot judge.** The roster can prove a
  collision ends the round; it cannot hear a chord, feel a drag, or tell you
  whether a stranger knows what to do. Before building, say out loud which spec
  lines are machine-checkable and which are mine to settle by playing --- so
  the unjudgeable ones get scheduled hands-on time instead of being discovered
  at the crit.

- **Turn a platform constraint into the way in.** The AudioContext needs a user
  gesture before it will make a sound, and the page had been opening straight
  onto a playable surface that read as empty. A single Start button satisfied
  the requirement *and* became the invitation to the first move; the keyboard
  is gated on the same flag so a key press can't walk past the door
  ([`ec402f3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xiaoma638/commit/ec402f3)).
  When the platform forces a step, make it the affordance rather than
  apologising for it.

- **Stopping a node is not disconnecting it.** The oscillators stopped, but the
  gains and filters they fed stayed wired into the master bus for as long as
  the page was open. The fix was a disposable sub-graph per note, torn down by
  a silent `ConstantSourceNode` scheduled on the audio clock --- not a timer,
  which drifts out of step with the sound and piles up on the main thread
  ([`06cdc4a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xiaoma638/commit/06cdc4a)).
  Schedule teardown on the same clock as the thing being torn down.

- **Make the performance budget an input, not a postmortem.** Under a fast drag
  the page has to stay honest: a live-element pool with a ceiling and
  oldest-out-first, a `headroom` value every effect consults so a crowded page
  answers with fewer, larger gestures, and an input path that reads no layout
  at all (measure the grid once and on resize, find cells by arithmetic,
  coalesce pointer moves to one pass per frame). Decide the ceiling before
  writing the loop
  ([`4a54578`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-xiaoma638/commit/4a54578)).
