export function captureAppError(error: unknown, context?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("[SIGIC Error Monitoring]", {
    message: err.message,
    stack: err.stack,
    context,
    timestamp: new Date().toISOString(),
  });
  // Aquí se conectaría Sentry u otro APM en producción:
  // if (typeof window !== 'undefined' && (window as any).Sentry) {
  //   (window as any).Sentry.captureException(err, { extra: context });
  // }
}
