import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../test/fixtures';
import { ApiError, escapeODSQL, exportUrl, fetchJson, quote } from '../api';

describe('ODSQL escaping', () => {
  it('backslash-escapes quotes and backslashes', () => {
    expect(escapeODSQL("L'Hospitalet")).toBe("L\\'Hospitalet");
    expect(quote("a\\'b")).toBe("'a\\\\\\'b'");
  });

  it('builds export URLs with encoded parameters', () => {
    const url = new URL(exportUrl('viajes-de-hoy', { where: "stop_name='Sarrià'" }));
    expect(url.pathname).toMatch(/\/datasets\/viajes-de-hoy\/exports\/json$/);
    expect(url.searchParams.get('where')).toBe("stop_name='Sarrià'");
  });
});

describe('fetchJson', () => {
  it('retries once on a 5xx and then succeeds', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 503)).mockResolvedValueOnce(jsonResponse([1]));
    await expect(fetchJson('https://x.test', { retryDelayMs: 0 })).resolves.toEqual([1]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 4xx', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, 400));
    await expect(fetchJson('https://x.test', { retryDelayMs: 0 })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget on network errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await expect(fetchJson('https://x.test', { retries: 2, retryDelayMs: 0 })).rejects.toThrow('offline');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('times out a hanging request', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
    );
    await expect(fetchJson('https://x.test', { timeoutMs: 10, retries: 0 })).rejects.toThrow(/timed out/);
  });

  it('does not retry when the caller aborts', async () => {
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });
    await expect(fetchJson('https://x.test', { signal: controller.signal, retryDelayMs: 0 })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
