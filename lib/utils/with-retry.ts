/**
 * Generic retry wrapper with exponential backoff.
 * Only retries on retriable errors (5xx, timeouts, network errors).
 * Never retries on 4xx (bad request, auth, etc.).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    retries?: number      // default 2
    delayMs?: number      // default 1000
    label?: string        // for logging, e.g. 'Claude API'
  }
): Promise<T> {
  const { retries = 2, delayMs = 1000, label = 'withRetry' } = options ?? {}

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isLast = attempt === retries

      // Don't retry AbortErrors (intentional cancellation)
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) throw err

      // Don't retry non-retriable HTTP errors
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) throw err

      if (isLast) throw err

      const delay = delayMs * Math.pow(2, attempt)
      console.warn(`[${label}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        err instanceof Error ? err.message : err)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  throw new Error('Unreachable')
}

/**
 * Custom error class for HTTP errors that carries the status code.
 */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

/**
 * Fetch wrapper that throws HttpError on non-OK responses.
 * Use with withRetry for automatic retry on 5xx/network errors.
 */
export async function fetchOrThrow(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new HttpError(res.status, `${res.status} ${res.statusText}: ${body.slice(0, 200)}`)
  }
  return res
}
