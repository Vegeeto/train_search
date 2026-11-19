/**
 * Thin client for the FGC Opendatasoft v2.1 API.
 *
 * Every dataset used here sends `Access-Control-Allow-Origin: *`, so the app talks to the
 * API straight from the browser. The `exports` endpoint returns every matching row in one
 * response (the `records` endpoint caps `limit` at 100), so it is the default here.
 */

export const API_BASE = 'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets';

const DEBUG = import.meta.env.VITE_APP_DEBUG === 'true';

/**
 * Escape a value for use inside a single-quoted ODSQL string literal.
 * Opendatasoft uses backslash escaping (verified live), not SQL-style quote doubling.
 */
export function escapeODSQL(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function quote(value: string): string {
  return `'${escapeODSQL(value)}'`;
}

export function exportUrl(dataset: string, params: Record<string, string>): string {
  return `${API_BASE}/${dataset}/exports/json?${new URLSearchParams(params)}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface FetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Extra attempts after the first, for network errors, timeouts, 429 and 5xx. */
  retries?: number;
  retryDelayMs?: number;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === undefined || error.status === 429 || error.status >= 500;
  return true; // network failure (TypeError) or our own timeout
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { signal, timeoutMs = 15_000, retries = 1, retryDelayMs = 700 } = options;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (DEBUG) console.debug('[fgc] GET', url);
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new ApiError(`FGC API responded ${response.status}`, response.status);
      const data = (await response.json()) as T;
      if (DEBUG) console.debug('[fgc] OK', url, data);
      return data;
    } catch (error) {
      if (signal?.aborted) throw error; // the caller cancelled: never retry
      const normalized = timedOut ? new ApiError('FGC API request timed out') : error;
      if (attempt >= retries || !isRetryable(normalized)) throw normalized;
      await sleep(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
