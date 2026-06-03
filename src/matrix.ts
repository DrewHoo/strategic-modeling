export type Move = 'C' | 'D'
export const C: Move = 'C'
export const D: Move = 'D'

export interface PayoffMatrix {
  CC: [number, number]
  CD: [number, number]
  DC: [number, number]
  DD: [number, number]
}

export const STANDARD_PAYOFFS: PayoffMatrix = {
  CC: [3, 3],
  CD: [0, 5],
  DC: [5, 0],
  DD: [1, 1],
}

export function payoff(matrix: PayoffMatrix, me: Move, them: Move): [number, number] {
  if (me === C && them === C) return matrix.CC
  if (me === C && them === D) return matrix.CD
  if (me === D && them === C) return matrix.DC
  return matrix.DD
}

// Index (0-3) of the cell with the largest row-player payoff.
// Order maps to CC, CD, DC, DD. Ties resolve to the first index in that order.
export type CellIdx = 0 | 1 | 2 | 3
export function biggestForRow(m: PayoffMatrix): CellIdx {
  const v = [m.CC[0], m.CD[0], m.DC[0], m.DD[0]]
  let best: CellIdx = 0
  for (let i = 1; i < 4; i++) {
    if (v[i] > v[best]) best = i as CellIdx
  }
  return best
}

// Helpers for naming what a cell index "means" structurally.
// rowOfCell:  CC,CD → C  | DC,DD → D
// colOfCell:  CC,DC → C  | CD,DD → D
export function rowOfCell(idx: CellIdx): Move {
  return idx < 2 ? C : D
}
export function colOfCell(idx: CellIdx): Move {
  return idx % 2 === 0 ? C : D
}

function rollCell(): number {
  return 1 + Math.floor(Math.random() * 10) // 1..10
}

// Game-style matrix: four independent uniform-integer draws in [1, 10] for the
// four "row-player perspective" cells, mirrored into our [row, col] storage so
// the off-diagonals swap (cooperator gets the sucker, defector gets the
// temptation, regardless of which side of the table they're on).
// No PD constraints are enforced — the in-game generator doesn't either.
export function generatePayoffMatrix(): PayoffMatrix {
  const aa = rollCell()
  const ab = rollCell() // sucker (row player cooperates, opp defects)
  const ba = rollCell() // temptation (row player defects, opp cooperates)
  const bb = rollCell()
  return {
    CC: [aa, aa],
    CD: [ab, ba],
    DC: [ba, ab],
    DD: [bb, bb],
  }
}

interface PlayerValues {
  S: number
  P: number
  R: number
  T: number
}

// Is this a valid PD for both players? T > R > P > S and 2R > T + S.
export function isValidPD(m: PayoffMatrix): boolean {
  const a: PlayerValues = { R: m.CC[0], S: m.CD[0], T: m.DC[0], P: m.DD[0] }
  const b: PlayerValues = { R: m.CC[1], S: m.DC[1], T: m.CD[1], P: m.DD[1] }
  const ok = (v: PlayerValues) => v.T > v.R && v.R > v.P && v.P > v.S && 2 * v.R > v.T + v.S
  return ok(a) && ok(b)
}
