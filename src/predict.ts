import type { Strategy } from './strategies.ts'
import type { PayoffMatrix } from './matrix.ts'
import { runTournament } from './engine.ts'

// A single tournament is non-deterministic (RANDOM, plus carry-over state
// interacting with matchup order), and in degenerate matrices several
// strategies collapse to identical move sequences whose ordering is decided by
// noise. A one-shot ranking therefore reads as confident when it isn't. The
// forecast runs the tournament many times and reports the distribution: mean
// score, a min–max band, and how often each strategy actually tops the field.

export interface Forecast {
  idx: number
  strategy: Strategy
  meanScore: number
  minScore: number
  maxScore: number
  // Share of runs this strategy finished strictly first. Co-leaders within a
  // run split the win equally, so a cluster of identical-move strategies shows
  // up as a split (e.g. ~33% each) rather than a false single winner.
  winRate: number
  rankMean: number
}

export interface ForecastResult {
  iterations: number
  // Sorted best-first: by mean score, ties broken by lineup position (the live
  // game's "earliest-listed wins" rule — see engine.ts ranking).
  rows: Forecast[]
}

export function forecast(
  matrix: PayoffMatrix,
  strategies: Strategy[],
  rounds: number,
  iterations: number,
): ForecastResult {
  const N = strategies.length
  const sum = new Array<number>(N).fill(0)
  const min = new Array<number>(N).fill(Infinity)
  const max = new Array<number>(N).fill(-Infinity)
  const winShare = new Array<number>(N).fill(0)
  const rankSum = new Array<number>(N).fill(0)

  for (let it = 0; it < iterations; it++) {
    const { totals } = runTournament(() => matrix, strategies, rounds)

    let best = -Infinity
    for (let i = 0; i < N; i++) {
      const t = totals[i]
      sum[i] += t
      if (t < min[i]) min[i] = t
      if (t > max[i]) max[i] = t
      if (t > best) best = t
    }

    // Winners = everyone tied for the top score this run; split the win.
    const winners: number[] = []
    for (let i = 0; i < N; i++) if (totals[i] === best) winners.push(i)
    for (const i of winners) winShare[i] += 1 / winners.length

    // Average finishing rank (1 = best). Standard competition ranking: a
    // strategy's rank is 1 + (how many scored strictly higher).
    for (let i = 0; i < N; i++) {
      let above = 0
      for (let j = 0; j < N; j++) if (totals[j] > totals[i]) above++
      rankSum[i] += above + 1
    }
  }

  const rows: Forecast[] = strategies.map((s, i) => ({
    idx: i,
    strategy: s,
    meanScore: sum[i] / iterations,
    minScore: min[i],
    maxScore: max[i],
    winRate: winShare[i] / iterations,
    rankMean: rankSum[i] / iterations,
  }))

  rows.sort((a, b) => b.meanScore - a.meanScore || a.idx - b.idx)
  return { iterations, rows }
}
