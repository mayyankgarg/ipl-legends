interface Env {
  OPENROUTER_API_KEY: string
}

const MODEL = 'nvidia/nemotron-3-nano-30b-a3b:nitro'
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

  let upstream: Response
  try {
    upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        // Nemotron does not require reasoning, so reserve the response budget for
        // the three visible analyses in each batch.
        max_tokens: 450,
        reasoning: { effort: 'none', exclude: true },
        // The Nitro variant prioritizes throughput. Crusoe is the fastest listed
        // endpoint, with Novita retained as its automatic fallback.
        provider: {
          only: ['crusoe/fp8', 'novita/fp4'],
          sort: 'throughput',
          allow_fallbacks: true,
        },
      }),
    })
  } catch (error) {
    console.error('OpenRouter request threw:', error)
    return Response.json('')
  }

  if (!upstream.ok) {
    // Upstream errors contain provider/model diagnostics, never the user's prompt.
    const details = await upstream.text()
    console.error('OpenRouter request failed:', upstream.status, details)
    return Response.json('')
  }

  let result: OpenRouterResponse
  try {
    result = await upstream.json() as OpenRouterResponse
  } catch (error) {
    console.error('OpenRouter returned invalid JSON:', error)
    return Response.json('')
  }
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
    return Response.json('')
  }

  return Response.json({ text })
}
