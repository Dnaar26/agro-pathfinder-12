import assert from "node:assert/strict";
import { test } from "node:test";
import { createYearComparison, isWithinPeriod } from "../src/lib/financial-periods.js";
import { fetchWithRetry } from "../src/lib/services/http-retry.js";

async function withFetch(mockFetch, callback) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    await callback();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test("current year compares matching year-to-date dates", () => {
  const period = createYearComparison(2026, new Date(2026, 9, 21, 12));
  assert.equal(period.isYearToDate, true);
  assert.equal(period.currentEnd.getMonth(), 9);
  assert.equal(period.currentEnd.getDate(), 21);
  assert.equal(period.currentEnd.getHours(), 23);
  assert.equal(period.previousEnd.getFullYear(), 2025);
  assert.equal(period.previousEnd.getMonth(), 9);
  assert.equal(period.previousEnd.getDate(), 21);
});

test("year-to-date comparison clamps leap day to the previous month's last day", () => {
  const period = createYearComparison(2024, new Date(2024, 1, 29, 12));
  assert.equal(period.previousEnd.getFullYear(), 2023);
  assert.equal(period.previousEnd.getMonth(), 1);
  assert.equal(period.previousEnd.getDate(), 28);
});

test("historical year comparison uses complete calendar years", () => {
  const period = createYearComparison(2024, new Date(2026, 9, 21));
  assert.equal(period.isYearToDate, false);
  assert.equal(period.currentEnd.getFullYear(), 2024);
  assert.equal(period.currentEnd.getMonth(), 11);
  assert.equal(period.currentEnd.getDate(), 31);
  assert.equal(period.previousEnd.getFullYear(), 2023);
  assert.equal(isWithinPeriod("2024-12-31T23:59:00", period.currentStart, period.currentEnd), true);
  assert.equal(isWithinPeriod("2025-01-01T00:00:00", period.currentStart, period.currentEnd), false);
});

test("retries temporary server errors and succeeds within the attempt limit", async () => {
  let attempts = 0;
  await withFetch(async () => {
    attempts += 1;
    const attempt = attempts;
    return attempt === 1 ? new Response("busy", { status: 503 }) : new Response("ok", { status: 200 });
  }, async () => {
    const response = await fetchWithRetry("https://mock.invalid", { maxAttempts: 2, baseDelayMs: 1 });
    assert.equal(response.status, 200);
    assert.equal(attempts, 2);
  });
});

test("does not retry permanent client errors", async () => {
  let attempts = 0;
  await withFetch(async () => {
    attempts += 1;
    return new Response("missing", { status: 404 });
  }, async () => {
    const response = await fetchWithRetry("https://mock.invalid", { maxAttempts: 3, baseDelayMs: 1 });
    assert.equal(response.status, 404);
    assert.equal(attempts, 1);
  });
});

test("retries network errors only up to the configured maximum", async () => {
  let attempts = 0;
  await withFetch(async () => {
    attempts += 1;
    throw new Error("offline");
  }, async () => {
    await assert.rejects(fetchWithRetry("https://mock.invalid", { maxAttempts: 2, baseDelayMs: 1 }), /offline/);
    assert.equal(attempts, 2);
  });
});
