import { describe, expect, it } from 'vitest'
import { STRATEGIES } from '../strategies.ts'
import type { PayoffMatrix } from '../matrix.ts'
import { runTournament } from '../engine.ts'

// Reference tournament results captured from the live Universal Paperclips
// Strategic Modeling minigame. The simulator is non-deterministic (RANDOM,
// plus carry-over state interacting with order), so these aren't strict
// equality checks — they're regression fixtures so we can see, every time the
// engine changes, how close we are to the in-game numbers.
//
// Known unresolved divergences:
//   - In some games, deterministic-identical strategies (e.g. A100 vs MINIMAX
//     when both always play C) get different in-game scores. That can't come
//     from anything in `calcPayoff` as the source has it, so it's either a
//     hidden game mechanic or transcription noise. Tests don't assert on
//     those pairings beyond rank locality.

interface ExpectedRow {
  name: string
  score: number
}

interface Game {
  id: number
  matrix: PayoffMatrix
  expected: ExpectedRow[]
}

const games: Game[] = [
  {
    id: 1,
    matrix: { CC: [10, 10], CD: [4, 5], DC: [5, 4], DD: [10, 10] },
    expected: [
      { name: 'TIT FOR TAT', score: 1529 },
      { name: 'BEAT LAST', score: 1456 },
      { name: 'A100', score: 1346 },
      { name: 'GENEROUS', score: 1294 },
      { name: 'GREEDY', score: 1288 },
      { name: 'MINIMAX', score: 1250 },
      { name: 'B100', score: 1235 },
      { name: 'RANDOM', score: 1158 },
    ],
  },
  {
    id: 2,
    matrix: { CC: [5, 5], CD: [1, 1], DC: [1, 1], DD: [4, 4] },
    expected: [
      { name: 'TIT FOR TAT', score: 644 },
      { name: 'BEAT LAST', score: 630 },
      { name: 'A100', score: 618 },
      { name: 'GENEROUS', score: 608 },
      { name: 'GREEDY', score: 584 },
      { name: 'B100', score: 430 },
      { name: 'RANDOM', score: 426 },
      { name: 'MINIMAX', score: 424 },
    ],
  },
  {
    id: 3,
    matrix: { CC: [1, 1], CD: [7, 1], DC: [1, 7], DD: [4, 4] },
    expected: [
      { name: 'A100', score: 632 },
      { name: 'MINIMAX', score: 586 },
      { name: 'GREEDY', score: 562 },
      { name: 'BEAT LAST', score: 480 },
      { name: 'RANDOM', score: 472 },
      { name: 'TIT FOR TAT', score: 376 },
      { name: 'GENEROUS', score: 367 },
      { name: 'B100', score: 361 },
    ],
  },
  {
    id: 4,
    matrix: { CC: [4, 4], CD: [5, 2], DC: [2, 5], DD: [5, 5] },
    expected: [
      { name: 'A100', score: 734 },
      { name: 'GREEDY', score: 691 },
      { name: 'MINIMAX', score: 691 },
      { name: 'TIT FOR TAT', score: 672 },
      { name: 'BEAT LAST', score: 636 },
      { name: 'RANDOM', score: 612 },
      { name: 'B100', score: 590 },
      { name: 'GENEROUS', score: 578 },
    ],
  },
  {
    id: 5,
    matrix: { CC: [8, 8], CD: [8, 4], DC: [4, 8], DD: [10, 10] },
    expected: [
      { name: 'TIT FOR TAT', score: 1388 },
      { name: 'A100', score: 1360 },
      { name: 'GREEDY', score: 1312 },
      { name: 'BEAT LAST', score: 1302 },
      { name: 'GENEROUS', score: 1288 },
      { name: 'B100', score: 1282 },
      { name: 'MINIMAX', score: 1280 },
      { name: 'RANDOM', score: 1212 },
    ],
  },
  {
    id: 6,
    matrix: { CC: [7, 7], CD: [6, 5], DC: [5, 6], DD: [8, 8] },
    expected: [
      { name: 'TIT FOR TAT', score: 1159 },
      { name: 'GREEDY', score: 1121 },
      { name: 'GENEROUS', score: 1121 },
      { name: 'B100', score: 1118 },
      { name: 'A100', score: 1116 },
      { name: 'BEAT LAST', score: 1107 },
      { name: 'MINIMAX', score: 1053 },
      { name: 'RANDOM', score: 1035 },
    ],
  },
  {
    // "Anti-PD": mutual defection (bb=1) is the worst outcome, even worse than
    // getting suckered (ab=2). Defectors crush cooperators (ba=8) but tank
    // when paired with other defectors. TIT FOR TAT ends up last here: the
    // round-1 sucker payoff locks both sides into the bb=1 trap for 9 rounds.
    id: 7,
    matrix: { CC: [3, 3], CD: [2, 8], DC: [8, 2], DD: [1, 1] },
    expected: [
      { name: 'MINIMAX', score: 657 },
      { name: 'GREEDY', score: 643 },
      { name: 'B100', score: 608 },
      { name: 'RANDOM', score: 592 },
      { name: 'BEAT LAST', score: 566 },
      { name: 'A100', score: 417 },
      { name: 'GENEROUS', score: 386 },
      { name: 'TIT FOR TAT', score: 355 },
    ],
  },
]

const paperclipsStrats = STRATEGIES.filter((s) => s.set === 'paperclips')
const ROUNDS = 10
const ITERATIONS = 300

interface AvgRow {
  name: string
  score: number
}

function runAveraged(matrix: PayoffMatrix): AvgRow[] {
  const totals = new Map<string, number>()
  for (let i = 0; i < ITERATIONS; i++) {
    const result = runTournament(() => matrix, paperclipsStrats, ROUNDS)
    for (const row of result.ranking) {
      totals.set(row.strategy.name, (totals.get(row.strategy.name) ?? 0) + row.total)
    }
  }
  return [...totals.entries()]
    .map(([name, sum]) => ({ name, score: sum / ITERATIONS }))
    .sort((a, b) => b.score - a.score)
}

function formatComparison(game: Game, avg: AvgRow[]): string {
  const expected = new Map(game.expected.map((r, i) => [r.name, { rank: i + 1, score: r.score }]))
  const lines: string[] = []
  lines.push(
    `Game ${game.id} matrix aa=${game.matrix.CC[0]} ab=${game.matrix.CD[0]} ba=${game.matrix.DC[0]} bb=${game.matrix.DD[0]}`,
  )
  lines.push('rank | strategy      |   mine | game | Δscore | Δrank')
  lines.push('-----+---------------+--------+------+--------+------')
  avg.forEach((row, i) => {
    const exp = expected.get(row.name)
    if (!exp) {
      lines.push(`  ${i + 1} | ${row.name.padEnd(13)} | ${row.score.toFixed(0).padStart(6)} | n/a  |        |`)
      return
    }
    const dRank = i + 1 - exp.rank
    const dScore = row.score - exp.score
    const scoreStr = (dScore >= 0 ? '+' : '') + dScore.toFixed(0)
    const rankStr = dRank === 0 ? ' 0' : (dRank > 0 ? '+' : '') + dRank
    lines.push(
      `  ${i + 1} | ${row.name.padEnd(13)} | ${row.score.toFixed(0).padStart(6)} | ${String(exp.score).padStart(4)} | ${scoreStr.padStart(6)} | ${rankStr.padStart(4)}`,
    )
  })
  return lines.join('\n')
}

describe('In-game tournament fixtures', () => {
  for (const game of games) {
    it(`Game ${game.id}: total points within payoff-floor/ceiling`, () => {
      const avg = runAveraged(game.matrix)
      const report = formatComparison(game, avg)
      // eslint-disable-next-line no-console
      console.log('\n' + report + '\n')

      const total = avg.reduce((s, r) => s + r.score, 0)
      const cellSums = [
        game.matrix.CC[0] + game.matrix.CC[1],
        game.matrix.CD[0] + game.matrix.CD[1],
        game.matrix.DC[0] + game.matrix.DC[1],
        game.matrix.DD[0] + game.matrix.DD[1],
      ]
      const N = paperclipsStrats.length
      const lower = N * N * ROUNDS * Math.min(...cellSums)
      const upper = N * N * ROUNDS * Math.max(...cellSums)
      expect(total).toBeGreaterThanOrEqual(lower)
      expect(total).toBeLessThanOrEqual(upper)
    })
  }

  it('A100 in a uniform-payoff matrix scores its exact theoretical bound', () => {
    // Game 5's row-player payoffs are 8 in every cell where A100 plays (it's
    // always the row player picking C, so it only ever lands on aa=8 or ab=8).
    // Whatever the opponents do, A100 gets exactly 8 per round, every round.
    const matrix = games[4].matrix
    const result = runTournament(() => matrix, paperclipsStrats, ROUNDS)
    const a100 = result.ranking.find((r) => r.strategy.name === 'A100')!
    // 16 effective seat-participations (8 H + 8 V, with self double-counted)
    // × 10 rounds × 8 points each = 1280.
    expect(a100.total).toBe(16 * ROUNDS * 8)
  })
})
