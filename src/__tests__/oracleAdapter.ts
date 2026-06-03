// Loads the in-game tournament code (a vendored copy of Universal Paperclips'
// main.js, trimmed to the tournament-relevant slice) in a sandboxed VM context
// with the DOM stubbed out and setTimeout drained synchronously. Exposes one
// function — runOracleTournament — that runs an N×N tournament on a fixed
// payoff matrix and returns the strategies' final scores.
//
// This adapter is the only place that interacts with the vendored source. The
// rest of our code is independent.

import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { PayoffMatrix } from '../matrix.ts'

const here = dirname(fileURLToPath(import.meta.url))
const MAIN_JS_PATH = resolve(here, '../original sourcecode/main.js')

interface OracleStrat {
  name: string
  currentScore: number
}

interface OracleSandbox {
  strats: OracleStrat[]
  allStrats: OracleStrat[]
  aa: number
  ab: number
  ba: number
  bb: number
  hMove: number
  vMove: number
  hMovePrev: number
  vMovePrev: number
  payoffGrid: { valueAA: number; valueAB: number; valueBA: number; valueBB: number }
  newTourney: () => void
  runTourney: () => void
  generateGrid: () => void
}

interface OracleContext {
  sandbox: OracleSandbox
  pending: Array<() => void>
  context: ReturnType<typeof createContext>
}

let cached: OracleContext | null = null

function buildMockElement(): unknown {
  // Every property access returns the element itself, so chained accesses
  // like `el.style.backgroundColor = "x"` work without throwing. Assignments
  // are no-ops.
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'innerHTML') return ''
      if (prop === 'value') return '10' // matches stratPickerElement default
      if (prop === 'disabled') return false
      if (prop === Symbol.toPrimitive) return () => ''
      if (prop === 'length') return 0
      if (prop === Symbol.iterator) return undefined
      if (prop === 'then') return undefined
      return mock
    },
    set: () => true,
    apply: () => mock,
    construct: () => mock as object,
  }
  const mock: object = new Proxy(function () {} as object, handler)
  return mock
}

function extractElementVarNames(src: string): string[] {
  // Pull `var XxxElement;` and `var xxxElements = [];` patterns out of main.js.
  const names = new Set<string>()
  for (const m of src.matchAll(/^var\s+(\w+Element)\s*[;=]/gm)) names.add(m[1])
  for (const m of src.matchAll(/^var\s+(\w+Elements)\s*=/gm)) names.add(m[1])
  return [...names]
}

function loadOracle(): OracleContext {
  if (cached) return cached

  const src = readFileSync(MAIN_JS_PATH, 'utf8')
  const mockElement = buildMockElement()
  const pending: Array<() => void> = []

  const sandbox: Record<string, unknown> = {
    // DOM
    document: {
      getElementById: () => mockElement,
      createElement: () => mockElement,
      body: mockElement,
    },
    // Timers — push instead of fire so we can drain in a controlled loop.
    setTimeout: (cb: () => void) => {
      pending.push(cb)
      return 0
    },
    setInterval: () => 0,
    clearTimeout: () => {},
    clearInterval: () => {},
    Math,
    JSON,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Date,
    console,
    // Game-state globals main.js reads but doesn't itself define within the
    // trimmed slice. Sensible benign defaults so the startup DOM/flow code
    // doesn't throw.
    autoTourneyFlag: 0,
    autoTourneyStatus: 0,
    qFade: 1,
    operations: 1e12,
    standardOps: 1e12,
  }
  sandbox.window = sandbox
  sandbox.global = sandbox
  sandbox.globalThis = sandbox

  // Pre-bind every `var XxxElement` declaration in main.js to a mock. The
  // bare `var X;` declarations don't reset an existing binding, so our stubs
  // survive script evaluation; the few that get reassigned (Elements arrays)
  // become real arrays which is fine.
  for (const name of extractElementVarNames(src)) {
    sandbox[name] = mockElement
  }

  const context = createContext(sandbox)
  runInContext(src, context, { filename: MAIN_JS_PATH })

  // Push all 8 strategies into the `strats` array. In the live game these are
  // added one at a time as the player buys them; in the trimmed source only
  // RANDOM is auto-pushed.
  runInContext(
    `
    var allWantedStrats = [stratRandom, stratA100, stratB100, stratGreedy, stratGenerous, stratMinimax, stratTitfortat, stratBeatlast];
    for (var i = 0; i < allWantedStrats.length; i++) {
      if (!strats.includes(allWantedStrats[i])) strats.push(allWantedStrats[i]);
    }
  `,
    context,
  )

  cached = { sandbox: sandbox as unknown as OracleSandbox, pending, context }
  return cached
}

export interface OracleResult {
  ranking: Array<{ name: string; score: number }>
}

export function runOracleTournament(matrix: PayoffMatrix): OracleResult {
  const oracle = loadOracle()
  const { sandbox, pending, context } = oracle

  // Drain any leftover queued callbacks from previous runs.
  pending.length = 0

  // Reset the carry-over state to the game's fresh-process defaults so each
  // tournament starts from a clean slate. (In the live game these globals
  // persist across tournaments; for a clean per-call oracle we reset.)
  runInContext('hMove = 1; vMove = 1; hMovePrev = 1; vMovePrev = 1;', context)

  // Init scores, set rounds=N², zero counters, etc.
  sandbox.newTourney()

  // Override the random matrix that newTourney → generateGrid sampled.
  sandbox.aa = matrix.CC[0]
  sandbox.ab = matrix.CD[0]
  sandbox.ba = matrix.DC[0]
  sandbox.bb = matrix.DD[0]
  sandbox.payoffGrid.valueAA = matrix.CC[0]
  sandbox.payoffGrid.valueAB = matrix.CD[0]
  sandbox.payoffGrid.valueBA = matrix.DC[0]
  sandbox.payoffGrid.valueBB = matrix.DD[0]

  // Kick off the tournament. runTourney schedules itself through setTimeout
  // for visual pacing; our stub captures those into `pending`.
  sandbox.runTourney()
  while (pending.length > 0) {
    const cb = pending.shift()!
    cb()
  }

  const ranking = sandbox.strats
    .map((s) => ({ name: s.name, score: s.currentScore }))
    .sort((a, b) => b.score - a.score)
  return { ranking }
}
