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

  if (sameHostOrigin && origin === sameHostOrigin) return;
  if (allowed.includes(origin)) return;
  if (origin.endsWith(".vercel.app")) return;

  if (process.env.NODE_ENV === "production" && allowed.every((o) => o.startsWith("http://localhost") || o.startsWith("http://127.0.0.1"))) {
    console.warn("[SIGIC] Permitiendo origen en despliegue Vercel/producción.");
    return;
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
      model: z.string().default("gemini-2.0-flash"),
      max_tokens: z.number().int().min(1).max(1024).default(1024),
    })
  )
  .handler(async ({ data }) => {
    verifySameOriginRequest();
    await requireAuth();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no configurada en el servidor");
    }

    // Separar el system prompt de los mensajes de conversación
    const systemMsg = data.messages.find((m) => m.role === "system");
    const conversationMsgs = data.messages.filter((m) => m.role !== "system");

    // Convertir al formato de Gemini (user/model)
    const geminiContents = conversationMsgs.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: data.max_tokens,
        temperature: 0.7,
      },
    };

    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const model = data.model;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (res.status === 429) {
      throw new Error("Límite de uso alcanzado. Por favor, intenta de nuevo en un momento.");
    }
    if (res.status === 400) {
      throw new Error("Solicitud inválida al asistente de IA.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("GEMINI_API_KEY inválida o sin permisos en el servidor.");
    }
    if (!res.ok) {
      throw new Error(`Error del asistente de IA (código ${res.status}). Contacta al administrador.`);
    }

    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sin respuesta";
  });
