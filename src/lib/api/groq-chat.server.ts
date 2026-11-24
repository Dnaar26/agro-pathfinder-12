import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireCookieUser } from "./auth.server";
import {
  ChatPayloadSchema,
  composeSafeSystemPrompt,
} from "@/lib/ai/agro-prompt-contract";

function allowedOrigins() {
  const configured = (process.env.APP_ALLOWED_ORIGINS ?? "http://localhost:8080,http://127.0.0.1:8080")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.RENDER_EXTERNAL_URL) {
    configured.push(process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, ""));
  }
  if (process.env.VERCEL_URL) {
    configured.push(`https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`);
  }
  return [...new Set(configured)];
}

function assertAllowedOrigin(headers: Headers) {
  const origin = headers.get("origin");
  if (!origin) return;
  const host = headers.get("host");
  const forwardedProto = headers.get("x-forwarded-proto");
  const proto = forwardedProto ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const sameHostOrigin = host ? `${proto}://${host}` : undefined;
  const allowed = allowedOrigins();

  if (sameHostOrigin && origin === sameHostOrigin) return;
  if (allowed.includes(origin)) return;
  if (origin.endsWith(".vercel.app")) return;

  if (
    process.env.NODE_ENV === "production" &&
    allowed.every((o) => o.startsWith("http://localhost") || o.startsWith("http://127.0.0.1"))
  ) {
    return;
  }

  const csrfErr = new Error("Solicitud rechazada por política CSRF");
  (csrfErr as Error & { statusCode?: number }).statusCode = 403;
  throw csrfErr;
}

async function consumeUserQuota(accessToken: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: allowed, error } = await userClient.rpc("consume_ai_chat_quota", {
    p_max_requests: 30,
    p_window_minutes: 60,
  });

  if (error) {
    const code = (error as { code?: string }).code ?? "";
    if (code === "PGRST202" || code === "42883") {
      console.warn("[SIGIC Quota] Función consume_ai_chat_quota pendiente de migración.");
    }
    return;
  }

  if (allowed === false) {
    const quotaErr = new Error(
      "RATE_LIMIT_EXCEEDED: Alcanzaste el límite de 30 consultas por hora. Espera unos minutos antes de realizar otra consulta."
    );
    (quotaErr as Error & { statusCode?: number }).statusCode = 429;
    throw quotaErr;
  }
}

async function authenticateAndCheckQuota(headers?: Headers): Promise<string> {
  const authHeader = headers?.get("authorization");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (authHeader?.startsWith("Bearer ") && supabaseUrl && supabaseKey) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        await consumeUserQuota(token);
        return user.id;
      }
    }
  }

  try {
    const user = await requireCookieUser();
    if (user?.id) {
      const { getAccessToken } = await import("./auth-cookie.server");
      const cookieToken = getAccessToken();
      if (cookieToken) {
        await consumeUserQuota(cookieToken);
      }
      return user.id;
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("RATE_LIMIT_EXCEEDED")) {
      throw err;
    }
  }

  const unauthErr = new Error("No autorizado: Debes iniciar sesión para consultar al Asistente Agronómico.");
  (unauthErr as Error & { statusCode?: number }).statusCode = 401;
  throw unauthErr;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export const AI_NOT_CONFIGURED = "AI_NOT_CONFIGURED";
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30_000;

async function fetchWithRetry(url: string, init: RequestInit, providerName: string): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if ((res.status === 429 || res.status === 503 || res.status === 502) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 8000)));
        continue;
      }
      if (res.status === 429) throw new Error("Límite de solicitudes de IA alcanzado. Espera unos segundos y vuelve a intentarlo.");
      if (res.status === 502 || res.status === 503) throw new Error("El asistente de IA no está disponible en este momento. Inténtalo de nuevo en unos segundos.");
      if (res.status === 401 || res.status === 403) {
        console.error(`[${providerName}] credencial rechazada (${res.status})`);
        throw new Error("El servicio de IA rechazó la credencial configurada en el servidor. Avisa al administrador.");
      }
      if (res.status === 400) {
        console.error(`[${providerName}] 400:`, await res.text().catch(() => ""));
        throw new Error("El asistente de IA no pudo procesar la solicitud.");
      }
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[${providerName} ERROR ${res.status}]`, errBody);
        throw new Error(`Error en el servicio de IA (código ${res.status}). Intenta nuevamente.`);
      }
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      if (err?.name === "AbortError") {
        lastError = new Error("El asistente tardó demasiado en responder. Inténtalo con una pregunta más corta.");
        if (attempt < MAX_RETRIES) continue;
        throw lastError;
      }
      throw err;
    }
  }
  throw lastError ?? new Error("El asistente de IA no pudo procesar tu solicitud. Inténtalo más tarde.");
}

async function askGroq(apiKey: string, system: string, convo: ChatMessage[], maxTokens: number): Promise<string> {
  const res = await fetchWithRetry(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: system }, ...convo],
        max_tokens: maxTokens,
        temperature: 0.35,
      }),
    },
    "GROQ",
  );
  const json = await res.json();
  return String(json.choices?.[0]?.message?.content ?? "").trim();
}

async function askGemini(apiKey: string, system: string, convo: ChatMessage[], maxTokens: number): Promise<string> {
  let model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  if (model === "gemini-2.5-flash" || model === "gemini-1.5-flash") {
    model = "gemini-flash-latest";
  }
  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: convo.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.35 },
      }),
    },
    "GEMINI",
  );
  const json = await res.json();
  const parts: { text?: string }[] = json.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

function prepareSanitizedMessages(parsedData: ReturnType<typeof ChatPayloadSchema.parse>) {
  const clientSystemParts = parsedData.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content);
  const system = composeSafeSystemPrompt(clientSystemParts);
  const convo = parsedData.messages.filter((m) => m.role !== "system");
  if (convo.length === 0) {
    throw new Error("Debes enviar al menos una consulta del usuario.");
  }
  return { system, convo };
}

async function runSanitizedAiChat(parsedData: ReturnType<typeof ChatPayloadSchema.parse>): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!groqKey && !geminiKey) {
    throw new Error(`${AI_NOT_CONFIGURED}: define GROQ_API_KEY (o GEMINI_API_KEY) en las variables de entorno del servidor.`);
  }

  const { system, convo } = prepareSanitizedMessages(parsedData);
  const text = groqKey
    ? await askGroq(groqKey, system, convo, parsedData.max_tokens)
    : await askGemini(geminiKey as string, system, convo, parsedData.max_tokens);

  return text || "Sin respuesta del asistente.";
}

/** Genera un ReadableStream Server-Sent Events (SSE) con TTFT < 300ms desde Groq (o fallback unificado) */
async function createAiSseStream(parsedData: ReturnType<typeof ChatPayloadSchema.parse>): Promise<ReadableStream<Uint8Array>> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!groqKey && !geminiKey) {
    throw new Error(`${AI_NOT_CONFIGURED}: define GROQ_API_KEY (o GEMINI_API_KEY) en las variables de entorno del servidor.`);
  }

  const { system, convo } = prepareSanitizedMessages(parsedData);
  const encoder = new TextEncoder();

  if (!groqKey) {
    const fullText = await askGemini(geminiKey as string, system, convo, parsedData.max_tokens);
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: fullText || "Sin respuesta del asistente." })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      },
    });
  }

  const upstream = await fetchWithRetry(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: system }, ...convo],
        max_tokens: parsedData.max_tokens,
        temperature: 0.35,
        stream: true,
      }),
    },
    "GROQ_STREAM",
  );

  if (!upstream.body) {
    throw new Error("El proveedor de IA no devolvió un flujo de lectura.");
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let emitted = false;
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: delta })}\n\n`));
                emitted = true;
              }
            } catch {
              // Ignorar líneas parciales no-JSON
            }
          }
          if (emitted) return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Flujo interrumpido";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
    },
    cancel() {
      void reader.cancel().catch(() => undefined);
    },
  });
}

/** Server Function oficial consumida como RPC o respaldo no-streaming */
export const chatWithGroq = createServerFn({ method: "POST" })
  .validator(ChatPayloadSchema)
  .handler(async ({ data }) => {
    const req = getRequest();
    if (req?.headers) {
      assertAllowedOrigin(req.headers);
    }
    await authenticateAndCheckQuota(req?.headers);
    return runSanitizedAiChat(data);
  });

/** Endpoint HTTP directo (/api/chat y /api/chat/stream) con soporte dual JSON y Server-Sent Events (SSE) */
export async function handleDirectChatHttpRequest(request: Request, forceStream = false): Promise<Response> {
  try {
    assertAllowedOrigin(request.headers);
    await authenticateAndCheckQuota(request.headers);

    const rawBody = await request.json().catch(() => null);
    const parsed = ChatPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Payload inválido", issues: parsed.error.issues }),
        { status: 400, headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } },
      );
    }

    const wantsStream =
      forceStream ||
      parsed.data.stream === true ||
      (request.headers.get("accept") ?? "").includes("text/event-stream");

    if (wantsStream) {
      const sseStream = await createAiSseStream(parsed.data);
      return new Response(sseStream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          "connection": "keep-alive",
          "x-accel-buffering": "no",
        },
      });
    }

    const reply = await runSanitizedAiChat(parsed.data);
    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } },
    );
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status =
      typeof err?.statusCode === "number"
        ? err.statusCode
        : msg.includes("AI_NOT_CONFIGURED")
          ? 503
          : 500;
    const extraHeaders: Record<string, string> = {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    };
    if (status === 429) extraHeaders["Retry-After"] = "3600";
    return new Response(JSON.stringify({ error: msg }), { status, headers: extraHeaders });
  }
}
