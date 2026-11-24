type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

let initialized = false;

export function initClarityAnalytics() {
  if (typeof window === "undefined" || typeof document === "undefined" || initialized) return;

  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;
  if (!projectId || typeof projectId !== "string" || !projectId.trim()) return;

  if (!window.clarity) {
    const fn: ClarityFn = (...args: unknown[]) => {
      (fn.q = fn.q || []).push(args);
    };
    window.clarity = fn;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId.trim())}`;
    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  }

  window.clarity("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: "granted",
  });
  initialized = true;
}

export function identifyClaritySession(params: {
  userId: string;
  role?: string;
  screenName: string;
}) {
  if (typeof window === "undefined" || !window.clarity) return;

  window.clarity("identify", params.userId, undefined, params.screenName);
  if (params.role) {
    window.clarity("set", "sigic_role", params.role);
  }
  window.clarity("set", "sigic_screen", params.screenName);
  window.clarity(
    "set",
    "viewport_tier",
    window.innerWidth < 768 ? "mobile_field" : window.innerWidth < 1024 ? "tablet" : "desktop"
  );
}

export function trackClarityChatEvent(
  eventName:
    | "chat_prompt_sent"
    | "chat_quick_action_used"
    | "chat_rate_limited"
    | "chat_copy_response"
    | "chat_error_boundary"
) {
  if (typeof window === "undefined" || !window.clarity) return;
  window.clarity("event", eventName);
  if (eventName === "chat_rate_limited" || eventName === "chat_error_boundary") {
    window.clarity("upgrade", eventName);
  }
}
