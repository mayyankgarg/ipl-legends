// This same-origin Cloudflare Pages Function keeps the OpenRouter key off the client.
const ENDPOINT = '/api/explain'
const TIMEOUT_MS = 45000

const lineup = squad => squad.map((player, index) => `${index + 1}. ${player.name}`).join(', ')

function buildPrompt(comparison, squads, row) {
  const [teamA, teamB] = comparison.teams
  const leader = row.a > row.b ? teamA : row.b > row.a ? teamB : null

  return [
    'You are a sharp cricket analyst comparing two fantasy IPL XIs on a single parameter.',
    '',
    `${teamA} (batting order): ${lineup(squads[0])}`,
    `${teamB} (batting order): ${lineup(squads[1])}`,
    '',
    `Parameter: ${row.label}`,
    `What it measures: ${row.detail}`,
    `Weight in the overall verdict: ${Math.round(row.weight * 100)}%`,
    `Scores out of 100 — ${teamA}: ${Math.round(row.a)}, ${teamB}: ${Math.round(row.b)}`,
    leader ? `${leader} is ahead here.` : 'The sides are level here.',
    '',
    'In two sentences of plain prose, explain how each side performs on THIS parameter and why the gap exists. Name the specific players responsible on both sides. No markdown, no bullet points, no headings, no preamble. Under 45 words.',
  ].join('\n')
}

export async function explainParameter(comparison, squads, index) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: buildPrompt(comparison, squads, comparison.rows[index]),
      }),
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`endpoint returned ${response.status}`)

    const { text } = await response.json()
    if (!text) throw new Error('empty response')
    return text
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'timed out' : error.message)
  } finally {
    clearTimeout(timer)
  }
}
