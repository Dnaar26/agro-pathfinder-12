import { supabase } from "@/integrations/supabase/client";
import { trackClarityChatEvent } from "@/lib/analytics/clarity";

const recentFingerprints = new Map<string, number>();
const DEDUPE_WINDOW_MS = 30_000;

export function captureAppError(error: unknown, context: Record<string, unknown> = {}) {
  const err = error instanceof Error ? error : new Error(String(error ?? "Error desconocido"));
  const route = typeof window !== "undefined" ? window.location.pathname : String(context.route ?? "ssr");
  const boundary = String(context.boundary ?? "app_error_boundary");
  const fingerprint = `${route}|${boundary}|${err.message}`;

  const now = Date.now();
  const lastSeen = recentFingerprints.get(fingerprint);
  if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
    return;
  }
  recentFingerprints.set(fingerprint, now);

  console.error("[SIGIC Production Telemetry]", {
    message: err.message,
    route,
    boundary,
    context,
    timestamp: new Date(now).toISOString(),
  });

  if (typeof window === "undefined") return;

  trackClarityChatEvent("chat_error_boundary");

  // 1. Webhook externo opcional (Sentry Relay / Slack / Datadog)
  const webhookUrl = import.meta.env.VITE_ERROR_WEBHOOK_URL;
  if (webhookUrl && typeof webhookUrl === "string" && webhookUrl.startsWith("https://")) {
    void fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: err.message,
        stack: err.stack?.slice(0, 4000),
        route,
        boundary,
        context,
        timestamp: new Date(now).toISOString(),
      }),
      keepalive: true,
    }).catch(() => undefined);
  }

  // 2. Persistencia segura en Supabase (tabla client_error_logs con RLS)
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return;

      await (supabase as any).from("client_error_logs").insert({
        user_id: userId,
        route: route.slice(0, 300),
        boundary: boundary.slice(0, 120),
        message: err.message.slice(0, 2000),
        stack: err.stack ? err.stack.slice(0, 6000) : null,
        metadata: context,
      });
    } catch {
      // No interrumpir experiencia del usuario si la tabla aún no fue migrada
    }
  })();
}
