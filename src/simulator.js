import { batterVsBowlType, bowlerVsBatType, headToHead, playerArchetypes } from './generatedMatchups.js'

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
const pick = (items, random) => items[Math.floor(random() * items.length)]
const overLabel = legalBalls => `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
const deliveryLabel = legalBalls => `${Math.floor(legalBalls / 6)}.${legalBalls % 6 + 1}`

// Baseline ball outcomes are calibrated so a scoring factor of 1.0 yields league-average strike rate.
const LEAGUE_STRIKE_RATE = 130
const LEAGUE_WICKET_RATE = 0.04
const OUTCOME_RUNS = [0, 1, 2, 3, 4, 6]
const OUTCOME_WEIGHTS = [0.415, 0.33, 0.075, 0.005, 0.125, 0.05]

export function createSeededRandom(seed = 1) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function conditionFactors(conditions, inningsNumber) {
  const pitch = {
    balanced: { scoring: 1, wicket: 1 },
    batting: { scoring: 1.14, wicket: 0.84 },
    green: { scoring: 0.9, wicket: 1.24 },
    dry: { scoring: 0.95, wicket: 1.12 },
  }[conditions.pitch]
  const weather = {
    clear: { scoring: 1.02, wicket: 0.97 },
    overcast: { scoring: 0.93, wicket: 1.16 },
    humid: { scoring: 0.96, wicket: 1.09 },
  }[conditions.weather]
  const dimensions = { small: 1.25, standard: 1, large: 0.78 }[conditions.dimensions]
  const dew = inningsNumber === 2 ? { none: 1, light: 1.05, heavy: 1.12 }[conditions.dew] : 1
  return { scoring: pitch.scoring * weather.scoring * dew, wicket: pitch.wicket * weather.wicket / dew, boundary: dimensions }
}

// Absent a direct matchup, fall back to how this batter fares against the bowler's style and vice versa.
function matchupPrior(batter, bowler, careerStrikeRate, bowlerStrikeRateConceded) {
  const bowlerStyle = playerArchetypes[bowler.statsId]
  const batterStyle = playerArchetypes[batter.statsId]
  const vsBowlType = bowlerStyle?.bowl ? batterVsBowlType[batter.statsId]?.[bowlerStyle.bowl] : null
  const vsBatType = batterStyle?.arch ? bowlerVsBatType[bowler.statsId]?.[batterStyle.arch] : null

  const batterSide = vsBowlType?.[0] > 0 ? vsBowlType[1] / vsBowlType[0] * 100 : careerStrikeRate
  const bowlerSide = vsBatType?.[0] > 0 ? vsBatType[1] / vsBatType[0] * 100 : bowlerStrikeRateConceded
  const wicketSamples = [vsBowlType, vsBatType].filter(entry => entry?.[0] > 0)
  const weight = ([balls]) => Math.min(balls, 240)
  const wicketRate = wicketSamples.length
    ? wicketSamples.reduce((sum, entry) => sum + entry[2] / entry[0] * weight(entry), 0) / wicketSamples.reduce((sum, entry) => sum + weight(entry), 0)
    : LEAGUE_WICKET_RATE

  return {
    // log5: combine both marginals against the league baseline instead of averaging them.
    strikeRate: clamp(batterSide * bowlerSide / LEAGUE_STRIKE_RATE, 70, 210),
    wicketRate: clamp(wicketRate, 0.015, 0.09),
    style: bowlerStyle?.bowl ?? batterStyle?.arch ?? null,
  }
}

export function playerFactors(batter, bowler) {
  const batting = batter.stats ?? {}
  const bowling = bowler.stats ?? {}
  const careerStrikeRate = (batting.batRuns + 39) / (batting.batBalls + 30) * 100
  const bowlerStrikeRateConceded = (bowling.bowlRuns + 48) / (bowling.bowlBalls + 36) * 100
  const careerWicketRate = (bowling.wickets + 1.8) / (bowling.bowlBalls + 45)
  const matchupTuple = headToHead.get(`${batter.statsId}:${bowler.statsId}`)
  const matchup = matchupTuple ? { balls: matchupTuple[0], runs: matchupTuple[1], wickets: matchupTuple[2] } : null
  const prior = matchupPrior(batter, bowler, careerStrikeRate, bowlerStrikeRateConceded)
  const matchupBalls = matchup?.balls ?? 0
  // Prior loses influence as direct evidence accumulates.
  const priorBalls = 8 + 10 * Math.exp(-matchupBalls / 30)
  const matchupStrikeRate = ((matchup?.runs ?? 0) + prior.strikeRate / 100 * priorBalls) / (matchupBalls + priorBalls) * 100
  const matchupWicketRate = ((matchup?.wickets ?? 0) + prior.wicketRate * priorBalls) / (matchupBalls + priorBalls)
  const targetStrikeRate = careerStrikeRate * 0.15 + bowlerStrikeRateConceded * 0.1 + matchupStrikeRate * 0.75

  return {
    scoring: clamp(targetStrikeRate / LEAGUE_STRIKE_RATE, 0.6, 1.5),
    wicket: clamp((careerWicketRate / LEAGUE_WICKET_RATE) * 0.35 + (matchupWicketRate / LEAGUE_WICKET_RATE) * 0.45 + (LEAGUE_STRIKE_RATE / careerStrikeRate) * 0.2, 0.6, 1.65),
    matchup,
    prior,
  }
}

// Share of a 20-over innings spent in powerplay / middle / death.
const PHASE_SHARE = [0.3, 0.45, 0.25]
const phaseOf = over => over < 6 ? 0 : over < 15 ? 1 : 2

function bowlerRating(player, phase) {
  const stats = player.stats ?? {}
  const phases = stats.phases ?? [0, 0, 0]
  const phaseBalls = phases[0] + phases[1] + phases[2]
  const bowlBalls = stats.bowlBalls ?? 0
  const oversPerMatch = stats.matches ? bowlBalls / 6 / stats.matches : bowlBalls >= 600 ? 2.6 : bowlBalls >= 60 ? 1 : 0.1
  const share = phaseBalls >= 60 ? phases[phase] / phaseBalls : PHASE_SHARE[phase]
  return {
    frontline: clamp(oversPerMatch / 3.2, 0.02, 1),
    phaseFit: phaseBalls >= 60 ? clamp(share / PHASE_SHARE[phase], 0.1, 2.2) : 0.6,
    share,
  }
}

function chooseBowler(squad, bowling, lastBowlerId, over, maxOvers, striker, random) {
  const phase = phaseOf(over)
  const hasQuota = player => (bowling[player.id]?.legalBalls ?? 0) < maxOvers * 6
  const rested = squad.filter(player => hasQuota(player) && player.id !== lastBowlerId)
  const pool = rested.length ? rested : squad.filter(hasQuota)
  const scored = pool.map(player => {
    const { frontline, phaseFit, share } = bowlerRating(player, phase)
    const suppression = striker ? playerFactors(striker, player).scoring : 1
    const bowled = bowling[player.id]?.phaseOvers[phase] ?? 0
    // Hold a bowler's remaining overs back for the phases they normally bowl.
    const pacing = clamp(1 - bowled / Math.max(maxOvers * share, 0.6), 0.12, 1)
    return { player, weight: Math.max(frontline ** 2 * phaseFit * pacing * clamp(1.3 - suppression * 0.6, 0.3, 1.2), 1e-4) }
  })

  const total = scored.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = random() * total
  for (const entry of scored) {
    if ((roll -= entry.weight) <= 0) return entry.player
  }
  return scored.at(-1).player
}

function simulateInnings({ battingTeam, bowlingTeam, inningsNumber, conditions, target, random, maxBalls = 120, maxWickets = 10, maxBowlerOvers = 4 }) {
  const batting = Object.fromEntries(battingTeam.squad.map(player => [player.id, { player, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: 'not out' }]))
  const bowling = Object.fromEntries(bowlingTeam.squad.map(player => [player.id, { player, legalBalls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0, phaseOvers: [0, 0, 0] }]))
  let strikerIndex = 0
  let nonStrikerIndex = 1
  let nextBatterIndex = 2
  let legalBalls = 0
  let runs = 0
  let wickets = 0
  let currentBowler = null
  let lastBowlerId = null
  let freeHit = false
  const events = []

  while (legalBalls < maxBalls && wickets < maxWickets && (!target || runs < target)) {
    if (legalBalls % 6 === 0) {
      currentBowler = chooseBowler(bowlingTeam.squad, bowling, lastBowlerId, Math.floor(legalBalls / 6), maxBowlerOvers, battingTeam.squad[strikerIndex], random)
      lastBowlerId = currentBowler.id
      bowling[currentBowler.id].phaseOvers[phaseOf(Math.floor(legalBalls / 6))] += 1
    }

    const striker = battingTeam.squad[strikerIndex]
    const batterCard = batting[striker.id]
    const bowlerCard = bowling[currentBowler.id]
    const factors = playerFactors(striker, currentBowler)
    const condition = conditionFactors(conditions, inningsNumber)
    const ballMark = deliveryLabel(legalBalls)
    const roll = random()

    if (roll < 0.025) {
      runs += 1
      bowlerCard.runs += 1
      bowlerCard.wides += 1
      events.push(`${ballMark} ${currentBowler.name} to ${striker.name}: wide`)
      continue
    }

    if (roll < 0.037) {
      const batRuns = pick([0, 0, 1, 2, 4, 6], random)
      const total = batRuns + 1
      runs += total
      batterCard.runs += batRuns
      bowlerCard.runs += total
      bowlerCard.noBalls += 1
      if (batRuns === 4) batterCard.fours += 1
      if (batRuns === 6) batterCard.sixes += 1
      if (batRuns % 2) [strikerIndex, nonStrikerIndex] = [nonStrikerIndex, strikerIndex]
      freeHit = true
      events.push(`${ballMark} ${currentBowler.name} to ${striker.name}: no-ball, ${total} run${total === 1 ? '' : 's'}`)
      continue
    }

    const wicketChance = 0.043 * factors.wicket * condition.wicket
    const isWicket = !freeHit && random() < wicketChance
    legalBalls += 1
    batterCard.balls += 1
    bowlerCard.legalBalls += 1

    if (isWicket) {
      const dismissal = pick(['bowled', 'caught', 'lbw', 'caught', 'stumped'], random)
      wickets += 1
      bowlerCard.wickets += 1
      batterCard.out = true
      batterCard.dismissal = `${dismissal} b ${currentBowler.name}`
      events.push(`${ballMark} ${currentBowler.name} to ${striker.name}: WICKET, ${dismissal}`)
      if (wickets < maxWickets && nextBatterIndex < battingTeam.squad.length) strikerIndex = nextBatterIndex++
    } else {
      const scoring = factors.scoring * condition.scoring
      const boundary = condition.boundary * scoring
      const weights = OUTCOME_WEIGHTS.map((base, index) => index === 0 ? base / scoring : index >= 4 ? base * boundary : base)
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
      let outcomeRoll = random() * totalWeight
      let outcomeIndex = 0
      while ((outcomeRoll -= weights[outcomeIndex]) > 0 && outcomeIndex < weights.length - 1) outcomeIndex += 1
      const batRuns = OUTCOME_RUNS[outcomeIndex]
      runs += batRuns
      batterCard.runs += batRuns
      bowlerCard.runs += batRuns
      if (batRuns === 4) batterCard.fours += 1
      if (batRuns === 6) batterCard.sixes += 1
      if (batRuns % 2) [strikerIndex, nonStrikerIndex] = [nonStrikerIndex, strikerIndex]
      events.push(`${ballMark} ${currentBowler.name} to ${striker.name}: ${batRuns === 0 ? 'dot ball' : `${batRuns} run${batRuns === 1 ? '' : 's'}`}${factors.matchup?.balls >= 6 ? ' · H2H' : factors.prior.style ? ` · vs ${factors.prior.style}` : ''}`)
    }

    freeHit = false
    if (legalBalls % 6 === 0 && wickets < maxWickets) [strikerIndex, nonStrikerIndex] = [nonStrikerIndex, strikerIndex]
  }

  return {
    team: battingTeam.name,
    runs,
    wickets,
    legalBalls,
    overs: overLabel(legalBalls),
    batting: Object.values(batting).filter(card => card.balls || card.out).sort((a, b) => battingTeam.squad.indexOf(a.player) - battingTeam.squad.indexOf(b.player)),
    bowling: Object.values(bowling).filter(card => card.legalBalls || card.wides || card.noBalls).sort((a, b) => b.legalBalls - a.legalBalls),
    events,
  }
}

export function simulateMatch({ teams, conditions, keepers, random = Math.random }) {
  if (teams.some(team => team.squad.length !== 11)) throw new Error('Both teams must have exactly 11 players.')
  if (keepers.some((keeperId, index) => !teams[index].squad.some(player => player.id === keeperId))) throw new Error('Each team must designate one wicketkeeper.')

  const tossWinner = random() < 0.5 ? 0 : 1
  const fieldsFirst = conditions.dew === 'heavy' ? random() < 0.82 : conditions.dew === 'light' ? random() < 0.68 : random() < 0.52
  const battingFirst = fieldsFirst ? 1 - tossWinner : tossWinner
  const order = [teams[battingFirst], teams[1 - battingFirst]]
  const first = simulateInnings({ battingTeam: order[0], bowlingTeam: order[1], inningsNumber: 1, conditions, random })
  const second = simulateInnings({ battingTeam: order[1], bowlingTeam: order[0], inningsNumber: 2, conditions, target: first.runs + 1, random })
  const superOvers = []

  while (first.runs === second.runs) {
    const firstSuper = simulateInnings({ battingTeam: order[0], bowlingTeam: order[1], inningsNumber: 1, conditions, random, maxBalls: 6, maxWickets: 2, maxBowlerOvers: 1 })
    const secondSuper = simulateInnings({ battingTeam: order[1], bowlingTeam: order[0], inningsNumber: 2, conditions, target: firstSuper.runs + 1, random, maxBalls: 6, maxWickets: 2, maxBowlerOvers: 1 })
    superOvers.push([firstSuper, secondSuper])
    if (firstSuper.runs !== secondSuper.runs) break
  }

  const decidingScores = superOvers.at(-1) ?? [first, second]
  const winner = decidingScores[1].runs > decidingScores[0].runs ? order[1] : order[0]
  const result = superOvers.length
    ? `${winner.name} won after ${superOvers.length} Super Over${superOvers.length === 1 ? '' : 's'}`
    : second.runs > first.runs
      ? `${winner.name} won by ${10 - second.wickets} wickets`
      : `${winner.name} won by ${first.runs - second.runs} runs`

  return {
    toss: `${teams[tossWinner].name} won the toss and chose to ${fieldsFirst ? 'field' : 'bat'}`,
    keepers,
    conditions,
    innings: [first, second],
    superOvers,
    winner: winner.name,
    result,
  }
}