# Crit 5 — One Second Behind

## The breakthrough

My biggest breakthrough was realising that a game with no instructions cannot
depend on clearer labels or better-looking graphics. The mechanic and the game
world have to explain the rules by themselves.

I learned this after making two versions that worked technically but were still
confusing to a new player. In the final version, taking a gem sets off an alarm,
a drone leaves a visible charging bay, and it follows the player's heat trail.
The gallery is not just a visual theme: empty charging slots show how many
drones are active, and the trail explains why they repeat the player's route. A
short pause before the next gem also gives the player time to notice what their
last action caused.

## What it changed

This project changed how I think about testing. Before, I mostly used tests to
check that code still behaved as expected. During this crit, a full playthrough
test showed that the easiest strategy in an earlier version could win without
engaging with its intended risk. The build looked correct in screenshots, but
the main design idea was not actually working.

I now want to test design assumptions as well as implementation details. I
tested that a drone cannot become dangerous while it is still on the player,
and that a new gem appears away from the cabinet just emptied. However, tests
cannot prove that a first-time player understands the game. I need to separate
what I have measured from what I have observed through playtesting. As a
developer, I want to question a working build and remove it when its central
idea is not clear.
