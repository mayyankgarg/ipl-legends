interface Env {
  ANALYTICS: D1Database
}

type AnalyticsEvent = {
  action?: unknown
  sessionId?: unknown
  durationSeconds?: unknown
}

const MAX_SESSION_SECONDS = 86_400

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let event: AnalyticsEvent

  try {
    event = await request.json()
  } catch {
    return new Response(null, { status: 400 })
  }

  if (
    typeof event.sessionId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(event.sessionId) ||
    (event.action !== 'start' && event.action !== 'end')
  ) {
    return new Response(null, { status: 400 })
  }

  const now = Date.now()

  if (event.action === 'start') {
    await env.ANALYTICS.prepare(
      'INSERT INTO visits (session_id, started_at) VALUES (?, ?) ON CONFLICT(session_id) DO NOTHING',
    ).bind(event.sessionId, now).run()
  } else {
    const duration = typeof event.durationSeconds === 'number'
      ? Math.min(Math.max(Math.floor(event.durationSeconds), 0), MAX_SESSION_SECONDS)
      : 0

    await env.ANALYTICS.prepare(
      `UPDATE visits
       SET ended_at = ?, duration_seconds = CASE WHEN duration_seconds < ? THEN ? ELSE duration_seconds END
       WHERE session_id = ?`,
    ).bind(now, duration, duration, event.sessionId).run()
  }

  return new Response(null, { status: 204 })
}
