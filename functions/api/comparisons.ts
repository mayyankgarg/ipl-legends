interface Env {
  ANALYTICS: D1Database
}

type ComparisonEvent = {
  sessionId?: unknown
  teams?: unknown
}

const isSessionId = (value: unknown) => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value)
const isTeam = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length === 11 &&
  value.every(playerId => typeof playerId === 'string' && playerId.length > 0 && playerId.length <= 120)

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let event: ComparisonEvent

  try {
    event = await request.json()
  } catch {
    return new Response(null, { status: 400 })
  }

  if (!isSessionId(event.sessionId) || !Array.isArray(event.teams) || event.teams.length !== 2 || !isTeam(event.teams[0]) || !isTeam(event.teams[1])) {
    return new Response(null, { status: 400 })
  }

  await env.ANALYTICS.prepare(
    'INSERT INTO team_comparisons (session_id, created_at, team_a_json, team_b_json) VALUES (?, ?, ?, ?)',
  ).bind(event.sessionId, Date.now(), JSON.stringify(event.teams[0]), JSON.stringify(event.teams[1])).run()

  return new Response(null, { status: 204 })
}
