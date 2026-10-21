import { randomUUID } from "node:crypto";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function buildContentSecurityPolicy() {
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "https://api.open-meteo.com",
  ];
  if (process.env.NODE_ENV !== "production") {
    connectSrc.push("ws://localhost:*", "ws://127.0.0.1:*", "http://localhost:*", "http://127.0.0.1:*");
  }
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      connectSrc.push(new URL(supabaseUrl).origin);
    } catch {
      // Ignore invalid optional env here; app-level config validation handles it.
    }
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
  ];
  if (process.env.NODE_ENV === "production") directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()");
  headers.set("Content-Security-Policy", buildContentSecurityPolicy());
  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getRequestId(request: Request) {
  const incoming = request.headers.get("x-request-id")?.trim();
  return incoming && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming) ? incoming : randomUUID();
}

function getReadinessResponse() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowedOrigins = process.env.APP_ALLOWED_ORIGINS;
  const isProduction = process.env.NODE_ENV === "production";
  const checks = {
    supabase_url: Boolean(supabaseUrl),
    supabase_publishable_key: Boolean(publishableKey),
    supabase_service_role_key: Boolean(serviceRoleKey),
    app_allowed_origins: isProduction ? Boolean(allowedOrigins) : true,
    server_entry: true,
  };
  const ready = Object.values(checks).every(Boolean);

  return new Response(JSON.stringify({
    status: ready ? "ready" : "not_ready",
    checks,
    timestamp: new Date().toISOString(),
  }), {
    status: ready ? 200 : 503,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const requestId = getRequestId(request);
    try {
      const url = new URL(request.url);
      if (url.pathname === "/healthz") {
        return withRequestId(withSecurityHeaders(new Response("ok", {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "text/plain; charset=utf-8",
          },
        })), requestId);
      }
      if (url.pathname === "/readyz") {
        return withRequestId(withSecurityHeaders(getReadinessResponse()), requestId);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withRequestId(withSecurityHeaders(await normalizeCatastrophicSsrResponse(response)), requestId);
    } catch (error) {
      console.error(`[request:${requestId}]`, error);
      return withRequestId(withSecurityHeaders(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      })), requestId);
    }
  },
};
