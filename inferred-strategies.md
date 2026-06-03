# Strategies and tournament structure

This is the source of truth for what the `set: 'paperclips'` strategies in [src/strategies.ts](src/strategies.ts) do and how the tournament in [src/engine.ts](src/engine.ts) runs. The behaviors mirror Universal Paperclips' Strategic Modeling minigame; the academic set is separate (see the bottom of this file).

## Move and payoff conventions

Moves are **A** (cooperate) and **B** (defect). The four cells of a payoff matrix are labeled by the row player's perspective:

| label | meaning | this repo |
|---|---|---|
| `aa` | both play A | `m.CC[0]` |
| `ab` | I play A, opp plays B | `m.CD[0]` |
| `ba` | I play B, opp plays A | `m.DC[0]` |
| `bb` | both play B | `m.DD[0]` |

The matrix is symmetric in the row-player sense: `CC[0]=CC[1]`, `DD[0]=DD[1]`, `CD[0]=DC[1]`, `CD[1]=DC[0]`. When both cooperate, both score `aa`. When one cooperates and one defects, the cooperator scores `ab` and the defector scores `ba`, regardless of who's at the H or V seat.

Several strategies use a single helper, `biggestForRow(m)`, that returns the index of the cell with the largest row-player payoff. Ties resolve to the earliest index in the order `CC, CD, DC, DD`.

Initial-round convention: the engine treats each side's "previous move" as A on round 1, so any history-based strategy sees opponent C on the first move.

## Strategies (paperclips set)

| name | rule |
|---|---|
| **A100** | Always A. |
| **B100** | Always B. |
| **RANDOM** | A or B with equal probability. |
| **TIT FOR TAT** | Opponent's previous move. |
| **GREEDY** | The row of the biggest cell. In a standard PD that's B. |
| **GENEROUS** | The column of the biggest cell. In a standard PD that's A. |
| **MINIMAX** | The opposite column of the biggest cell. In a standard PD that's B. |
| **BEAT LAST** | Best response to opponent's previous move: if their last was A, the row that pays more in column A; if B, the row that pays more in column B. Strict `>` — ties resolve to B. |

GREEDY and MINIMAX coincide in any matrix whose biggest cell is `aa` or `ba`. GENEROUS and MINIMAX always disagree. BEAT LAST defects in any standard PD but flips in atypical matrices.

## Tournament structure

- **10 moves per matchup.** Adjustable via the slider; the in-game default is 10.
- **Both players move simultaneously each round.** No turn order.
- **Round-robin over every ordered (H, V) pair.** For N strategies that's N² matchups, including each strategy against itself.
- **One matrix per tournament.** The matrix in the editor is the matrix every matchup plays on. Editing the matrix re-runs the tournament.
- **Game-style matrix generator.** Four uniform integer draws in [1, 10], no PD constraints — most generated matrices are valid PDs, some aren't. The "Valid PD" / "Not a PD" badge labels whichever just came out.

A strategy's total score is its sum across all matchups it participated in (N matchups as H plus N as V; the self-match contributes both seats to its total).

## Academic set

`TIT FOR TWO TATS`, `GRUDGER`, `PAVLOV`, `GENEROUS TFT`, and `DETECTIVE` are not in the game. They're textbook iterated-PD strategies from Axelrod's 1980 tournament and the surrounding literature, kept here as opt-in extras via the "Include academic strategies" toggle. Their definitions are standard and live in [src/strategies.ts](src/strategies.ts) alongside the paperclips set.
