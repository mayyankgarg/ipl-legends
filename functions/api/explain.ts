interface Env {
  OPENROUTER_API_KEY: string
}

const MODEL = 'nvidia/nemotron-3-nano-30b-a3b'
const MAX_PROMPT_LENGTH = 6_000

interface OpenRouterChoice {
  finish_reason?: string | null
  native_finish_reason?: string | null
  error?: { code?: number; message?: string }
  message?: {
    content?: string | null
    reasoning?: string | null
    reasoning_details?: unknown[]
  }
}

interface OpenRouterResponse {
  id?: string
  choices?: OpenRouterChoice[]
  usage?: {
    completion_tokens?: number
    completion_tokens_details?: { reasoning_tokens?: number }
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: { prompt?: unknown }

  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Request body must be JSON.' }, { status: 400 })
  }

  if (!env.OPENROUTER_API_KEY) {
    return Response.json({ error: 'AI service is not configured.' }, { status: 503 })
  }

  if (typeof payload.prompt !== 'string' || !payload.prompt.trim() || payload.prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json({ error: 'Prompt is invalid or too long.' }, { status: 400 })
  }

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': new URL(request.url).origin,
      'X-Title': 'IPL Legends XI',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: payload.prompt }],
      max_tokens: 120,
      // This task needs a short visible answer. Prevent reasoning tokens from
      // consuming the entire 120-token completion budget before text is emitted.
      reasoning: { effort: 'none', exclude: true },
      // Route only through the currently healthy endpoints, with automatic fallback.
      // Do not pin the request to one provider.
      provider: {
        only: ['crusoe/fp8', 'nebius/fp8', 'novita/fp4'],
        allow_fallbacks: true,
      },
    }),
  })

  if (!upstream.ok) {
    console.error('OpenRouter request failed:', upstream.status)
    return Response.json({ error: 'AI analysis is temporarily unavailable.' }, { status: 502 })
  }

  const result = await upstream.json() as OpenRouterResponse
  const choice = result.choices?.[0]
  const text = choice?.message?.content?.trim()

  if (!text) {
    // Keep diagnostics useful without retaining prompts or generated content.
    console.error('OpenRouter returned an empty completion:', {
      generationId: result.id,
      finishReason: choice?.finish_reason,
      nativeFinishReason: choice?.native_finish_reason,
      upstreamError: choice?.error?.code,
      hasReasoning: Boolean(choice?.message?.reasoning || choice?.message?.reasoning_details?.length),
      completionTokens: result.usage?.completion_tokens,
      reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens,
    })
    return Response.json({ error: 'AI analysis returned no text.' }, { status: 502 })
  }

  return Response.json({ text })
}
