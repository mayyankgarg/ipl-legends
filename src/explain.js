// This same-origin Cloudflare Pages Function keeps the OpenRouter key off the client.
const ENDPOINT = '/api/explain'
const TIMEOUT_MS = 45000
const RETRY_DELAYS_MS = [750, 1_500]

const lineup = squad => squad.map((player, index) => `${index + 1}. ${player.name}`).join(', ')
const emptyAnalyses = indexes => new Map(indexes.map(index => [index, '']))

function buildPrompt(comparison, squads, indexes) {
  const [teamA, teamB] = comparison.teams
  const parameters = indexes.map(index => {
    const row = comparison.rows[index]
    const leader = row.a > row.b ? teamA : row.b > row.a ? teamB : null
    return [
      `Index: ${index}`,
      `Parameter: ${row.label}`,
      `What it measures: ${row.detail}`,
      `Weight: ${Math.round(row.weight * 100)}%`,
      `Scores — ${teamA}: ${Math.round(row.a)}, ${teamB}: ${Math.round(row.b)}`,
      leader ? `${leader} is ahead.` : 'The sides are level.',
    ].join('\n')
  }).join('\n\n')

  return [
    'You are a sharp cricket analyst comparing two fantasy IPL XIs on several parameters.',
    '',
    `${teamA} (batting order): ${lineup(squads[0])}`,
    `${teamB} (batting order): ${lineup(squads[1])}`,
    '',
    parameters,
    '',
    'Return JSON only, with this exact shape: {"analyses":[{"index":0,"text":"..."}]}. Include one object for every requested index. Each text must be plain prose under 45 words, explain that parameter only, and name specific players responsible on both sides. No markdown or extra keys.',
  ].join('\n')
}

function parseAnalyses(text, indexes) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('invalid analysis format')
  const parsed = JSON.parse(text.slice(start, end + 1))
  if (!Array.isArray(parsed.analyses)) throw new Error('invalid analysis format')

  const requested = new Set(indexes)
  const analyses = new Map()
  for (const result of parsed.analyses) {
    // GLM occasionally uses `analysis` despite being asked for `text`.
    const text = typeof result?.text === 'string' ? result.text : result?.analysis
    if (!requested.has(result?.index) || typeof text !== 'string' || !text.trim()) continue
    analyses.set(result.index, text.trim())
  }
  return analyses
}

async function requestAnalyses(comparison, squads, indexes, retryDelays) {
  let lastError
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildPrompt(comparison, squads, indexes) }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`endpoint returned ${response.status}`)

      const payload = await response.json()
      const text = typeof payload === 'string' ? payload : payload?.text
      if (text === '') return emptyAnalyses(indexes)
      if (typeof text !== 'string') throw new Error('invalid response')
      return parseAnalyses(text, indexes)
    } catch (error) {
      lastError = new Error(error.name === 'AbortError' ? 'timed out' : error.message)
    } finally {
      clearTimeout(timer)
    }

    if (attempt < retryDelays.length) {
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]))
    }
  }
  throw lastError
}

export async function explainParameterBatch(comparison, squads, indexes) {
  let analyses = new Map()
  try {
    // The shared request is deliberately attempted once. A partial response should
    // recover only its missing rows, rather than regenerate the whole batch.
    analyses = await requestAnalyses(comparison, squads, indexes, [])
  } catch {
    // A malformed batch has no safely reusable rows. Each requested row below gets
    // its own constrained retry path.
  }

  for (const index of indexes) {
    if (analyses.has(index)) continue
    try {
      const recovered = await requestAnalyses(comparison, squads, [index], RETRY_DELAYS_MS)
      analyses.set(index, recovered.get(index) ?? '')
    } catch {
      // Keep this parameter blank after its individual retries are exhausted.
      analyses.set(index, '')
    }
  }

  return analyses
}

export function analysisBatches(rowCount) {
  // Retain the caller contract while ensuring each model request has exactly one
  // parameter to analyze. That removes cross-parameter JSON dependencies.
  return Array.from({ length: rowCount }, (_, index) => [index])
}
