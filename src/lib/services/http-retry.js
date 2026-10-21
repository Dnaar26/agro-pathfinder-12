const RETRYABLE_STATUS = (status) =>
  status === 408 || status === 425 || status === 429 || status >= 500;

export async function fetchWithRetry(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 8_000;
  const maxAttempts = Math.max(1, Math.min(3, options.maxAttempts ?? 2));
  const baseDelayMs = options.baseDelayMs ?? 350;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!RETRYABLE_STATUS(response.status) || attempt === maxAttempts) return response;

      const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
      await response.body?.cancel().catch(() => undefined);
      clearTimeout(timeout);
      await delay(retryAfter ?? baseDelayMs * 2 ** (attempt - 1));
    } catch (error) {
      lastError = error;
      clearTimeout(timeout);
      if (attempt === maxAttempts) throw error;
      await delay(baseDelayMs * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("External request failed");
}

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(value) - Date.now();
  return Number.isFinite(milliseconds) && milliseconds > 0 ? Math.min(milliseconds, 2_000) : null;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, Math.min(milliseconds, 2_000)));
}
