import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireCookieUser } from "./auth.server";
import {
  ChatPayloadSchema,
  composeSafeSystemPrompt,
} from "@/lib/ai/agro-prompt-contract";

/** Modelos dados de baja en planes gratuitos que se redirigen automáticamente a reemplazos activos gratuitos */
const RETIRED_MODEL_IDS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
]);

type FreeCandidate = {
  provider: "groq" | "gemini" | "openrouter";
  model: string;
  apiKey: string;
  supportsVision: boolean;
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export const AI_NOT_CONFIGURED = "AI_NOT_CONFIGURED";
/** Timeout ágil por modelo (9.5s) para saltar de inmediato al siguiente modelo gratuito sin colgar la pantalla */
const PER_MODEL_TIMEOUT_MS = 9_500;

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

/**
 * Verifica identidad JWT y consume cuota en UNA sola llamada RPC a PostgREST para reducir latencia a la mitad.
 * Solo hace fallback a auth.getUser si la migración SQL de cuotas aún no fue aplicada en local.
 */
async function verifyTokenAndConsumeQuota(accessToken: string): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return false;

  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: allowed, error } = await userClient.rpc("consume_ai_chat_quota", {
    p_max_requests: 35,
    p_window_minutes: 60,
  });

  if (!error) {
    if (allowed === false) {
      const quotaErr = new Error(
        "RATE_LIMIT_EXCEEDED: Alcanzaste el límite de 35 consultas por hora en tu cuenta. Intenta más tarde."
      );
      (quotaErr as Error & { statusCode?: number }).statusCode = 429;
      throw quotaErr;
    }
    return true;
  }

  const code = (error as { code?: string }).code ?? "";
  const msg = (error.message || "").toLowerCase();

  // Si la función RPC aún no está migrada en BD local, validamos el usuario directamente
  if (code === "PGRST202" || code === "42883") {
    const { data: userRes, error: authErr } = await userClient.auth.getUser(accessToken);
    return !authErr && Boolean(userRes?.user);
  }

  if (code === "PGRST301" || msg.includes("not authenticated") || msg.includes("jwt")) {
    return false;
  }

  // Error transitorio de red o permisos de tabla: verificamos sesión para no bloquear falsamente
  const { data: fallbackUser, error: fallbackErr } = await userClient.auth.getUser(accessToken);
  return !fallbackErr && Boolean(fallbackUser?.user);
}

async function authenticateAndCheckQuota(headers?: Headers): Promise<void> {
  const authHeader = headers?.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token && (await verifyTokenAndConsumeQuota(token))) {
      return;
    }
  }

  try {
    const user = await requireCookieUser();
    if (user?.id) {
      const { getAccessToken } = await import("./auth-cookie.server");
      const cookieToken = getAccessToken();
      if (cookieToken) {
        await verifyTokenAndConsumeQuota(cookieToken);
      }
      return;
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

/**
 * Construye la cascada ordenada de modelos 100% GRATUITOS (sin tarjeta de crédito) disponibles según las API keys configuradas:
 * - Groq Free Plan: openai/gpt-oss-120b (~500 tok/s), openai/gpt-oss-20b (~1000 tok/s), qwen/qwen3.8-27b (~450 tok/s + visión)
 * - Google AI Studio Free Tier: gemini-3.5-flash-lite (ultra rápido + visión), gemini-3.8-flash (razonamiento + visión)
 * - OpenRouter Free Router (opcional): openrouter/free ($0/M auto-router)
 */
function buildFreeModelCascade(opts: {
  mode: "fast" | "balanced";
  hasImage: boolean;
}): FreeCandidate[] {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!groqKey && !geminiKey && !openRouterKey) {
    throw new Error(
      `${AI_NOT_CONFIGURED}: configura al menos una clave gratuita en el servidor (GROQ_API_KEY en console.groq.com, GEMINI_API_KEY en aistudio.google.com u OPENROUTER_API_KEY en openrouter.ai).`
    );
  }

  const rawGroqEnvModel = process.env.GROQ_MODEL?.trim();
  const customGroqModel =
    rawGroqEnvModel && !RETIRED_MODEL_IDS.has(rawGroqEnvModel) ? rawGroqEnvModel : null;

  const rawGeminiEnvModel = process.env.GEMINI_MODEL?.trim();
  const customGeminiModel =
    rawGeminiEnvModel && !RETIRED_MODEL_IDS.has(rawGeminiEnvModel) ? rawGeminiEnvModel : null;

  const candidates: FreeCandidate[] = [];
  const pushUnique = (item: FreeCandidate) => {
    if (!candidates.some((c) => c.provider === item.provider && c.model === item.model)) {
      candidates.push(item);
    }
  };

  if (opts.hasImage) {
    // Priorizar modelos gratuitos multimodales para diagnóstico de hojas/cultivos
    if (groqKey) {
      pushUnique({ provider: "groq", model: "qwen/qwen3.8-27b", apiKey: groqKey, supportsVision: true });
    }
    if (geminiKey) {
      pushUnique({ provider: "gemini", model: customGeminiModel || "gemini-3.5-flash-lite", apiKey: geminiKey, supportsVision: true });
      pushUnique({ provider: "gemini", model: "gemini-3.8-flash", apiKey: geminiKey, supportsVision: true });
    }
    if (openRouterKey) {
      pushUnique({ provider: "openrouter", model: "openrouter/free", apiKey: openRouterKey, supportsVision: true });
    }
    // Si solo tiene GROQ_API_KEY y fallara el modelo multimodal, respaldar en texto
    if (groqKey) {
      pushUnique({ provider: "groq", model: "openai/gpt-oss-120b", apiKey: groqKey, supportsVision: false });
      pushUnique({ provider: "groq", model: "openai/gpt-oss-20b", apiKey: groqKey, supportsVision: false });
    }
    return candidates;
  }

  if (opts.mode === "fast") {
    // Modo ultra-rápido (~1,000 tok/s) para widgets de Dashboard y Reportes sin gastar el cupo del modelo 120B
    if (groqKey) {
      pushUnique({ provider: "groq", model: "openai/gpt-oss-20b", apiKey: groqKey, supportsVision: false });
      pushUnique({ provider: "groq", model: "openai/gpt-oss-120b", apiKey: groqKey, supportsVision: false });
      pushUnique({ provider: "groq", model: "qwen/qwen3.8-27b", apiKey: groqKey, supportsVision: true });
    }
    if (geminiKey) {
      pushUnique({ provider: "gemini", model: customGeminiModel || "gemini-3.5-flash-lite", apiKey: geminiKey, supportsVision: true });
    }
    if (openRouterKey) {
      pushUnique({ provider: "openrouter", model: "openrouter/free", apiKey: openRouterKey, supportsVision: false });
    }
    return candidates;
  }

  // Modo balanceado para el Copiloto Agronómico principal (/chat)
  if (groqKey) {
    if (customGroqModel) {
      pushUnique({ provider: "groq", model: customGroqModel, apiKey: groqKey, supportsVision: false });
    }
    pushUnique({ provider: "groq", model: "openai/gpt-oss-120b", apiKey: groqKey, supportsVision: false });
    pushUnique({ provider: "groq", model: "openai/gpt-oss-20b", apiKey: groqKey, supportsVision: false });
    pushUnique({ provider: "groq", model: "qwen/qwen3.8-27b", apiKey: groqKey, supportsVision: true });
  }
  if (geminiKey) {
    if (customGeminiModel) {
      pushUnique({ provider: "gemini", model: customGeminiModel, apiKey: geminiKey, supportsVision: true });
    }
    pushUnique({ provider: "gemini", model: "gemini-3.5-flash-lite", apiKey: geminiKey, supportsVision: true });
    pushUnique({ provider: "gemini", model: "gemini-3.8-flash", apiKey: geminiKey, supportsVision: true });
  }
  if (openRouterKey) {
    pushUnique({ provider: "openrouter", model: "openrouter/free", apiKey: openRouterKey, supportsVision: false });
  }

  return candidates;
}

async function fetchWithFastTimeout(url: string, init: RequestInit, timeoutMs = PER_MODEL_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      throw new Error(`Timeout (${timeoutMs}ms) esperando al modelo`);
    }
    throw err;
  }
}

function buildOpenAiMessages(
  system: string,
  convo: ChatMessage[],
  imageDataUrl?: string | null,
  includeVision = false
) {
  return [
    { role: "system", content: system },
    ...convo.map((m, idx) => {
      const isLastUser = m.role === "user" && idx === convo.length - 1;
      if (isLastUser && imageDataUrl && includeVision) {
        return {
          role: "user",
          content: [
            { type: "text", text: m.content },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        };
      }
      return { role: m.role, content: m.content };
    }),
  ];
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

async function callCandidateJson(
  candidate: FreeCandidate,
  system: string,
  convo: ChatMessage[],
  maxTokens: number,
  imageDataUrl?: string | null
): Promise<string> {
  if (candidate.provider === "gemini") {
    const parsedImg = imageDataUrl && candidate.supportsVision ? parseDataUrl(imageDataUrl) : null;
    const contents = convo.map((m, idx) => {
      const isLastUser = m.role === "user" && idx === convo.length - 1;
      const parts: Record<string, unknown>[] = [{ text: m.content }];
      if (isLastUser && parsedImg) {
        parts.push({ inlineData: { mimeType: parsedImg.mimeType, data: parsedImg.data } });
      }
      return { role: m.role === "assistant" ? "model" : "user", parts };
    });

    const res = await fetchWithFastTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": candidate.apiKey },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.35 },
        }),
      }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Gemini ${candidate.model} HTTP ${res.status}: ${errBody.slice(0, 180)}`);
    }
    const json = await res.json();
    const parts: { text?: string }[] = json.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    if (!text) throw new Error(`Gemini ${candidate.model} devolvió respuesta vacía`);
    return text;
  }

  const endpoint =
    candidate.provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";

  const extraHeaders: Record<string, string> =
    candidate.provider === "openrouter"
      ? { "HTTP-Referer": "https://sigic.app", "X-Title": "SIGIC Agro-Pathfinder" }
      : {};

  const res = await fetchWithFastTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${candidate.apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: candidate.model,
      messages: buildOpenAiMessages(system, convo, imageDataUrl, candidate.supportsVision),
      max_tokens: maxTokens,
      temperature: 0.35,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`${candidate.provider}/${candidate.model} HTTP ${res.status}: ${errBody.slice(0, 180)}`);
  }

  const json = await res.json();
  const text = String(json.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error(`${candidate.provider}/${candidate.model} devolvió respuesta vacía`);
  return text;
}

function prepareSanitizedMessages(parsedData: ReturnType<typeof ChatPayloadSchema.parse>) {
  const clientSystemParts = parsedData.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content);
  const system = composeSafeSystemPrompt(clientSystemParts);
  // Limitar historial a los últimos 10 turnos para no saturar el límite de 8,000 tokens/min del plan gratuito
  const convo = parsedData.messages.filter((m) => m.role !== "system").slice(-10);
  if (convo.length === 0) {
    throw new Error("Debes enviar al menos una consulta del usuario.");
  }
  return { system, convo };
}

async function runSanitizedAiChat(parsedData: ReturnType<typeof ChatPayloadSchema.parse>): Promise<string> {
  const { system, convo } = prepareSanitizedMessages(parsedData);
  const candidates = buildFreeModelCascade({
    mode: parsedData.mode ?? "balanced",
    hasImage: Boolean(parsedData.imageDataUrl),
  });

  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      return await callCandidateJson(
        candidate,
        system,
        convo,
        parsedData.max_tokens,
        parsedData.imageDataUrl
      );
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(reason);
      console.warn(`[SIGIC AI Failover] ${candidate.provider}:${candidate.model} falló -> probando siguiente modelo gratis. Detalle: ${reason}`);
    }
  }

  console.error("[SIGIC AI Agotado]", errors.join(" | "));
  throw new Error(
    "Los modelos gratuitos configurados alcanzaron temporalmente su límite por minuto o no respondieron. Espera 15 segundos o agrega una clave gratuita de respaldo (GEMINI_API_KEY u OPENROUTER_API_KEY)."
  );
}

/** Genera un ReadableStream Server-Sent Events (SSE) con failover automático entre modelos gratuitos */
async function createAiSseStream(parsedData: ReturnType<typeof ChatPayloadSchema.parse>): Promise<ReadableStream<Uint8Array>> {
  const { system, convo } = prepareSanitizedMessages(parsedData);
  const candidates = buildFreeModelCascade({
    mode: parsedData.mode ?? "balanced",
    hasImage: Boolean(parsedData.imageDataUrl),
  });
  const encoder = new TextEncoder();

  for (const candidate of candidates) {
    try {
      if (candidate.provider === "gemini") {
        const text = await callCandidateJson(
          candidate,
          system,
          convo,
          parsedData.max_tokens,
          parsedData.imageDataUrl
        );
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: text, model: candidate.model })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, model: candidate.model })}\n\n`));
            controller.close();
          },
        });
      }

      const endpoint =
        candidate.provider === "openrouter"
          ? "https://openrouter.ai/api/v1/chat/completions"
          : "https://api.groq.com/openai/v1/chat/completions";

      const extraHeaders: Record<string, string> =
        candidate.provider === "openrouter"
          ? { "HTTP-Referer": "https://sigic.app", "X-Title": "SIGIC Agro-Pathfinder" }
          : {};

      const upstream = await fetchWithFastTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${candidate.apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: candidate.model,
          messages: buildOpenAiMessages(system, convo, parsedData.imageDataUrl, candidate.supportsVision),
          max_tokens: parsedData.max_tokens,
          temperature: 0.35,
          stream: true,
        }),
      });

      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => "");
        throw new Error(`${candidate.provider}/${candidate.model} HTTP ${upstream.status}: ${errText.slice(0, 160)}`);
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
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, model: candidate.model })}\n\n`));
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
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, model: candidate.model })}\n\n`));
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
                  // Ignorar fragmentos SSE incompletos
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
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[SIGIC SSE Failover] ${candidate.provider}:${candidate.model} falló -> siguiente modelo gratuito (${reason})`);
    }
  }

  throw new Error(
    "Los modelos gratuitos configurados están ocupados o alcanzaron su cuota por minuto. Reintenta en unos segundos."
  );
}

/** Server Function oficial consumida por widgets y respaldo RPC */
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

/** Endpoint HTTP directo (/api/chat y /api/chat/stream) con soporte dual JSON y Server-Sent Events */
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
    if (status === 429) extraHeaders["Retry-After"] = "60";
    return new Response(JSON.stringify({ error: msg }), { status, headers: extraHeaders });
  }
}

/** Transcripción de voz gratuita en servidor mediante Groq Whisper Large V3 Turbo (2,000 solicitudes/día gratis) */
export async function handleVoiceTranscribeHttpRequest(request: Request): Promise<Response> {
  try {
    assertAllowedOrigin(request.headers);
    await authenticateAndCheckQuota(request.headers);

    const groqKey = process.env.GROQ_API_KEY?.trim();
    if (!groqKey) {
      return new Response(
        JSON.stringify({ error: "Transcripción por servidor requiere GROQ_API_KEY gratuita." }),
        { status: 503, headers: { "content-type": "application/json; charset=utf-8" } },
      );
    }

    const incomingForm = await request.formData();
    const audio = incomingForm.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0 || audio.size > 4 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Archivo de audio inválido o mayor a 4 MB." }),
        { status: 400, headers: { "content-type": "application/json; charset=utf-8" } },
      );
    }

    const upstreamForm = new FormData();
    upstreamForm.append("file", audio, "consulta-campo.webm");
    upstreamForm.append("model", "whisper-large-v3-turbo");
    upstreamForm.append("language", "es");
    upstreamForm.append("response_format", "json");

    const res = await fetchWithFastTimeout(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: upstreamForm,
      },
      12_000
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Whisper HTTP ${res.status}: ${errBody.slice(0, 150)}`);
    }

    const json = await res.json();
    return new Response(
      JSON.stringify({ text: String(json.text ?? "").trim() }),
      { status: 200, headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } },
    );
  } catch (err: any) {
    const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error transcribiendo audio" }),
      { status, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }
}
