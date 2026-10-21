export type RetryOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
};

export function fetchWithRetry(url: string, options?: RetryOptions): Promise<Response>;
