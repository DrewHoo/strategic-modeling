import { useMemo, useRef, useState } from 'react'
import { STRATEGIES, C } from './strategies.ts'
import type { PayoffMatrix } from './matrix.ts'
import { STANDARD_PAYOFFS, generatePayoffMatrix, isValidPD } from './matrix.ts'
import type { MatchRound } from './engine.ts'
import { runTournament } from './engine.ts'
import { analyzeField } from './analysis.ts'

const DEFAULT_ROUNDS = 10

export default function App() {
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS)
  const [seed, setSeed] = useState(0)
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null)
  const [watchOpponentIdx, setWatchOpponentIdx] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'rank' | 'list'>('rank')
  const [includeAcademic, setIncludeAcademic] = useState(false)
  const [matrix, setMatrix] = useState<PayoffMatrix>(STANDARD_PAYOFFS)

  const activeStrategies = useMemo(
    () => STRATEGIES.filter((s) => includeAcademic || s.set === 'paperclips'),
    [includeAcademic],
  )

  const tournament = useMemo(
    // Game-style: one matrix per tournament, used for all N² ordered matchups.
    () => runTournament(() => matrix, activeStrategies, rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matrix, activeStrategies, rounds, seed],
  )
  const verdicts = useMemo(
    () => analyzeField(activeStrategies, tournament),
    [activeStrategies, tournament],
  )

  const rows =
    sortBy === 'rank'
      ? [...verdicts].sort((a, b) => a.rank - b.rank)
      : verdicts

  const focused = focusedIdx !== null && focusedIdx < verdicts.length ? verdicts[focusedIdx] : null
  const watchOpponent =
    focused && watchOpponentIdx !== null && watchOpponentIdx !== focusedIdx && watchOpponentIdx < activeStrategies.length
      ? activeStrategies[watchOpponentIdx]
      : null
  const watchedMatch = useMemo(() => {
    if (!focused || watchOpponentIdx === null || watchOpponentIdx === focused.idx) return null
    return tournament.matchups[focused.idx][watchOpponentIdx]
  }, [focused, watchOpponentIdx, tournament])

  function focusStrategy(idx: number) {
    if (focusedIdx === idx) {
      setFocusedIdx(null)
      setWatchOpponentIdx(null)
    } else {
      setFocusedIdx(idx)
      setWatchOpponentIdx(null)
    }
  }

  function toggleAcademic() {
    setIncludeAcademic((v) => !v)
    setFocusedIdx(null)
    setWatchOpponentIdx(null)
  }

  return (
    <main>
      <header className="hero">
        <h1>Strategic Modeling</h1>
        <p className="sub">
          Iterated Prisoner&apos;s Dilemma round-robin. Every strategy plays every other (and
          itself). Skim the field, see what wins, and click a row to drill in.
        </p>
      </header>

      <div className="layout">
        <section className="panel field-panel">
          <div className="panel-head">
            <h2>Field</h2>
            <div className="controls">
              <label>
                Rounds per match
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="10"
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                />
                <span className="value">{rounds}</span>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={includeAcademic}
                  onChange={toggleAcademic}
                />
                <span>Include academic strategies</span>
              </label>
              <div className="seg">
                <button
                  className={sortBy === 'rank' ? 'on' : ''}
                  onClick={() => setSortBy('rank')}
                >
                  Rank
                </button>
                <button
                  className={sortBy === 'list' ? 'on' : ''}
                  onClick={() => setSortBy('list')}
                >
                  Source order
                </button>
              </div>
              <button className="reroll" onClick={() => setSeed((s) => s + 1)}>
                Re-roll
              </button>
            </div>
          </div>

          <div className="strategy-list">
            {rows.map((v) => {
              const isOpen = focusedIdx === v.idx
              return (
                <div key={v.strategy.id} className={`row ${isOpen ? 'open' : ''}`}>
                  <button className="row-summary" onClick={() => focusStrategy(v.idx)}>
                    <span className={`rank ${v.rank === 1 ? 'gold' : v.rank <= 3 ? 'silver' : ''}`}>
                      #{v.rank}
                    </span>
                    <div className="row-main">
                      <div className="row-head">
                        <span className="strat">{v.strategy.name}</span>
                        <span className={`set-pill ${v.strategy.set}`}>
                          {v.strategy.set === 'paperclips' ? 'paperclips' : 'academic'}
                        </span>
                        <span className="tagline">{v.strategy.tagline}</span>
                      </div>
                      <p className="commentary">{v.commentary}</p>
                    </div>
                    <div className="row-stats">
                      <span className="total">{v.total}</span>
                      <span className="avg">{v.avg.toFixed(1)} / match</span>
                    </div>
                    <span className="chev" aria-hidden>{isOpen ? '▾' : '▸'}</span>
                  </button>

                  {isOpen && (
                    <div className="row-body">
                      <p className="desc">{v.strategy.desc}</p>
                      <div className="h2h">
                        <div className="h2h-head">
                          <span>Opponent</span>
                          <span>You</span>
                          <span>Them</span>
                          <span>Δ</span>
                        </div>
                        {activeStrategies.map((opp, j) => {
                          const my = tournament.grid[v.idx][j]
                          const their = tournament.grid[j][v.idx]
                          const diff = my - their
                          const isSelf = j === v.idx
                          const isWatching = watchOpponentIdx === j
                          return (
                            <button
                              key={opp.id}
                              className={`h2h-row ${isWatching ? 'watching' : ''} ${isSelf ? 'self' : ''}`}
                              disabled={isSelf}
                              onClick={() =>
                                setWatchOpponentIdx(isWatching ? null : j)
                              }
                            >
                              <span className="strat">
                                {opp.name}
                                {isSelf ? ' (mirror)' : ''}
                              </span>
                              <span className="score">{my}</span>
                              <span className="score">{their}</span>
                              <span className={`diff ${diff > 0 ? 'pos' : diff < 0 ? 'neg' : ''}`}>
                                {diff > 0 ? '+' : ''}
                                {diff}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      {watchedMatch && watchOpponent && (
                        <div className="match">
                          <div className="match-head">
                            <h3>
                              {v.strategy.name} vs {watchOpponent.name}
                            </h3>
                            <span className="badge muted">
                              Final: {watchedMatch.scoreA} – {watchedMatch.scoreB}
                            </span>
                          </div>
                          <MatchTimeline
                            log={watchedMatch.log}
                            youName={v.strategy.name}
                            oppName={watchOpponent.name}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <aside className="panel payoff-panel">
          <div className="panel-head">
            <h2>Payoff matrix</h2>
            <span className={`badge ${isValidPD(matrix) ? '' : 'warn'}`}>
              {isValidPD(matrix) ? 'Valid PD' : 'Not a PD'}
            </span>
          </div>
          <PayoffEditor matrix={matrix} onChange={setMatrix} />
          <div className="matrix-actions">
            <button className="reroll" onClick={() => setMatrix(generatePayoffMatrix())}>
              Generate new game
            </button>
            <button className="link-btn" onClick={() => setMatrix(STANDARD_PAYOFFS)}>
              Reset to 3/0/5/1
            </button>
          </div>
          <p className="footnote">
            <strong>C</strong> = cooperate, <strong>D</strong> = defect. Each cell shows your
            payoff / their payoff. A valid Prisoner&apos;s Dilemma needs <em>T &gt; R &gt; P &gt; S</em>{' '}
            and <em>2R &gt; T+S</em> — that&apos;s what &ldquo;Generate new game&rdquo; respects.
          </p>
        </aside>
      </div>

      <footer>
        <p>
          A practice harness inspired by the Strategic Modeling minigame in Universal Paperclips.
          Default lineup mirrors the in-game roster; toggle the academic set to add Axelrod-era
          strategies (Pavlov, Grudger, Tit For Two Tats, Generous TFT, Detective).
        </p>
      </footer>
    </main>
  )
}

interface MatchTimelineProps {
  log: MatchRound[]
  youName: string
  oppName: string
}

function MatchTimeline({ log, youName, oppName }: MatchTimelineProps) {
  return (
    <div className="timeline">
      <div className="legend">
        <span className="label you">{youName}</span>
        <span className="label opp">{oppName}</span>
      </div>
      <div className="strip">
        {log.map((row) => (
          <span
            key={row.round}
            className="pair"
            title={`Round ${row.round} — you ${row.moveA} (${row.payoffA}), opp ${row.moveB} (${row.payoffB}). Total ${row.totalA}-${row.totalB}.`}
          >
            <span className={`tick ${row.moveA === C ? 'c' : 'd'}`}>{row.moveA}</span>
            <span className={`tick ${row.moveB === C ? 'c' : 'd'}`}>{row.moveB}</span>
          </span>
        ))}
      </div>
      <div className="cumulative">
        <CumulativeChart log={log} />
      </div>
    </div>
  )
}

function CumulativeChart({ log }: { log: MatchRound[] }) {
  const W = 600
  const H = 100
  const last = log[log.length - 1]
  const maxTotal = Math.max(last.totalA, last.totalB, 1)
  const N = log.length
  const x = (i: number) => (N === 1 ? 0 : (i / (N - 1)) * W)
  const y = (v: number) => H - (v / maxTotal) * H
  const pathA = log
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(r.totalA).toFixed(1)}`)
    .join(' ')
  const pathB = log
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(r.totalB).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="cum-svg">
      <path d={pathA} className="line-you" />
      <path d={pathB} className="line-opp" />
    </svg>
  )
}

type CellKey = 'CC' | 'CD' | 'DC' | 'DD'
const CELL_ORDER: { key: CellKey; cls: string }[] = [
  { key: 'CC', cls: 'good' },
  { key: 'CD', cls: 'bad' },
  { key: 'DC', cls: 'mixed' },
  { key: 'DD', cls: 'meh' },
]

interface PayoffEditorProps {
  matrix: PayoffMatrix
  onChange: (m: PayoffMatrix) => void
}

function PayoffEditor({ matrix, onChange }: PayoffEditorProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function setSlot(slot: number, digit: number) {
    const cellIdx = Math.floor(slot / 2)
    const side = (slot % 2) as 0 | 1
    const key = CELL_ORDER[cellIdx].key
    const pair = [...matrix[key]] as [number, number]
    pair[side] = digit
    onChange({ ...matrix, [key]: pair })
  }

  function focusSlot(slot: number) {
    const el = refs.current[slot]
    if (el) {
      el.focus()
      el.select()
    }
  }

  function renderInput(slot: number) {
    const cellIdx = Math.floor(slot / 2)
    const side = (slot % 2) as 0 | 1
    const key = CELL_ORDER[cellIdx].key
    const val = matrix[key][side]
    return (
      <input
        ref={(el) => {
          refs.current[slot] = el
        }}
        className="payoff-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{1,2}"
        maxLength={2}
        aria-label={`${key} ${side === 0 ? 'row' : 'col'} payoff`}
        value={String(val)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '')
          if (raw === '') {
            setSlot(slot, 0)
            return
          }
          const last = raw[raw.length - 1]
          const prev = raw.length >= 2 ? raw[raw.length - 2] : ''
          let next: number
          let advance: boolean
          if (prev === '1' && last === '0') {
            next = 10
            advance = true
          } else if (last === '1') {
            // could become 10 if next keystroke is 0 — wait
            next = 1
            advance = false
          } else {
            next = Number(last)
            advance = true
          }
          setSlot(slot, next)
          if (advance && slot < 7) {
            requestAnimationFrame(() => focusSlot(slot + 1))
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Backspace') {
            const cur = e.currentTarget.value
            if (cur === '' || cur === '0') {
              if (slot > 0) {
                e.preventDefault()
                focusSlot(slot - 1)
              }
            } else if (cur === '10') {
              setSlot(slot, 1)
              e.preventDefault()
            } else {
              setSlot(slot, 0)
              e.preventDefault()
            }
          } else if (e.key === 'ArrowLeft' && slot > 0) {
            e.preventDefault()
            focusSlot(slot - 1)
          } else if (e.key === 'ArrowRight' && slot < 7) {
            e.preventDefault()
            focusSlot(slot + 1)
          }
        }}
      />
    )
  }

  return (
    <table className="payoff editable">
      <thead>
        <tr>
          <th></th>
          <th>They C</th>
          <th>They D</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>You C</th>
          <td>
            <span className={`cell ${CELL_ORDER[0].cls}`}>
              {renderInput(0)} <span className="slash">/</span> {renderInput(1)}
            </span>
          </td>
          <td>
            <span className={`cell ${CELL_ORDER[1].cls}`}>
              {renderInput(2)} <span className="slash">/</span> {renderInput(3)}
            </span>
          </td>
        </tr>
        <tr>
          <th>You D</th>
          <td>
            <span className={`cell ${CELL_ORDER[2].cls}`}>
              {renderInput(4)} <span className="slash">/</span> {renderInput(5)}
            </span>
          </td>
          <td>
            <span className={`cell ${CELL_ORDER[3].cls}`}>
              {renderInput(6)} <span className="slash">/</span> {renderInput(7)}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
