import type { Strategy, Move } from './strategies.ts'
import type { PayoffMatrix } from './matrix.ts'
import { C, payoff } from './matrix.ts'

export interface MatchRound {
  round: number
  moveA: Move
  moveB: Move
  payoffA: number
  payoffB: number
  totalA: number
  totalB: number
}

export interface MatchResult {
  scoreA: number
  scoreB: number
  log: MatchRound[]
}

// Optional primes simulate the game's hMovePrev/vMovePrev carrying over from
// the previous matchup. Strategies that look at "opponent's last move" on
// round 1 read the primed value; payoff scoring only covers the actual rounds.
export function playMatch(
  matrix: PayoffMatrix,
  a: Strategy,
  b: Strategy,
  rounds: number,
  initialA: Move = C,
  initialB: Move = C,
): MatchResult {
  const historyA: Move[] = [initialA]
  const historyB: Move[] = [initialB]
  const log: MatchRound[] = []
  let scoreA = 0
  let scoreB = 0
  for (let i = 0; i < rounds; i++) {
    const moveA = a.play(historyA, historyB, matrix)
    const moveB = b.play(historyB, historyA, matrix)
    const [pa, pb] = payoff(matrix, moveA, moveB)
    scoreA += pa
    scoreB += pb
    historyA.push(moveA)
    historyB.push(moveB)
    log.push({ round: i + 1, moveA, moveB, payoffA: pa, payoffB: pb, totalA: scoreA, totalB: scoreB })
  }
  return { scoreA, scoreB, log }
}

export interface RankRow {
  strategy: Strategy
  idx: number
  total: number
}

// matrixSource is called once per ordered (h, v) pairing. Use a constant
// function for fixed-matrix tournaments; use one that calls a generator for
// the in-game "fresh matrix per matchup" mode.
export type MatrixSource = (h: number, v: number) => PayoffMatrix

export interface TournamentResult {
  // matchups[h][v] = the result of the matchup where strategy h plays as H and
  // strategy v plays as V (so .scoreA is h's score, .scoreB is v's score).
  matchups: MatchResult[][]
  // matrices[h][v] = the payoff matrix used for that matchup.
  matrices: PayoffMatrix[][]
  // grid[i][j] = strategy i's total score against j, summed across both
  // role orderings: matchups[i][j].scoreA + matchups[j][i].scoreB. For i === j
  // it's the full self-match (both scores belong to the same strategy).
  grid: number[][]
  totals: number[]
  ranking: RankRow[]
}

export function runTournament(
  matrixSource: MatrixSource,
  strategies: Strategy[],
  rounds: number,
): TournamentResult {
  const N = strategies.length
  const matchups: MatchResult[][] = Array.from({ length: N }, () => new Array(N) as MatchResult[])
  const matrices: PayoffMatrix[][] = Array.from({ length: N }, () => new Array(N) as PayoffMatrix[])

  // Game-faithful matchup order: pickStrats sweeps h from 0..N-1. For h=0 the
  // v sequence is 0,1,...,N-1; for h>=1 it's 1,2,...,N-1,0 (stratCounter wraps
  // mod N). Carrying that order matters because hMovePrev/vMovePrev are
  // globals — they don't reset between matchups.
  const order: { h: number; v: number }[] = []
  for (let v = 0; v < N; v++) order.push({ h: 0, v })
  for (let h = 1; h < N; h++) {
    for (let s = 1; s < N; s++) order.push({ h, v: s })
    order.push({ h, v: 0 })
  }

  let lastHMove: Move = C
  let lastVMove: Move = C

  for (const { h, v } of order) {
    const m = matrixSource(h, v)
    matrices[h][v] = m
    // Self-match quirk: the game's pickStrats overwrites currentPos to 2 on
    // the shared strategy object, so TFT/BEAT LAST in a self-match both read
    // hMovePrev (not vMovePrev). Mirror that by priming both seat histories
    // with lastHMove instead of the split (lastHMove, lastVMove).
    const initA = lastHMove
    const initB = h === v ? lastHMove : lastVMove
    const result = playMatch(m, strategies[h], strategies[v], rounds, initA, initB)
    matchups[h][v] = result
    const last = result.log[result.log.length - 1]
    lastHMove = last.moveA
    lastVMove = last.moveB
  }

  const grid: number[][] = Array.from({ length: N }, () => new Array(N).fill(0))
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) {
        grid[i][j] = matchups[i][i].scoreA + matchups[i][i].scoreB
      } else {
        grid[i][j] = matchups[i][j].scoreA + matchups[j][i].scoreB
      }
    }
  }

  const totals: number[] = grid.map((row) => row.reduce((a, b) => a + b, 0))

  // Tie-break by lineup position (ascending index). In the live game, when
  // several strategies play identical move sequences (common in degenerate
  // matrices — e.g. A100/GREEDY/MINIMAX all always-cooperate), the earlier-
  // listed strategy scores higher. Our stateless engine ties them exactly, so
  // ordering ties by index reproduces that "earliest wins" bias. Measured
  // across the captured game fixtures this lowers mean rank error (~0.78→0.72).
  const ranking: RankRow[] = strategies
    .map((s, i) => ({ strategy: s, idx: i, total: totals[i] }))
    .sort((a, b) => b.total - a.total || a.idx - b.idx)

  return { matchups, matrices, grid, totals, ranking }
}
