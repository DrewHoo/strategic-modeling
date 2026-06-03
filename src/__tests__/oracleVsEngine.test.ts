import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runTournament } from '../engine.ts'
import { STRATEGIES } from '../strategies.ts'
import type { PayoffMatrix } from '../matrix.ts'
import { runOracleTournament } from './oracleAdapter.ts'

const here = dirname(fileURLToPath(import.meta.url))
const ORACLE_PATH = resolve(here, '../original sourcecode/main.js')
// The oracle is the vendored in-game source — kept out of the public repo for
// copyright. When it's not present, skip the comparison tests cleanly.
const hasOracle = existsSync(ORACLE_PATH)
const describeOracle = hasOracle ? describe : describe.skip

// Directly compare our engine's output to the in-game tournament code, loaded
// from the vendored main.js. Both sides have RNG (RANDOM strategy + indirect
// effects via carry-over), so we average over many iterations and require the
// per-strategy means to agree closely.

interface Case {
  id: number
  matrix: PayoffMatrix
}

const cases: Case[] = [
  { id: 1, matrix: { CC: [10, 10], CD: [4, 5], DC: [5, 4], DD: [10, 10] } },
  { id: 2, matrix: { CC: [5, 5], CD: [1, 1], DC: [1, 1], DD: [4, 4] } },
  { id: 3, matrix: { CC: [1, 1], CD: [7, 1], DC: [1, 7], DD: [4, 4] } },
  { id: 4, matrix: { CC: [4, 4], CD: [5, 2], DC: [2, 5], DD: [5, 5] } },
  { id: 5, matrix: { CC: [8, 8], CD: [8, 4], DC: [4, 8], DD: [10, 10] } },
  { id: 6, matrix: { CC: [7, 7], CD: [6, 5], DC: [5, 6], DD: [8, 8] } },
  { id: 7, matrix: { CC: [3, 3], CD: [2, 8], DC: [8, 2], DD: [1, 1] } },
]

const paperclipsStrats = STRATEGIES.filter((s) => s.set === 'paperclips')
const ROUNDS = 10
const ITERATIONS = 100

function averageOracle(matrix: PayoffMatrix): Map<string, number> {
  const sums = new Map<string, number>()
  for (let i = 0; i < ITERATIONS; i++) {
    const r = runOracleTournament(matrix)
    for (const row of r.ranking) sums.set(row.name, (sums.get(row.name) ?? 0) + row.score)
  }
  return new Map([...sums].map(([k, v]) => [k, v / ITERATIONS]))
}

function averageEngine(matrix: PayoffMatrix): Map<string, number> {
  const sums = new Map<string, number>()
  for (let i = 0; i < ITERATIONS; i++) {
    const r = runTournament(() => matrix, paperclipsStrats, ROUNDS)
    for (const row of r.ranking) sums.set(row.strategy.name, (sums.get(row.strategy.name) ?? 0) + row.total)
  }
  return new Map([...sums].map(([k, v]) => [k, v / ITERATIONS]))
}

describeOracle('Engine vs in-game oracle (vendored main.js)', () => {
  for (const c of cases) {
    it(`Game ${c.id}: per-strategy mean scores agree within tolerance`, () => {
      const oracle = averageOracle(c.matrix)
      const engine = averageEngine(c.matrix)

      const lines: string[] = []
      lines.push(
        `Game ${c.id} matrix aa=${c.matrix.CC[0]} ab=${c.matrix.CD[0]} ba=${c.matrix.DC[0]} bb=${c.matrix.DD[0]}`,
      )
      lines.push('strategy      | oracle | engine | Δ')
      lines.push('--------------+--------+--------+-----')
      const names = [...oracle.keys()].sort(
        (a, b) => (oracle.get(b) ?? 0) - (oracle.get(a) ?? 0),
      )
      for (const name of names) {
        const o = oracle.get(name) ?? 0
        const e = engine.get(name) ?? 0
        lines.push(
          `${name.padEnd(13)} | ${o.toFixed(1).padStart(6)} | ${e.toFixed(1).padStart(6)} | ${(e - o).toFixed(1).padStart(5)}`,
        )
      }
      // eslint-disable-next-line no-console
      console.log('\n' + lines.join('\n') + '\n')

      // Each strategy's mean should be within ~3% of the oracle. The biggest
      // legitimate gap is from carry-over: my engine + oracle play deterministic
      // strategies identically, but RANDOM seeds differ between runs.
      for (const name of names) {
        const o = oracle.get(name) ?? 0
        const e = engine.get(name) ?? 0
        const tol = Math.max(15, o * 0.05) // either 15 absolute or 5% relative
        expect(Math.abs(e - o), `${name} engine=${e.toFixed(0)} oracle=${o.toFixed(0)}`).toBeLessThanOrEqual(tol)
      }
    })
  }

  it('A100 in Game 5: oracle and engine both score exactly 1280', () => {
    // A100 always plays C in Game 5; matrix has aa=ab=8 so A100 always gets 8.
    // With 8 strategies × 10 rounds × 16 seat-participations = 1280, every run.
    const matrix = cases[4].matrix
    const oracle = runOracleTournament(matrix)
    const engine = runTournament(() => matrix, paperclipsStrats, ROUNDS)
    const oracleA = oracle.ranking.find((r) => r.name === 'A100')!
    const engineA = engine.ranking.find((r) => r.strategy.name === 'A100')!
    expect(oracleA.score).toBe(1280)
    expect(engineA.total).toBe(1280)
  })
})
