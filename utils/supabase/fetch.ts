const SUPABASE_REQUEST_TIMEOUT_MS = 4500

function timeoutResponse() {
  return new Response(
    JSON.stringify({
      code: 'FLORMULA1_TIMEOUT',
      message: 'Supabase did not respond before the request deadline.',
    }),
    {
      status: 408,
      headers: {
        'content-type': 'application/json',
      },
    }
  )
}

/**
 * Bound every Supabase request so a degraded service cannot hold open a large
 * number of Worker, server, or browser requests while Auth retries.
 */
export async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const sourceSignal = init?.signal
  let timedOut = false

  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, SUPABASE_REQUEST_TIMEOUT_MS)

  const abortFromSource = () => controller.abort()
  if (sourceSignal) {
    if (sourceSignal.aborted) {
      controller.abort()
    } else {
      sourceSignal.addEventListener('abort', abortFromSource, { once: true })
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut && !sourceSignal?.aborted) {
      // Return a non-retryable HTTP response. Throwing here would make Auth's
      // retry loop turn one timeout into several requests.
      return timeoutResponse()
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
    sourceSignal?.removeEventListener('abort', abortFromSource)
  }
}
