import type { Move, PayoffMatrix } from './matrix.ts'
import { C, D, biggestForRow, colOfCell, rowOfCell } from './matrix.ts'

export type { Move } from './matrix.ts'
export { C, D } from './matrix.ts'

export type PlayFn = (mine: Move[], theirs: Move[], matrix: PayoffMatrix) => Move

export type StrategySet = 'paperclips' | 'academic'

export interface Strategy {
  id: string
  name: string
  tagline: string
  desc: string
  set: StrategySet
  play: PlayFn
}

export const STRATEGIES: Strategy[] = [
  // ── Paperclips lineup (ordered to match the game's strats[] array) ─
  {
    id: 'random',
    name: 'RANDOM',
    set: 'paperclips',
    tagline: 'Coin flip each round.',
    desc: 'Uniform 50/50 between C and D every round. No memory, no matrix awareness.',
    play: () => (Math.random() < 0.5 ? C : D),
  },
  {
    id: 'a100',
    name: 'A100',
    set: 'paperclips',
    tagline: 'Always plays A (cooperate).',
    desc: 'Pure ALL-C. Returns C every round regardless of opponent or payoff matrix.',
    play: () => C,
  },
  {
    id: 'b100',
    name: 'B100',
    set: 'paperclips',
    tagline: 'Always plays B (defect).',
    desc: 'Pure ALL-D. Returns D every round regardless of opponent or payoff matrix.',
    play: () => D,
  },
  {
    id: 'greedy',
    name: 'GREEDY',
    set: 'paperclips',
    tagline: 'Play the row of the biggest cell.',
    desc: 'Finds the cell with the largest row-player payoff in the current matrix and plays its row. In a standard PD the biggest cell is DC (you defect, opp cooperates) so GREEDY defects; in other matrices it can cooperate.',
    play: (_mine, _theirs, m) => rowOfCell(biggestForRow(m)),
  },
  {
    id: 'generous',
    name: 'GENEROUS',
    set: 'paperclips',
    tagline: "Play opponent's move in the biggest cell.",
    desc: "Finds the cell with the largest row-player payoff and plays the opponent's move from that cell. In a standard PD the biggest cell is DC so the opponent is cooperating there — GENEROUS cooperates, declining the temptation to defect.",
    play: (_mine, _theirs, m) => colOfCell(biggestForRow(m)),
  },
  {
    id: 'minimax',
    name: 'MINIMAX',
    set: 'paperclips',
    tagline: "Play opposite of opponent's move in the biggest cell.",
    desc: "Finds the cell with the largest row-player payoff and plays the opposite of the opponent's move in it. Mirror of GENEROUS: in a standard PD the biggest cell has opp cooperating, so MINIMAX defects.",
    play: (_mine, _theirs, m) => (colOfCell(biggestForRow(m)) === C ? D : C),
  },
  {
    id: 'tit_for_tat',
    name: 'TIT FOR TAT',
    set: 'paperclips',
    tagline: 'Cooperate first, then mirror.',
    desc: "Opens with C, then copies the opponent's previous move. The classic nice, retaliatory, forgiving, clear strategy from Axelrod's tournament.",
    play: (_mine, theirs) => (theirs.length === 0 ? C : theirs[theirs.length - 1]),
  },
  {
    id: 'beat_last',
    name: 'BEAT LAST',
    set: 'paperclips',
    tagline: "Best response to opponent's last move.",
    desc: "Assumes the opponent will repeat their previous move (C on round 1) and plays whichever row pays more against it. In a standard PD that's always D, but in other matrices it can flip.",
    play: (_mine, theirs, m) => {
      const oppLast = theirs.length === 0 ? C : theirs[theirs.length - 1]
      if (oppLast === C) {
        // pick the column-C row that pays more: CC (row C) vs DC (row D)
        return m.CC[0] > m.DC[0] ? C : D
      }
      // pick the column-D row that pays more: CD (row C) vs DD (row D)
      return m.CD[0] > m.DD[0] ? C : D
    },
  },

  // ── Academic extras ─────────────────────────────────────────────────
  {
    id: 'tit_for_two_tats',
    name: 'TIT FOR TWO TATS',
    set: 'academic',
    tagline: 'Forgive a single defection.',
    desc: 'Defects only after the opponent has defected twice in a row. Survives noisy opponents but a savvy defector can exploit every other round.',
    play: (_mine, theirs) => {
      if (theirs.length < 2) return C
      return theirs[theirs.length - 1] === D && theirs[theirs.length - 2] === D ? D : C
    },
  },
  {
    id: 'grudger',
    name: 'GRUDGER',
    set: 'academic',
    tagline: "One strike and they're out.",
    desc: 'Cooperates until the opponent defects once, then defects forever. Strong deterrent against probing — but a single accident locks both sides into (D,D).',
    play: (_mine, theirs) => (theirs.includes(D) ? D : C),
  },
  {
    id: 'pavlov',
    name: 'PAVLOV',
    set: 'academic',
    tagline: 'Win-stay, lose-shift.',
    desc: "Repeats the last move if the opponent cooperated, flips if the opponent defected. Catches naive defectors and recovers from accidental mutual defection.",
    play: (mine, theirs) => {
      if (mine.length === 0) return C
      const lastMine = mine[mine.length - 1]
      const lastTheirs = theirs[theirs.length - 1]
      if (lastTheirs === C) return lastMine
      return lastMine === C ? D : C
    },
  },
  {
    id: 'generous_tft',
    name: 'GENEROUS TFT',
    set: 'academic',
    tagline: 'TFT with a 10% forgiveness chance.',
    desc: 'Like Tit For Tat, but after an opponent defection it forgives 10% of the time. Breaks out of revenge spirals against noisy or oscillating opponents.',
    play: (_mine, theirs) => {
      if (theirs.length === 0) return C
      if (theirs[theirs.length - 1] === C) return C
      return Math.random() < 0.1 ? C : D
    },
  },
  {
    id: 'detective',
    name: 'DETECTIVE',
    set: 'academic',
    tagline: 'Probes C,D,C,C; then exploits or retaliates.',
    desc: 'Opens with a fixed C,D,C,C probe. If the opponent never defected during the probe, switches to ALL-D and exploits a pushover. If they did, plays Tit For Tat thereafter.',
    play: (mine, theirs) => {
      const probe: Move[] = [C, D, C, C]
      const i = mine.length
      if (i < 4) return probe[i]
      const opponentDefectedDuringProbe = theirs.slice(0, 4).includes(D)
      if (opponentDefectedDuringProbe) return theirs[theirs.length - 1]
      return D
    },
  },
]

export function strategyById(id: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.id === id)
}
