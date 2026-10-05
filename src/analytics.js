const SESSION_KEY = 'ipl-legends-analytics-session'
const startedAt = Date.now()
export const analyticsSessionId = sessionStorage.getItem(SESSION_KEY) ?? crypto.randomUUID()

sessionStorage.setItem(SESSION_KEY, analyticsSessionId)

function send(event) {
  const body = JSON.stringify({ sessionId: analyticsSessionId, ...event })
  if (event.action === 'end' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }))
    return
  }
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

send({ action: 'start' })

window.addEventListener('pagehide', () => {
  send({ action: 'end', durationSeconds: (Date.now() - startedAt) / 1000 })
}, { once: true })

export function recordComparison(teams) {
  fetch('/api/comparisons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: analyticsSessionId, teams }),
    keepalive: true,
  }).catch(() => {})
}
