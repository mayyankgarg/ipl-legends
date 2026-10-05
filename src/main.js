import './style.css'
import { recordComparison } from './analytics.js'
import { availableFranchises, availablePlayers, franchises, players } from './data.js'

const STORAGE_KEY = 'ipl-legends-xi-v1'
const roleLabels = { Batter: 'BAT', Wicketkeeper: 'WK', 'All-rounder': 'AR', Bowler: 'BOWL', Player: 'IPL' }
const summaryRoles = ['Batter', 'Wicketkeeper', 'All-rounder', 'Bowler', 'Player']
const defaultState = () => ({
  squads: [[], []],
  turn: 0,
  result: null,
  rotation: 0,
  mode: 'play',
  matchSetup: { keepers: ['', ''], conditions: { pitch: 'balanced', weather: 'clear', dew: 'none', dimensions: 'standard' } },
  match: null,
  comparison: null,
})

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.squads?.length === 2) {
      const defaults = defaultState()
      // Regenerated player data must win over the persisted snapshot, which can predate new stat fields.
      const squads = saved.squads.map(squad => squad.map(savedPlayer => ({ ...savedPlayer, ...players.find(player => player.id === savedPlayer.id) })))
      return {
        ...defaults,
        ...saved,
        squads,
        result: null,
        match: null,
        comparison: null,
        matchSetup: {
          ...defaults.matchSetup,
          ...saved.matchSetup,
          conditions: { ...defaults.matchSetup.conditions, ...saved.matchSetup?.conditions },
        },
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
  return defaultState()
}

let state = loadState()
let spinning = false
let autoPicking = false
let query = ''
let comparisonToken = 0

// Model output is untrusted text, so it is escaped before ever reaching innerHTML.
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))

const app = document.querySelector('#app')
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="IPL Legends XI home"><span class="brand-mark">XI</span><span>IPL LEGENDS XI</span></a>
    <div class="draft-progress" aria-label="Team progress"><span id="progress-label">0 / 22 PICKS</span><span class="progress-track"><span id="progress-fill"></span></span></div>
    <button class="quiet-button" id="reset-button" type="button">NEW GAME</button>
  </header>
  <main>
    <section class="scoreboard" aria-label="Team selection">
      <article class="squad squad-a" id="squad-0"></article>
      <section class="arena" aria-label="IPL team wheel">
        <div class="turn-banner" id="turn-banner"></div>
        <div class="wheel-stage"><div class="pointer" aria-hidden="true"></div><div class="wheel" id="wheel"></div><div class="wheel-hub" aria-hidden="true"><span>IPL</span></div></div>
        <button class="spin-button" id="spin-button" type="button">SPIN THE WHEEL</button>
        <button class="random-button" id="random-button" type="button">RANDOM 11 v 11</button>
        <p class="spin-note" id="spin-note">Spin a franchise, then choose one of its legends.</p>
      </section>
      <article class="squad squad-b" id="squad-1"></article>
    </section>
    <section class="picker" id="picker" hidden>
      <div class="picker-heading"><div><p class="eyebrow" id="picker-eyebrow"></p><h2 id="picker-title"></h2></div><label class="search-field"><span aria-hidden="true">⌕</span><input id="player-search" type="search" placeholder="Search players" autocomplete="off" /></label></div>
      <div class="player-groups" id="player-grid"></div>
    </section>
    <section class="draft-complete" id="draft-complete" hidden></section>
  </main>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`

const wheel = document.querySelector('#wheel')
const spinButton = document.querySelector('#spin-button')
const randomButton = document.querySelector('#random-button')
const spinNote = document.querySelector('#spin-note')
const picker = document.querySelector('#picker')
const playerGrid = document.querySelector('#player-grid')
const searchInput = document.querySelector('#player-search')

const getDraftedIds = () => new Set(state.squads.flat().map(({ id }) => id))
const isComplete = () => state.squads.every(squad => squad.length === 11)
const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

function renderWheel() {
  const segment = 360 / franchises.length
  wheel.style.background = `conic-gradient(from -18deg, ${franchises.map((team, index) => `${team.color} ${index * segment}deg ${(index + 1) * segment}deg`).join(', ')})`
  wheel.style.transform = `rotate(${state.rotation}deg)`
  // Labels are offset by -90deg so they sit at the sector centre rather than on the dividing line.
  wheel.innerHTML = franchises.map((team, index) => `<span class="wheel-label" style="--angle:${index * segment - 90}deg;--ink:${team.ink}"><b>${team.id}</b><small>${team.short}</small></span>`).join('')
}

function renderSquad(teamIndex) {
  const squad = state.squads[teamIndex]
  const slots = Array.from({ length: 11 }, (_, index) => squad[index])
  document.querySelector(`#squad-${teamIndex}`).innerHTML = `
    <div class="squad-heading"><span class="team-kicker">TEAM ${teamIndex === 0 ? 'A' : 'B'}</span><span class="pick-count">${squad.length}/11 · OS ${overseasCount(squad)}/${MAX_OVERSEAS}</span></div>
    <div class="squad-title"><h2>${teamIndex === 0 ? 'THE CHALLENGERS' : 'THE TITANS'}</h2><span>DRAG TO REORDER</span></div>
    <div class="role-summary">${summaryRoles.map(role => `<span>${roleLabels[role]} <b>${squad.filter(player => player.role === role).length}</b></span>`).join('')}</div>
    <ol class="roster ${state.turn === teamIndex && !isComplete() ? 'is-current' : ''}" data-team-index="${teamIndex}">${slots.map((player, index) => player ? `
      <li class="roster-player" draggable="true" data-index="${index}" data-player-id="${player.id}">
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <select class="position-select" data-team-index="${teamIndex}" data-player-id="${player.id}" aria-label="Batting position for ${player.name}">${squad.map((_, position) => `<option value="${position}" ${position === index ? 'selected' : ''}>${position + 1}</option>`).join('')}</select>
        <span class="player-info"><b>${player.name}</b><small>${[player.role, player.country].filter(Boolean).join(' · ')}</small></span>
        ${isOverseas(player) ? '<span class="overseas-flag" title="Overseas player">OS</span>' : ''}
        <span class="source-badge">${player.pickedFor}</span>
      </li>` : `
      <li class="empty-slot"><span>${String(index + 1).padStart(2, '0')}</span><i>Awaiting pick</i></li>`).join('')}</ol>`
}

const MAX_OVERSEAS = 4
const isOverseas = player => player.country && player.country !== 'India'
const overseasCount = squad => squad.filter(isOverseas).length

function renderPicker() {
  if (!state.result || isComplete()) { picker.hidden = true; return }
  const franchise = franchises.find(({ id }) => id === state.result)
  const squad = state.squads[state.turn]
  const overseasFull = overseasCount(squad) >= MAX_OVERSEAS
  const eligible = availablePlayers(franchise.id, getDraftedIds())
    .filter(player => player.name.toLowerCase().includes(query.toLowerCase()))
    .filter(player => !overseasFull || !isOverseas(player))

  picker.hidden = false
  document.querySelector('#picker-eyebrow').textContent = `TEAM ${state.turn === 0 ? 'A' : 'B'} · PICK ${squad.length + 1} · OVERSEAS ${overseasCount(squad)}/${MAX_OVERSEAS}`
  document.querySelector('#picker-title').textContent = `Choose a ${franchise.name} player`

  const card = player => `
    <button class="player-card${isOverseas(player) ? ' is-overseas' : ''}" type="button" data-player-id="${player.id}">
      <span class="role-chip">${roleLabels[player.role]}</span>
      <span class="player-card-copy"><b>${player.name}</b><small>${[player.country, player.role].filter(Boolean).join(' · ')}</small></span>
      ${isOverseas(player) ? '<span class="overseas-flag" title="Overseas player">OS</span>' : ''}
      <span class="draft-arrow" aria-hidden="true">→</span>
    </button>`

  const group = (label, list) => list.length
    ? `<section class="player-group">
         <div class="group-heading"><span>${label}</span><i>${list.length}</i></div>
         <div class="player-grid">${list.map(card).join('')}</div>
       </section>`
    : ''

  playerGrid.innerHTML = eligible.length
    ? `${overseasFull ? `<p class="overseas-note">Overseas quota full (${MAX_OVERSEAS}/${MAX_OVERSEAS}) - only Indian players are selectable.</p>` : ''}
       ${group('Marquee players', eligible.filter(player => player.marquee))}
       ${group('Other players', eligible.filter(player => !player.marquee))}`
    : '<p class="no-results">No matching available players.</p>'
}

function renderComplete() {
  const section = document.querySelector('#draft-complete')
  section.hidden = !isComplete()
  if (!isComplete()) return
  const summary = squad => summaryRoles.map(role => `${roleLabels[role]} ${squad.filter(player => player.role === role).length}`).join(' · ')
  const option = (value, label, selected) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`
  const keeperSelect = teamIndex => `<select data-keeper="${teamIndex}" aria-label="Wicketkeeper for Team ${teamIndex === 0 ? 'A' : 'B'}"><option value="">Choose wicketkeeper</option>${state.squads[teamIndex].map(player => option(player.id, `${player.name}${player.role === 'Wicketkeeper' ? ' (WK)' : ''}`, state.matchSetup.keepers[teamIndex])).join('')}</select>`

  section.innerHTML = `
    <p class="eyebrow">TEAMS COMPLETE</p>
    <h2>Two legendary XIs. One impossible match.</h2>
    <div class="comparison"><strong>THE CHALLENGERS</strong><span>${summary(state.squads[0])}</span><b>VS</b><span>${summary(state.squads[1])}</span><strong>THE TITANS</strong></div>
    <div class="mode-tabs" role="tablist">
      <button type="button" role="tab" data-mode="play" class="${state.mode === 'play' ? 'is-active' : ''}" aria-selected="${state.mode === 'play'}">PLAY T20</button>
      <button type="button" role="tab" data-mode="compare" class="${state.mode === 'compare' ? 'is-active' : ''}" aria-selected="${state.mode === 'compare'}">COMPARE TEAMS</button>
    </div>
    ${state.mode === 'compare' ? renderCompare() : state.match ? renderMatch(state.match) : `
      <div class="match-setup">
        <div class="setup-heading"><span>01</span><div><h3>Fix the wicketkeepers</h3><p>Nominate exactly one player behind the stumps for each XI.</p></div></div>
        <div class="keeper-grid"><label><span>The Challengers</span>${keeperSelect(0)}</label><label><span>The Titans</span>${keeperSelect(1)}</label></div>
        <div class="setup-heading"><span>02</span><div><h3>Set match conditions</h3><p>Conditions adjust scoring, wickets, boundaries, and the chase.</p></div></div>
        <div class="conditions-grid">
          <label><span>Pitch</span><select data-condition="pitch">${option('balanced', 'Balanced', state.matchSetup.conditions.pitch)}${option('batting', 'Flat batting deck', state.matchSetup.conditions.pitch)}${option('green', 'Green seamer', state.matchSetup.conditions.pitch)}${option('dry', 'Dry and turning', state.matchSetup.conditions.pitch)}</select></label>
          <label><span>Weather</span><select data-condition="weather">${option('clear', 'Clear', state.matchSetup.conditions.weather)}${option('overcast', 'Overcast', state.matchSetup.conditions.weather)}${option('humid', 'Humid', state.matchSetup.conditions.weather)}</select></label>
          <label><span>Dew factor</span><select data-condition="dew">${option('none', 'None', state.matchSetup.conditions.dew)}${option('light', 'Light', state.matchSetup.conditions.dew)}${option('heavy', 'Heavy', state.matchSetup.conditions.dew)}</select></label>
          <label><span>Boundaries</span><select data-condition="dimensions">${option('small', 'Small', state.matchSetup.conditions.dimensions)}${option('standard', 'Standard', state.matchSetup.conditions.dimensions)}${option('large', 'Large', state.matchSetup.conditions.dimensions)}</select></label>
        </div>
        <p class="data-note">Simulation uses IPL ball-by-ball history and 30,459 real batter-bowler matchups from Cricsheet. ESPN Cricinfo does not provide a supported public stats API.</p>
        <button class="play-match-button" type="button" ${state.matchSetup.keepers.every(Boolean) ? '' : 'disabled'}>PLAY T20</button>
      </div>`}
  `
}

const analysisContent = result => Object.hasOwn(result ?? {}, 'text')
  ? result.text ? escapeHtml(result.text) : ''
  : result?.error
    ? `<span class="analysis-error">Analysis unavailable - ${escapeHtml(result.error)}</span>`
    : '<span class="analysis-skeleton"></span><span class="analysis-skeleton is-short"></span>'

function renderCompare() {
  if (!state.comparison) return '<div class="compare-panel"><p class="compare-loading">Crunching matchups…</p></div>'

  const comparison = state.comparison
  const tied = Math.round(comparison.totals[0]) === Math.round(comparison.totals[1])
  const show = (value, forceDecimals) => forceDecimals ? value.toFixed(2) : String(Math.round(value))
  const edge = row => {
    const gap = row.a - row.b
    if (Math.abs(gap) < 0.005) return '<span class="edge-even">level</span>'
    const text = Math.abs(gap) < 1 ? Math.abs(gap).toFixed(2) : String(Math.round(Math.abs(gap)))
    return `<span class="${gap > 0 ? 'edge-a' : 'edge-b'}">${gap > 0 ? 'CHA' : 'TIT'} +${text}</span>`
  }

  return `
    <div class="compare-panel">
      <div class="compare-verdict">
        <div class="verdict-side"><span>THE CHALLENGERS</span><strong>${show(comparison.totals[0], tied)}</strong></div>
        <div class="verdict-middle"><b>${comparison.verdict}</b><small>weighted score out of 100</small></div>
        <div class="verdict-side"><span>THE TITANS</span><strong>${show(comparison.totals[1], tied)}</strong></div>
      </div>
      <table class="compare-table">
        <thead><tr><th>Parameter</th><th>Wt</th><th>CHA</th><th>TIT</th><th>Edge</th></tr></thead>
        <tbody>
          ${comparison.rows.map((row, index) => `
            <tr class="score-row">
              <td class="param-cell"><b>${row.label}</b><small>${row.detail}</small></td>
              <td class="weight-cell">${Math.round(row.weight * 100)}%</td>
              <td class="score-cell" data-team="CHA "><span class="score-bar"><i style="width:${row.a}%"></i></span>${Math.round(row.a)}</td>
              <td class="score-cell" data-team="TIT "><span class="score-bar is-b"><i style="width:${row.b}%"></i></span>${Math.round(row.b)}</td>
              <td class="edge-cell">${edge(row)}</td>
            </tr>
            <tr class="analysis-row"><td colspan="5" data-analysis="${index}">${analysisContent(comparison.analyses?.[index])}</td></tr>`).join('')}
        </tbody>
      </table>
          <p class="analysis-note">Per-parameter analysis by NVIDIA Nemotron 3 Nano.</p>
      <div class="edge-summary">
        <div><span>Challengers lead</span><p>${comparison.edges[0].join(' · ') || 'No decisive edge'}</p></div>
        <div><span>Titans lead</span><p>${comparison.edges[1].join(' · ') || 'No decisive edge'}</p></div>
      </div>
    </div>`
}

function conditionSummary(conditions) {
  return Object.values(conditions).map(value => value.replace(/^./, letter => letter.toUpperCase())).join(' · ')
}

function matchMarkdown(match) {
  const overs = card => `${Math.floor(card.legalBalls / 6)}.${card.legalBalls % 6}`
  const lines = [`# ${match.result}`, '', match.toss, '', `**Conditions:** ${conditionSummary(match.conditions)}`, '']

  match.innings.forEach((innings, index) => {
    lines.push(`## ${index === 0 ? '1st Innings' : 'Chase'} - ${innings.team} ${innings.runs}/${innings.wickets} (${innings.overs} ov)`, '')
    lines.push('| Batter | Dismissal | R | B |', '| --- | --- | ---: | ---: |')
    for (const card of innings.batting) lines.push(`| ${card.player.name} | ${card.dismissal} | ${card.runs} | ${card.balls} |`)
    lines.push('', '| Bowler | O | R | W |', '| --- | ---: | ---: | ---: |')
    for (const card of innings.bowling) lines.push(`| ${card.player.name} | ${overs(card)} | ${card.runs} | ${card.wickets} |`)
    lines.push('')
  })

  match.superOvers.forEach(([first, second], index) => {
    lines.push(`## Super Over ${index + 1}`, '', `- ${first.team} ${first.runs}/${first.wickets}`, `- ${second.team} ${second.runs}/${second.wickets}`, '')
  })

  return lines.join('\n')
}

function renderMatch(match) {
  const conditions = conditionSummary(match.conditions)
  const inningsCard = (innings, index) => `
    <article class="innings-card">
      <div class="innings-score"><span>${index === 0 ? '1ST INNINGS' : 'CHASE'}</span><h3>${innings.team}</h3><strong>${innings.runs}/${innings.wickets}</strong><small>${innings.overs} overs</small></div>
      <div class="scorecard-columns">
        <div><h4>Batting</h4><table><tbody>${innings.batting.map(card => `<tr><td><b>${card.player.name}</b><small>${card.dismissal}</small></td><td>${card.runs}</td><td>${card.balls}b</td></tr>`).join('')}</tbody></table></div>
        <div><h4>Bowling</h4><table><tbody>${innings.bowling.map(card => `<tr><td><b>${card.player.name}</b></td><td>${Math.floor(card.legalBalls / 6)}.${card.legalBalls % 6}</td><td>${card.runs}/${card.wickets}</td></tr>`).join('')}</tbody></table></div>
      </div>
      <details><summary>Ball-by-ball</summary><ol class="commentary">${innings.events.map(event => `<li>${event}</li>`).join('')}</ol></details>
    </article>`
  return `
    <section class="match-result">
      <div class="result-banner"><span>FULL TIME</span><h3>${match.result}</h3><p>${match.toss}</p><small>${conditions}</small></div>
      <div class="innings-grid">${match.innings.map(inningsCard).join('')}</div>
      ${match.superOvers.length ? `<div class="super-over-note">Decided by ${match.superOvers.length} Super Over${match.superOvers.length === 1 ? '' : 's'}</div>` : ''}
      <div class="result-actions">
        <button class="replay-button" type="button">SIMULATE AGAIN</button>
        <button class="copy-button" type="button">COPY TO CLIPBOARD (MD)</button>
      </div>
    </section>`
}

function render() {
  const picks = state.squads[0].length + state.squads[1].length
  document.querySelector('#progress-label').textContent = `${picks} / 22 PICKS`
  document.querySelector('#progress-fill').style.width = `${(picks / 22) * 100}%`
  document.querySelector('#turn-banner').innerHTML = isComplete() ? '<span>TEAMS COMPLETE</span><strong>FINAL XIs LOCKED</strong>' : `<span>BUILDING XIs</span><strong>TEAM ${state.turn === 0 ? 'A' : 'B'} · PICK ${state.squads[state.turn].length + 1}</strong>`
  spinButton.disabled = spinning || autoPicking || Boolean(state.result) || isComplete()
  randomButton.disabled = spinning || autoPicking
  spinButton.textContent = spinning ? 'SPINNING…' : state.result ? `${state.result} SELECTED` : isComplete() ? 'TEAMS COMPLETE' : 'SPIN THE WHEEL'
  randomButton.textContent = autoPicking ? 'BUILDING RANDOM XIs…' : 'RANDOM 11 v 11'
  spinNote.textContent = autoPicking ? 'The wheel is picking two complete XIs.' : state.result ? 'Select one eligible player below to pass the turn.' : 'Spin a franchise, then choose one of its legends.'
  renderSquad(0); renderSquad(1); renderPicker(); renderComplete()
}

function spin() {
  if (spinning || state.result || isComplete()) return
  const teams = availableFranchises(getDraftedIds())
  const winner = teams[Math.floor(Math.random() * teams.length)]
  const segment = 360 / franchises.length
  const winnerIndex = franchises.findIndex(({ id }) => id === winner.id)
  const current = ((state.rotation % 360) + 360) % 360
  // Pointer sits at 3 o'clock, so the winning sector centre must finish at 90deg.
  const target = ((90 - winnerIndex * segment) % 360 + 360) % 360
  state.rotation += 1800 + (target - current + 360) % 360
  spinning = true
  render()
  wheel.style.transform = `rotate(${state.rotation}deg)`
  window.setTimeout(() => { spinning = false; state.result = winner.id; saveState(); render(); picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, 4200)
}

function shuffle(items) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled
}

function makeRandomXI(draftedIds) {
  const squad = []
  const addPlayer = candidates => {
    const eligible = shuffle(candidates.filter(player => !draftedIds.has(player.id) && (!isOverseas(player) || overseasCount(squad) < MAX_OVERSEAS)))
    const selected = eligible[0]
    if (!selected) return false
    squad.push({ ...selected, pickedFor: selected.teams[Math.floor(Math.random() * selected.teams.length)] })
    draftedIds.add(selected.id)
    return true
  }

  // Every generated XI remains usable in the match simulator and comparison view.
  const requiredRoles = [['Wicketkeeper', 1], ['Bowler', 3], ['All-rounder', 1]]
  requiredRoles.forEach(([role, count]) => {
    for (let index = 0; index < count; index += 1) addPlayer(players.filter(player => player.role === role))
  })
  while (squad.length < 11) {
    if (!addPlayer(players)) throw new Error('Not enough eligible players to build a random XI.')
  }
  return shuffle(squad)
}

function fillRandomTeams() {
  const draftedIds = new Set()
  const squads = [makeRandomXI(draftedIds), makeRandomXI(draftedIds)]
  const keepers = squads.map(squad => squad.find(player => player.role === 'Wicketkeeper')?.id ?? '')
  state = {
    ...defaultState(),
    rotation: state.rotation,
    squads,
    turn: 0,
    matchSetup: { ...defaultState().matchSetup, keepers },
  }
}

function randomizeTeams() {
  if (spinning || autoPicking) return
  if (state.squads.flat().length && !window.confirm('Replace the current draft with two random XIs?')) return

  const winnerIndex = Math.floor(Math.random() * franchises.length)
  const segment = 360 / franchises.length
  const current = ((state.rotation % 360) + 360) % 360
  const target = ((90 - winnerIndex * segment) % 360 + 360) % 360
  state.rotation += 1080 + (target - current + 360) % 360
  autoPicking = true
  render()
  wheel.style.transform = `rotate(${state.rotation}deg)`
  window.setTimeout(() => {
    fillRandomTeams()
    autoPicking = false
    saveState()
    render()
    showToast('Two random XIs are ready')
    document.querySelector('.draft-complete').scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 1600)
}

function showToast(message) {
  const toast = document.querySelector('#toast')
  toast.textContent = message
  toast.classList.add('is-visible')
  window.setTimeout(() => toast.classList.remove('is-visible'), 2200)
}

function draftPlayer(playerId) {
  if (!state.result) return
  const selected = players.find(({ id }) => id === playerId)
  if (!selected || getDraftedIds().has(playerId) || !selected.teams.includes(state.result)) return
  if (isOverseas(selected) && overseasCount(state.squads[state.turn]) >= MAX_OVERSEAS) {
    showToast(`Overseas limit reached - ${MAX_OVERSEAS} maximum`)
    return
  }
  const previousTeam = state.turn
  state.squads[state.turn].push({ ...selected, pickedFor: state.result })
  state.result = null
  state.turn = state.turn === 0 ? 1 : 0
  query = ''
  searchInput.value = ''
  saveState()
  showToast(`${selected.name} joins Team ${previousTeam === 0 ? 'A' : 'B'}`)
  render()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function movePlayer(teamIndex, playerId, targetIndex) {
  const squad = state.squads[teamIndex]
  const currentIndex = squad.findIndex(player => player.id === playerId)
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= squad.length || currentIndex === targetIndex) return
  const [player] = squad.splice(currentIndex, 1)
  squad.splice(targetIndex, 0, player)
  state.match = null
  state.comparison = null
  saveState()
  render()
}

async function runComparison() {
  const token = ++comparisonToken
  const { compareTeams } = await import('./compare.js')
  const squads = [state.squads[0], state.squads[1]]
  recordComparison(squads.map(squad => squad.map(player => player.id)))
  const comparison = compareTeams(
    { name: 'The Challengers', squad: squads[0] },
    { name: 'The Titans', squad: squads[1] },
  )
  if (token !== comparisonToken) return

  comparison.analyses = comparison.rows.map(() => null)
  state.comparison = comparison
  saveState()
  renderComplete()
  startAnalyses(token, comparison, squads)
}

function applyAnalysis(token, index, result) {
  if (token !== comparisonToken || !state.comparison?.analyses) return
  state.comparison.analyses[index] = result
  saveState()
  const cell = document.querySelector(`[data-analysis="${index}"]`)
  if (cell) cell.innerHTML = analysisContent(result)
}

function startAnalyses(token, comparison, squads) {
  import('./explain.js').then(({ analysisBatches, explainParameterBatch }) => {
    // Each row gets an independent request, so malformed model JSON cannot block
    // any other visible parameter. Start every request in parallel.
    const parameters = analysisBatches(comparison.rows.length)
    const runBatch = indexes =>
      explainParameterBatch(comparison, squads, indexes)
        .then(analyses => indexes.forEach(index => applyAnalysis(token, index, { text: analyses.get(index) })))
        .catch(error => indexes.forEach(index => applyAnalysis(token, index, { error: error.message })))

    Promise.all(parameters.map(runBatch))
  }).catch(() => {
    comparison.rows.forEach((row, index) => applyAnalysis(token, index, { error: 'analysis module failed to load' }))
  })
}

async function playMatch() {
  if (!state.matchSetup.keepers.every(Boolean)) return
  const { simulateMatch } = await import('./simulator.js')
  state.match = simulateMatch({
    teams: [
      { name: 'The Challengers', squad: state.squads[0] },
      { name: 'The Titans', squad: state.squads[1] },
    ],
    conditions: state.matchSetup.conditions,
    keepers: state.matchSetup.keepers,
  })
  saveState()
  renderComplete()
  document.querySelector('.match-result').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

spinButton.addEventListener('click', spin)
randomButton.addEventListener('click', randomizeTeams)
playerGrid.addEventListener('click', event => { const button = event.target.closest('[data-player-id]'); if (button) draftPlayer(button.dataset.playerId) })
document.querySelector('.scoreboard').addEventListener('change', event => {
  const select = event.target.closest('.position-select')
  if (select) movePlayer(Number(select.dataset.teamIndex), select.dataset.playerId, Number(select.value))
})

let dragSource = null

document.querySelector('.scoreboard').addEventListener('dragstart', event => {
  const item = event.target.closest('.roster-player')
  if (!item) return
  dragSource = { teamIndex: Number(item.closest('.roster').dataset.teamIndex), playerId: item.dataset.playerId }
  item.classList.add('is-dragging')
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', item.dataset.playerId)
})

document.querySelector('.scoreboard').addEventListener('dragover', event => {
  const item = event.target.closest('.roster-player')
  if (!item || !dragSource) return
  if (Number(item.closest('.roster').dataset.teamIndex) !== dragSource.teamIndex) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  document.querySelectorAll('.roster-player.is-drop-target').forEach(node => node.classList.remove('is-drop-target'))
  item.classList.add('is-drop-target')
})

document.querySelector('.scoreboard').addEventListener('drop', event => {
  const item = event.target.closest('.roster-player')
  if (!item || !dragSource) return
  const teamIndex = Number(item.closest('.roster').dataset.teamIndex)
  if (teamIndex !== dragSource.teamIndex) return
  event.preventDefault()
  movePlayer(teamIndex, dragSource.playerId, Number(item.dataset.index))
  dragSource = null
})

document.querySelector('.scoreboard').addEventListener('dragend', () => {
  dragSource = null
  document.querySelectorAll('.is-dragging, .is-drop-target').forEach(node => node.classList.remove('is-dragging', 'is-drop-target'))
})
document.querySelector('#draft-complete').addEventListener('change', event => {
  if (event.target.matches('[data-keeper]')) state.matchSetup.keepers[Number(event.target.dataset.keeper)] = event.target.value
  if (event.target.matches('[data-condition]')) state.matchSetup.conditions[event.target.dataset.condition] = event.target.value
  saveState()
  renderComplete()
})
document.querySelector('#draft-complete').addEventListener('click', event => {
  const tab = event.target.closest('[data-mode]')
  if (tab) {
    state.mode = tab.dataset.mode
    saveState()
    renderComplete()
    if (state.mode === 'compare' && !state.comparison) runComparison()
    return
  }
  if (event.target.closest('.play-match-button')) playMatch()
  if (event.target.closest('.replay-button')) { state.match = null; saveState(); renderComplete() }
  if (event.target.closest('.copy-button') && state.match) {
    navigator.clipboard.writeText(matchMarkdown(state.match))
      .then(() => showToast('Scorecard copied as Markdown'))
      .catch(() => showToast('Could not access the clipboard'))
  }
})
searchInput.addEventListener('input', event => { query = event.target.value; renderPicker() })
document.querySelector('#reset-button').addEventListener('click', () => {
  if (state.squads.flat().length && !window.confirm('Start a new game? Both squads will be cleared.')) return
  state = defaultState()
  query = ''
  saveState()
  renderWheel()
  render()
})

renderWheel()
render()
