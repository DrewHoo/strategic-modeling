import { describe, expect, it } from 'vitest'
import { STRATEGIES } from '../strategies.ts'
import type { PayoffMatrix } from '../matrix.ts'
import { forecast } from '../predict.ts'

const paperclips = STRATEGIES.filter((s) => s.set === 'paperclips')

// Game 8's anti-coordination matrix: A100/GREEDY/MINIMAX all collapse to
// always-cooperate, so they cluster near the top instead of one of them being a
// confident single winner.
const ANTI_COORD: PayoffMatrix = { CC: [5, 5], CD: [10, 7], DC: [7, 10], DD: [8, 8] }

describe('forecast', () => {
  const result = forecast(ANTI_COORD, paperclips, 10, 80)

  it('returns one row per strategy, sorted best-first by mean', () => {
    expect(result.rows).toHaveLength(paperclips.length)
    for (let i = 1; i < result.rows.length; i++) {
      expect(result.rows[i - 1].meanScore).toBeGreaterThanOrEqual(result.rows[i].meanScore)
    }
  })

  it('win rates form a probability distribution (sum ≈ 1)', () => {
    const total = result.rows.reduce((s, r) => s + r.winRate, 0)
    expect(total).toBeCloseTo(1, 5)
    for (const r of result.rows) expect(r.winRate).toBeGreaterThanOrEqual(0)
  })

  it('keeps every score inside its own min–max band', () => {
    for (const r of result.rows) {
      expect(r.minScore).toBeLessThanOrEqual(r.meanScore)
      expect(r.maxScore).toBeGreaterThanOrEqual(r.meanScore)
    }
  })

  it('surfaces the identical-mover cluster instead of a lone winner', () => {
    // A100, GREEDY, MINIMAX all play always-C here: their means should sit
    // within a few points of each other rather than diverging.
    const byName = new Map(result.rows.map((r) => [r.strategy.name, r.meanScore]))
    const trio = ['A100', 'GREEDY', 'MINIMAX'].map((n) => byName.get(n)!)
    const spread = Math.max(...trio) - Math.min(...trio)
    expect(spread).toBeLessThan(10)
  })
})
