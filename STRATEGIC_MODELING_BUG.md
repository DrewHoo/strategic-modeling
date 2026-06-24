# Bug report — Strategic Modeling tournament: results depend on strategy roster order

**Game:** Universal Paperclips — *Strategic Modeling* minigame (observed on iOS)
**Area:** the strategy tournament / leaderboard scoring

## Summary

In the Strategic Modeling tournament, a strategy's final score depends on **where it sits in the roster**, not just on how it plays. Two strategies that make the *identical* sequence of moves finish with *different* scores, and the same strategy's total can land outside the range its own rules allow. The symptoms are consistent with **per-matchup state not being reset between pairings** — i.e. strategies sharing mutable state (last move / position) that leaks from one matchup into the next in roster order.

## The core defect (verifiable by inspection, no guesswork)

Two strategies that play an identical move every round **must** earn an identical total — same moves → same cells → same points, under any payoff matrix and any tournament structure. The game violates this.

**Example board** (your payoff / opponent payoff):

|              | opp: cooperate | opp: defect |
|--------------|:--------------:|:-----------:|
| **cooperate**|      4, 4      |    10, 5    |
| **defect**   |      5, 10     |     9, 9    |

On this board, by the strategies' own definitions, several collapse to a single fixed move:

- **A100, GREEDY, MINIMAX** all reduce to **always-cooperate** (the largest your-payoff cell is *cooperate / opp-defects* = 10, so GREEDY plays the cooperate row and MINIMAX likewise — please confirm against your definitions).
- **B100, GENEROUS** both reduce to **always-defect**.

They make move-for-move identical plays, so they should tie. Observed leaderboard:

| rank | strategy | score |
|---|---|---|
| 1 | A100 | **1130** |
| 2 | B100 | **1084** |
| 3 | GREEDY | **1066** |
| 4 | GENEROUS | **1064** |
| 5 | BEAT LAST | 1045 |
| 6 | RANDOM | 1036 |
| 7 | MINIMAX | **1036** |
| 8 | TIT FOR TAT | 981 |

Three "always-cooperate" strategies scored **1130 / 1066 / 1036**; two "always-defect" strategies scored **1084 / 1064**. Identical play, different scores — and the spread tracks roster position (earlier-listed scores higher among the always-cooperate group).

This reproduces on every cooperation-favoring board. A second example (payoffs 5,5 / 10,7 / 7,10 / 8,8): A100 / GREEDY / MINIMAX again all always-cooperate, and scored **1210 / 1150 / 1135**.

## Corroborating evidence

I rebuilt the tournament from the published strategy rules and compared against 10 captured games. Two further symptoms:

1. **Scores exceed what the rules allow.** Treating every strategy as following its stated rule, I computed each strategy's full reachable score range over 20,000 simulated tournaments. In 8 of 10 games **A100 finished above its theoretical maximum** (e.g. one board: scored 1360 vs. a hard ceiling of 1280 — 80 points that can't exist if all strategies follow spec), and **BEAT LAST finished below its theoretical minimum** in 8 of 10. (This part assumes the tournament structure I inferred — 8×8 round-robin, 10 rounds/matchup; the identical-movers proof above does not depend on any such assumption.)

2. **The roster-position effect is directional and stable.** Across all 10 games, **A100 (first in the roster) always over-performs** the rules-faithful prediction and **BEAT LAST (last in the roster) always under-performs**, by a near-equal margin; every other strategy scatters around zero. This is the signature of order-dependent state, not of strategy skill.

## Likely cause

Strategy objects appear to retain mutable state (e.g. previous-move / current-position fields) that is **not reset at the start of each matchup**, so a strategy's behavior in one pairing is contaminated by the prior pairing. Because pairings run in roster order, this gives early-listed strategies a systematic edge and late-listed ones a systematic penalty, and it desynchronizes strategies that should be identical.

## Suggested fix

Reset each strategy's per-match state at the start of every pairing (or make the move function pure — have it read only the current matchup's move history, passed in as arguments, rather than any persistent/shared field). After that, identical-behavior strategies should tie and leaderboard order should be independent of roster position.

## Why it matters

The leaderboard is currently a mix of strategy quality **and** roster position, so the displayed ranking can misrepresent which strategy is actually strongest for a given board.

---
*Reproduction data (10 boards with observed leaderboards) available on request.*
