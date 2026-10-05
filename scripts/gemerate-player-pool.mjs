import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { playerStyles } from '../src/playerStyles.js'
import { fieldingRatings } from '../src/fieldingRatings.js'
import { playerCountries } from '../src/playerCountries.js'

const archiveDirectory = process.argv[2]

if (!archiveDirectory) {
  throw new Error('Usage: node scripts/generate-player-pool.mjs <extracted-ipl-json-directory>')
}

const franchiseIds = {
  'Chennai Super Kings': 'CSK',
  'Delhi Capitals': 'DC',
  'Delhi Daredevils': 'DC',
  'Gujarat Titans': 'GT',
  'Kings XI Punjab': 'PBKS',
  'Kolkata Knight Riders': 'KKR',
  'Lucknow Super Giants': 'LSG',
  'Mumbai Indians': 'MI',
  'Punjab Kings': 'PBKS',
  'Rajasthan Royals': 'RR',
  'Royal Challengers Bangalore': 'RCB',
  'Royal Challengers Bengaluru': 'RCB',
  'Sunrisers Hyderabad': 'SRH',
}

const bowlerCredited = kind => !['retired hurt', 'retired out', 'obstructing the field', 'run out'].includes(kind)
const files = readdirSync(archiveDirectory).filter(name => name.endsWith('.json'))
const readMatch = filename => JSON.parse(readFileSync(resolve(archiveDirectory, filename), 'utf8'))
const primaryName = names => [...names].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
const positionKey = position => position <= 2 ? 'open' : String(position)

const people = new Map()
const headToHead = new Map()

function ensurePerson(registryId) {
  const record = people.get(registryId) ?? {
    id: `cs-${registryId}`,
    names: new Map(),
    teams: new Set(),
    stats: { batBalls: 0, batRuns: 0, outs: 0, bowlBalls: 0, bowlRuns: 0, wickets: 0, matches: 0, phases: [0, 0, 0], phaseRuns: [0, 0, 0], phaseWickets: [0, 0, 0], byPosition: {} },
    position: { sum: 0, count: 0 },
    keptWicket: false,
  }
  people.set(registryId, record)
  return record
}

for (const filename of files) {
  const match = readMatch(filename)
  const registry = match.info?.registry?.people ?? {}

  for (const [franchiseName, names] of Object.entries(match.info?.players ?? {})) {
    const franchiseId = franchiseIds[franchiseName]

    for (const name of names) {
      const registryId = registry[name]
      if (!registryId) continue
      const record = ensurePerson(registryId)
      record.stats.matches += 1
      if (!franchiseId) continue
      record.names.set(name, (record.names.get(name) ?? 0) + 1)
      record.teams.add(franchiseId)
    }
  }

  for (const innings of match.innings ?? []) {
    const arrivalOrder = []
    const inningsPositions = new Map()

    const ensurePosition = name => {
      if (!inningsPositions.has(name)) {
        arrivalOrder.push(name)
        inningsPositions.set(name, arrivalOrder.length)
        const registryId = registry[name]
        if (registryId) {
          const bucket = positionKey(arrivalOrder.length)
          const record = ensurePerson(registryId)
          const positionStats = record.stats.byPosition[bucket] ?? { innings: 0, balls: 0, runs: 0, outs: 0 }
          positionStats.innings += 1
          record.stats.byPosition[bucket] = positionStats
        }
      }
      return positionKey(inningsPositions.get(name))
    }

    for (const over of innings.overs ?? []) {
      const phaseIndex = over.over < 6 ? 0 : over.over < 15 ? 1 : 2

      for (const delivery of over.deliveries ?? []) {
        const batterId = registry[delivery.batter]
        const bowlerId = registry[delivery.bowler]
        if (!batterId || !bowlerId) continue

        const batterPosition = ensurePosition(delivery.batter)
        ensurePosition(delivery.non_striker)

        const batter = ensurePerson(batterId)
        const bowler = ensurePerson(bowlerId)
        const legalBall = !delivery.extras?.wides && !delivery.extras?.noballs
        const conceded = delivery.runs.total - (delivery.extras?.byes ?? 0) - (delivery.extras?.legbyes ?? 0)
        const matchupKey = `${batter.id}:${bowler.id}`
        const matchup = headToHead.get(matchupKey) ?? { balls: 0, runs: 0, wickets: 0 }

        if (legalBall) {
          batter.stats.batBalls += 1
          batter.stats.byPosition[batterPosition].balls += 1
          bowler.stats.bowlBalls += 1
          bowler.stats.phases[phaseIndex] += 1
          matchup.balls += 1
        }
        batter.stats.batRuns += delivery.runs.batter
        batter.stats.byPosition[batterPosition].runs += delivery.runs.batter
        bowler.stats.bowlRuns += conceded
        bowler.stats.phaseRuns[phaseIndex] += conceded
        matchup.runs += delivery.runs.batter

        for (const wicket of delivery.wickets ?? []) {
          const dismissedId = registry[wicket.player_out]
          if (dismissedId) {
            const dismissed = ensurePerson(dismissedId)
            dismissed.stats.outs += 1
            const dismissedPosition = ensurePosition(wicket.player_out)
            dismissed.stats.byPosition[dismissedPosition].outs += 1
          }
          if (bowlerCredited(wicket.kind)) {
            bowler.stats.wickets += 1
            bowler.stats.phaseWickets[phaseIndex] += 1
            if (dismissedId === batterId) matchup.wickets += 1
          }
          if (wicket.kind === 'stumped') {
            for (const fielder of wicket.fielders ?? []) {
              const keeperId = registry[fielder.name]
              if (keeperId) ensurePerson(keeperId).keptWicket = true
            }
          }
        }
        headToHead.set(matchupKey, matchup)
      }
    }

    arrivalOrder.forEach((name, index) => {
      const registryId = registry[name]
      if (!registryId) return
      const record = ensurePerson(registryId)
      record.position.sum += index + 1
      record.position.count += 1
    })
  }
}

const styleById = new Map()

for (const record of people.values()) {
  if (!record.names.size) continue
  const declared = playerStyles[primaryName(record.names)]
  if (!declared) continue
  const [bat, bowl = null] = declared.split(' ')
  const average = record.position.count ? record.position.sum / record.position.count : null
  const slot = average === null ? null : average <= 2.5 ? 'O' : average <= 6.5 ? 'M' : 'L'
  styleById.set(record.id, { bat, bowl, arch: slot ? `${bat}${slot}` : null })
}

const batterVsBowlType = {}
const bowlerVsBatType = {}

for (const filename of files) {
  const match = readMatch(filename)
  const registry = match.info?.registry?.people ?? {}

  for (const innings of match.innings ?? []) {
    for (const over of innings.overs ?? []) {
      for (const delivery of over.deliveries ?? []) {
        const batterId = registry[delivery.batter] && `cs-${registry[delivery.batter]}`
        const bowlerId = registry[delivery.bowler] && `cs-${registry[delivery.bowler]}`
        if (!batterId || !bowlerId) continue

        const bowlerStyle = styleById.get(bowlerId)
        const batterStyle = styleById.get(batterId)
        const legalBall = !delivery.extras?.wides && !delivery.extras?.noballs
        const dismissals = delivery.wickets ?? []

        if (bowlerStyle?.bowl) {
          const bucket = ((batterVsBowlType[batterId] ??= {})[bowlerStyle.bowl] ??= [0, 0, 0])
          if (legalBall) bucket[0] += 1
          bucket[1] += delivery.runs.batter
          for (const wicket of dismissals) {
            if (registry[wicket.player_out] && `cs-${registry[wicket.player_out]}` === batterId) bucket[2] += 1
          }
        }

        if (batterStyle?.arch) {
          const bucket = ((bowlerVsBatType[bowlerId] ??= {})[batterStyle.arch] ??= [0, 0, 0])
          if (legalBall) bucket[0] += 1
          bucket[1] += delivery.runs.batter
          for (const wicket of dismissals) {
            if (bowlerCredited(wicket.kind)) bucket[2] += 1
          }
        }
      }
    }
  }
}

const activePeople = [...people.values()].filter(({ teams }) => teams.size > 0)
const activeIds = new Set(activePeople.map(({ id }) => id))
const players = activePeople
  .map(({ id, names, teams, stats, keptWicket }) => {
    const name = primaryName(names)
    // Marquee is a career-impact threshold, so the picker can surface headline players first.
    const marquee = stats.batRuns >= 1800 || stats.wickets >= 70 || (stats.batRuns >= 900 && stats.wickets >= 30)
    return {
      id,
      name,
      teams: [...teams].sort(),
      role: keptWicket ? 'Wicketkeeper' : stats.bowlBalls >= 60 && stats.batBalls >= 60 ? 'All-rounder' : stats.bowlBalls >= 60 ? 'Bowler' : 'Batter',
      country: playerCountries[name] ?? 'India',
      fielding: fieldingRatings[name] ?? 3,
      marquee,
      stats,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const pruneBuckets = table => Object.fromEntries(
  Object.entries(table)
    .filter(([id]) => activeIds.has(id))
    .map(([id, buckets]) => [id, Object.fromEntries(Object.entries(buckets).filter(([, [balls]]) => balls >= 12))])
    .filter(([, buckets]) => Object.keys(buckets).length),
)

const matchupData = [...headToHead]
  .filter(([key]) => key.split(':').every(id => activeIds.has(id)))
  .map(([key, { balls, runs, wickets }]) => [key, [balls, runs, wickets]])
const archetypes = Object.fromEntries([...styleById].filter(([id]) => activeIds.has(id)))

const playerOutput = `// Generated from https://cricsheet.org/downloads/ipl_json.zip\n// Includes players listed in IPL match records; defunct franchises remain separate.\nexport const historicalPlayers = ${JSON.stringify(players, null, 2)}\n`
const matchupOutput = [
  '// Generated from https://cricsheet.org/downloads/ipl_json.zip',
  `export const headToHead = new Map(${JSON.stringify(matchupData)})`,
  `export const playerArchetypes = ${JSON.stringify(archetypes)}`,
  `export const batterVsBowlType = ${JSON.stringify(pruneBuckets(batterVsBowlType))}`,
  `export const bowlerVsBatType = ${JSON.stringify(pruneBuckets(bowlerVsBatType))}`,
  '',
].join('\n')

writeFileSync(resolve('src/generatedPlayers.js'), playerOutput)
writeFileSync(resolve('src/generatedMatchups.js'), matchupOutput)
console.log(`Generated ${players.length} players, ${matchupData.length} head-to-head pairs, ${Object.keys(archetypes).length} styled players.`)