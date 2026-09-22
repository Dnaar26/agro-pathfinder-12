import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function allowedOrigins() {
  return (process.env.APP_ALLOWED_ORIGINS ?? "http://localhost:8080,http://127.0.0.1:8080")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function verifySameOriginRequest() {
  const request = getRequest();
  const origin = request?.headers?.get("origin");
  // No origin header = same-origin request from SSR or non-browser client — allow.
  if (!origin) return;
  const host = request?.headers?.get("host");
  const forwardedProto = request?.headers?.get("x-forwarded-proto");
  const proto = forwardedProto ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const sameHostOrigin = host ? `${proto}://${host}` : undefined;
  const allowed = allowedOrigins();
  // In production, APP_ALLOWED_ORIGINS must be set to the deployed URL.
  // If it is not set and we are in production, reject all cross-origin requests.
  if (process.env.NODE_ENV === "production" && allowed.every((o) => o.startsWith("http://localhost") || o.startsWith("http://127.0.0.1"))) {
    console.error("[SIGIC] APP_ALLOWED_ORIGINS is not configured for production. Set it to your deployed URL (e.g. https://sigic.onrender.com).");
  }
  if (origin !== sameHostOrigin && !allowed.includes(origin)) {
    throw new Error("Solicitud rechazada por política CSRF");
  }
}

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name} en el servidor`);
  return value;
}

/** Verifica JWT del request y retorna userId */
async function requireAuth(): Promise<string> {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("No autorizado");
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_PUBLISHABLE_KEY"),
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("No autorizado: token inválido");
  return user.id;
}

export const chatWithGroq = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      messages: z.array(
        z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string().trim().min(1).max(4000),
        })
      ).min(1).max(20),
      model: z.string().default("llama-3.3-70b-versatile"),
      max_tokens: z.number().int().min(1).max(1024).default(1024),
    })
  )
  .handler(async ({ data }) => {
    verifySameOriginRequest();
    await requireAuth();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY no configurada en el servidor");
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: data.model,
        messages: data.messages,
        max_tokens: data.max_tokens,
      }),
    });

    if (res.status === 429) {
      throw new Error("Límite de uso. Espera un minuto.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("API key inválida en el servidor. Contacta al administrador.");
    }
    if (!res.ok) {
      throw new Error(`Error Groq ${res.status}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "Sin respuesta";
  });
