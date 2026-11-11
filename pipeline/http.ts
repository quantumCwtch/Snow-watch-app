// Fetch with timeout, retries and exponential backoff.
import { config } from '../src/lib/config';

export class HttpError extends Error {
  constructor(message: string, public status: number | null) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { attempts?: number; baseDelayMs?: number; retryOn404?: boolean } = {},
): Promise<Response> {
  const attempts = opts.attempts ?? config.pipeline.retryAttempts;
  const base = opts.baseDelayMs ?? config.pipeline.retryBaseDelayMs;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.pipeline.requestTimeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      // Do not retry client errors other than 408/429 (and 404 unless asked).
      const retryable = res.status >= 500 || res.status === 408 || res.status === 429 || (res.status === 404 && opts.retryOn404);
      lastErr = new HttpError(`HTTP ${res.status} for ${redact(url)}`, res.status);
      if (!retryable) throw lastErr;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof HttpError && !(e.status === null || e.status >= 500 || e.status === 408 || e.status === 429)) throw e;
      lastErr = e;
    }
    if (i < attempts - 1) await sleep(base * 2 ** i);
  }
  throw lastErr instanceof Error ? lastErr : new HttpError(String(lastErr), null);
}

/** Never log query strings (keys are sent in headers, but be safe). */
export function redact(url: string): string {
  return url.replace(/([?&](api[-_]?key|key|token)=)[^&]+/gi, '$1***');
}
