import { playerFactors } from './simulator.js'
import { playerArchetypes } from './generatedMatchups.js'

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

// Maps a raw metric onto the 1-4 scale; pass worst > best for metrics where lower is better.
const band = (value, worst, best) => clamp(1 + 3 * (value - worst) / (best - worst), 1, 4)

const strikeRate = player => player.stats?.batBalls ? player.stats.batRuns / player.stats.batBalls * 100 : 0
const battingAverage = player => player.stats?.outs ? player.stats.batRuns / player.stats.outs : player.stats?.batRuns ?? 0
const oversPerMatch = player => player.stats?.matches ? player.stats.bowlBalls / 6 / player.stats.matches : 0
const phaseBalls = (player, phase) => player.stats?.phases?.[phase] ?? 0
const phaseEconomy = (player, phase) => phaseBalls(player, phase) ? player.stats.phaseRuns[phase] / phaseBalls(player, phase) * 6 : null
const phaseBallsPerWicket = (player, phase) => player.stats?.phaseWickets?.[phase] ? phaseBalls(player, phase) / player.stats.phaseWickets[phase] : null
const bowlingStyle = player => playerArchetypes[player.statsId]?.bowl
const isSpinner = player => ['OB', 'LB', 'SLA', 'LWS'].includes(bowlingStyle(player))
const isPacer = player => ['RF', 'LF'].includes(bowlingStyle(player))

function battingMetricsAt(player, index) {
  const careerBalls = player.stats?.batBalls ?? 0
  const careerRuns = player.stats?.batRuns ?? 0
  const careerOuts = player.stats?.outs ?? 0
  const key = index < 2 ? 'open' : String(index + 1)
  const position = player.stats?.byPosition?.[key]
  if (!position?.balls || !careerBalls) return { strikeRate: strikeRate(player), average: battingAverage(player), confidence: 0 }

  const priorBalls = 120
  const careerRunsPerBall = careerRuns / careerBalls
  const careerOutsPerBall = careerOuts / careerBalls
  const smoothedRuns = position.runs + careerRunsPerBall * priorBalls
  const smoothedBalls = position.balls + priorBalls
  const smoothedOuts = position.outs + careerOutsPerBall * priorBalls

  return {
    strikeRate: smoothedRuns / smoothedBalls * 100,
    average: smoothedOuts ? smoothedRuns / smoothedOuts : smoothedRuns,
    confidence: position.balls / smoothedBalls,
  }
}

const positionNumber = key => key === 'open' ? 1.5 : Number(key)

export function positionFitProfile(player, index) {
  const selectedKey = index < 2 ? 'open' : String(index + 1)
  const positions = Object.entries(player.stats?.byPosition ?? {})
  const selected = player.stats?.byPosition?.[selectedKey]
  const evidence = selected?.balls ? selected.balls / (selected.balls + 120) : 0
  const supported = positions.filter(([, stats]) => stats.balls >= 100)

  if (!supported.length) {
    const expectedSlot = index < 2 ? 'O' : index < 7 ? 'M' : 'L'
    const archetypeMatch = playerArchetypes[player.statsId]?.arch?.endsWith(expectedSlot)
    const penalty = archetypeMatch ? 0 : 0.12
    return { evidence, distance: archetypeMatch ? 0 : 1, versatility: 0, penalty, multiplier: 1 - penalty }
  }

  const selectedPosition = index < 2 ? 1.5 : index + 1
  const nearestDistance = Math.min(...supported.map(([key]) => Math.abs(positionNumber(key) - selectedPosition)))
  const distance = clamp(nearestDistance / 2, 0, 1)
  const quality = supported.map(([, stats]) => stats.balls ? stats.runs / stats.balls * 100 : 0)
  const qualityMean = mean(quality)
  const qualityVariance = mean(quality.map(value => (value - qualityMean) ** 2))
  const stability = qualityMean ? Math.exp(-2 * Math.sqrt(qualityVariance) / qualityMean) : 0
  const coverage = clamp(supported.length / 5, 0, 1)
  const versatility = coverage * stability
  const transferableVersatility = versatility * (1 - 0.75 * distance)
  const penalty = 0.2 * (1 - evidence) * (1 - 0.7 * transferableVersatility) * distance

  return { evidence, distance, versatility, transferableVersatility, penalty, multiplier: 1 - penalty }
}

function battingSegment(squad, from, to, [srWorst, srBest], [avgWorst, avgBest], srWeight, slotWeights) {
  const group = squad.slice(from, to)
  if (!group.length) return 1
  const scores = group.map((player, groupIndex) => {
    const index = from + groupIndex
    const metrics = battingMetricsAt(player, index)
    const fit = positionFitProfile(player, index).multiplier
    const srScore = band(metrics.strikeRate, srWorst, srBest)
    const averageScore = band(metrics.average, avgWorst, avgBest)
    const phaseSrWeight = typeof srWeight === 'function' ? srWeight(index) : srWeight
    const quality = srScore ** phaseSrWeight * averageScore ** (1 - phaseSrWeight)
    return clamp(quality * fit, 1, 4)
  })
  if (!slotWeights) return mean(scores)

  const weights = slotWeights.slice(0, scores.length)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  return scores.reduce((sum, score, index) => sum + score * weights[index], 0) / totalWeight
}

function phaseAttack(squad, phase, oversNeeded, [econWorst, econBest], [strikeWorst, strikeBest]) {
  const ranked = squad
    .map(player => {
      const total = phaseBalls(player, 0) + phaseBalls(player, 1) + phaseBalls(player, 2)
      return { player, expected: total ? oversPerMatch(player) * (phaseBalls(player, phase) / total) : 0 }
    })
    .filter(entry => entry.expected > 0.05 && phaseBalls(entry.player, phase) >= 30)
    .sort((left, right) => right.expected - left.expected)

  if (!ranked.length) return 1

  let remaining = oversNeeded
  const used = []
  for (const entry of ranked) {
    if (remaining <= 0) break
    const take = Math.min(Math.max(entry.expected * 2, 0.8), remaining, 4)
    used.push({ ...entry, take })
    remaining -= take
  }

  const load = used.reduce((sum, entry) => sum + entry.take, 0) || 1
  const economy = used.reduce((sum, entry) => sum + (phaseEconomy(entry.player, phase) ?? 9) * entry.take, 0) / load
  const strike = used.reduce((sum, entry) => sum + (phaseBallsPerWicket(entry.player, phase) ?? 30) * entry.take, 0) / load
  // An attack short of bodies for this phase cannot score full marks.
  const coverage = clamp(1 - remaining / oversNeeded * 0.5, 0.6, 1)
  return clamp((0.6 * band(economy, econWorst, econBest) + 0.4 * band(strike, strikeWorst, strikeBest)) * coverage, 1, 4)
}

function battingDepth(squad) {
  const hasCredibleBatter = squad.slice(7, 11).some(player => (
    (player.stats?.batBalls ?? 0) >= 100
    && battingAverage(player) >= 12
    && strikeRate(player) >= 110
  ))
  return hasCredibleBatter ? 4 : 0
}

function bowlingVariety(squad) {
  const properBowlers = squad.filter(player => player.role === 'Bowler' && oversPerMatch(player) >= 1.5).length
  const allRounderBowlers = squad.filter(player => player.role === 'All-rounder' && oversPerMatch(player) >= 0.75).length
  const styles = new Set(squad
    .filter(player => oversPerMatch(player) >= 0.75)
    .map(bowlingStyle)
    .filter(Boolean)).size

  return clamp(
    0.6 * band(properBowlers, 2, 5)
    + 0.25 * band(allRounderBowlers, 0, 2)
    + 0.15 * band(styles, 1, 4),
    1,
    4,
  )
}

function teamBalance(squad) {
  const allRounders = squad.filter(player => (player.stats?.bowlBalls ?? 0) >= 200 && (player.stats?.batBalls ?? 0) >= 400).length
  const hands = squad.slice(0, 7).map(player => playerArchetypes[player.statsId]?.bat).filter(Boolean)
  const minorityHand = hands.length ? Math.min(hands.filter(hand => hand === 'L').length, hands.length - hands.filter(hand => hand === 'L').length) : 0
  const spinners = squad.filter(player => isSpinner(player) && oversPerMatch(player) >= 1).length
  const pacers = squad.filter(player => isPacer(player) && oversPerMatch(player) >= 1).length
  const keepers = squad.filter(player => player.role === 'Wicketkeeper').length

  return clamp(mean([
    band(allRounders, 0, 3),
    band(minorityHand, 0, 3),
    band(Math.min(spinners, 3), 0, 2.5),
    band(Math.min(pacers, 4), 1, 3.5),
    band(Math.min(keepers, 1), 0, 1),
  ]), 1, 4)
}

const fieldingQuality = squad => band(mean(squad.map(player => player.fielding ?? 3)), 2.5, 4.2)

function matchupEdge(batting, bowling) {
  const bowlers = bowling
    .filter(player => oversPerMatch(player) >= 1)
    .sort((left, right) => oversPerMatch(right) - oversPerMatch(left))
    .slice(0, 6)
  if (!bowlers.length) return 1

  const factors = []
  for (const batter of batting.slice(0, 7)) {
    for (const bowler of bowlers) factors.push(playerFactors(batter, bowler).scoring)
  }
  return mean(factors)
}

const PARAMETERS = [
  { label: 'Top-order batting (1-3)', weight: 0.13, detail: 'Positions 1-3; position-specific stats with nonlinear 50/50 strike-rate and average balance', score: own => battingSegment(own, 0, 3, [105, 155], [18, 40], 0.5) },
  { label: 'Middle-order batting (3-6)', weight: 0.12, detail: 'Positions 3-6; position-specific stats favouring average (60%) over strike rate (40%)', score: own => battingSegment(own, 2, 6, [100, 150], [15, 38], 0.4) },
  { label: 'Finishing (5-8)', weight: 0.13, detail: 'Positions 5-8; 80/20 strike-rate/average blend, weighted by finishing responsibility (20/33/32/15)', score: own => battingSegment(own, 4, 8, [100, 170], [10, 32], 0.8, [0.20, 0.33, 0.32, 0.15]) },
  { label: 'Batting depth (8-11)', weight: 0.02, detail: '100 if any player at 8-11 has 100+ career balls, average 12+, and strike rate 110+', score: own => battingDepth(own) },
  { label: 'Powerplay bowling', weight: 0.12, detail: 'Real overs 1-6 economy and balls per wicket', score: own => phaseAttack(own, 0, 6, [9.2, 6.6], [42, 20]) },
  { label: 'Middle-overs bowling', weight: 0.11, detail: 'Real overs 7-15 economy and balls per wicket', score: own => phaseAttack(own, 1, 9, [9.6, 6.9], [36, 18]) },
  { label: 'Death bowling', weight: 0.12, detail: 'Real overs 16-20 economy and balls per wicket', score: own => phaseAttack(own, 2, 5, [12.6, 8.6], [26, 12]) },
  { label: 'Bowling variety', weight: 0.05, detail: 'Proper-bowler depth (60%), all-rounder bowling cover (25%), and distinct styles (15%)', score: own => bowlingVariety(own) },
  { label: 'Fielding', weight: 0.05, detail: 'Curated fielding ratings across the XI', score: own => fieldingQuality(own) },
  { label: 'Head-to-head matchup edge', weight: 0.07, detail: 'Cricsheet IPL batter-bowler records with archetype fallback', score: (own, opponent) => clamp(0.5 * band(matchupEdge(own, opponent), 0.85, 1.2) + 0.5 * band(matchupEdge(opponent, own), 1.2, 0.85), 1, 4) },
  { label: 'Team balance & combination', weight: 0.08, detail: 'All-rounders, pace-spin mix, left-right balance, keeper', score: own => teamBalance(own) },
]

// Parameters are modelled on a 1-4 band, then presented on a 0-100 scale.
const toHundred = value => value / 4 * 100

// Whole numbers unless the gap is sub-1, where two decimals are needed to separate them.
export const formatScore = value => Math.abs(value) < 1 && value !== 0 ? value.toFixed(2) : String(Math.round(value))

export function compareTeams(teamA, teamB) {
  const rows = PARAMETERS.map(parameter => ({
    label: parameter.label,
    detail: parameter.detail,
    weight: parameter.weight,
    a: toHundred(parameter.score(teamA.squad, teamB.squad)),
    b: toHundred(parameter.score(teamB.squad, teamA.squad)),
  }))

  const totals = ['a', 'b'].map(side => rows.reduce((sum, row) => sum + row[side] * row.weight, 0))
  const gap = totals[0] - totals[1]
  const winner = Math.abs(gap) < 0.005 ? null : gap > 0 ? teamA.name : teamB.name
  const edgesFor = side => rows
    .filter(row => (side === 'a' ? row.a - row.b : row.b - row.a) >= 8)
    .sort((left, right) => (side === 'a' ? right.a - right.b : right.b - right.a) - (side === 'a' ? left.a - left.b : left.b - left.a))
    .map(row => row.label)

  return {
    teams: [teamA.name, teamB.name],
    rows,
    totals,
    winner,
    verdict: winner ? `${winner} by ${formatScore(Math.abs(gap))}` : 'Dead heat',
    edges: [edgesFor('a'), edgesFor('b')],
  }
}