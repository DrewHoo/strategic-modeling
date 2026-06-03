import type { Strategy } from './strategies.ts'
import type { TournamentResult } from './engine.ts'

export interface OppMargin {
  opp: Strategy
  diff: number
  myScore: number
  theirScore: number
}

export interface FieldVerdict {
  idx: number
  strategy: Strategy
  rank: number
  total: number
  avg: number
  wins: number
  losses: number
  ties: number
  bestOpp: OppMargin | null
  worstOpp: OppMargin | null
  commentary: string
}

export function analyzeField(
  strategies: Strategy[],
  result: TournamentResult,
): FieldVerdict[] {
  const N = strategies.length
  const { grid, totals, ranking } = result
  const rankByIdx = new Map<number, number>()
  ranking.forEach((r, i) => rankByIdx.set(r.idx, i + 1))

  return strategies.map((strat, i) => {
    let wins = 0
    let losses = 0
    let ties = 0
    let bestOpp: OppMargin | null = null
    let worstOpp: OppMargin | null = null
    for (let j = 0; j < N; j++) {
      if (j === i) continue
      const myScore = grid[i][j]
      const theirScore = grid[j][i]
      const diff = myScore - theirScore
      if (diff > 0) wins++
      else if (diff < 0) losses++
      else ties++
      const margin: OppMargin = { opp: strategies[j], diff, myScore, theirScore }
      if (!bestOpp || diff > bestOpp.diff) bestOpp = margin
      if (!worstOpp || diff < worstOpp.diff) worstOpp = margin
    }
    const rank = rankByIdx.get(i) ?? 0
    const total = totals[i]
    const avg = total / N
    const commentary = makeCommentary(rank, N, wins, losses, ties, bestOpp, worstOpp)
    return { idx: i, strategy: strat, rank, total, avg, wins, losses, ties, bestOpp, worstOpp, commentary }
  })
}

function makeCommentary(
  rank: number,
  N: number,
  wins: number,
  losses: number,
  ties: number,
  bestOpp: OppMargin | null,
  worstOpp: OppMargin | null,
): string {
  const parts: string[] = []

  if (rank === 1) parts.push('Leads this field.')
  else if (rank === 2) parts.push('Strong second.')
  else if (rank <= Math.max(2, Math.floor(N * 0.3))) parts.push('Near the top of the field.')
  else if (rank > N - 2) parts.push('Trails this field.')
  else if (rank > N / 2) parts.push('Bottom half of the field.')
  else parts.push('Mid-pack against this field.')

  if (wins === 0 && losses === 0) {
    parts.push('Ties every other strategy head-to-head — solid floor, no upside.')
  } else if (losses === 0 && wins > 0) {
    parts.push(`Never falls behind in any head-to-head (${wins}–0–${ties}).`)
  } else if (wins === 0 && losses > 0) {
    parts.push(`Never wins a head-to-head (${wins}–${losses}–${ties}); it’s bleeding everywhere it doesn’t tie.`)
  } else if (losses > wins) {
    parts.push(`Loses more head-to-heads than it wins (${wins}–${losses}–${ties}).`)
  } else if (wins > losses) {
    parts.push(`Wins more head-to-heads than it loses (${wins}–${losses}–${ties}).`)
  } else {
    parts.push(`Even head-to-head record (${wins}–${losses}–${ties}).`)
  }

  if (bestOpp && bestOpp.diff > 0) {
    parts.push(`Best matchup: beats ${bestOpp.opp.name} by ${bestOpp.diff}.`)
  }
  if (worstOpp && worstOpp.diff < 0) {
    parts.push(`Worst matchup: loses to ${worstOpp.opp.name} by ${-worstOpp.diff}.`)
  }

  return parts.join(' ')
}
