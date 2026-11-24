import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Send, Square, User, Sparkles, AlertCircle, Leaf, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { chatWithGroq } from "@/lib/api/groq-chat.server";
import { MarkdownMessage, type ChatQuickAction } from "@/components/chat/markdown-message";
import { identifyClaritySession, trackClarityChatEvent } from "@/lib/analytics/clarity";

type Message = {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  isStreaming?: boolean;
  severity?: "optimo" | "preventivo" | "alto";
};

function inferSeverity(text: string): "optimo" | "preventivo" | "alto" | undefined {
  const lower = text.toLowerCase();
  if (/severa|urgente|alta toxicidad|cuarentena|pérdida total/.test(lower)) return "alto";
  if (/precaución|monitore|preventiv|dosis|aplicar/.test(lower)) return "preventivo";
  return undefined;
}

const QUICK_QUESTIONS = [
  "¿Cómo controlo la roya o manchas foliares con tabla de dosis?",
  "Plan paso a paso de fertilización nitrogenada por hectárea",
  "¿Cómo calcular la frecuencia de riego en época seca?",
  "¿Cómo saber si el suelo necesita cal agrícola?",
];

export function AiChat() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedParcelId, setSelectedParcelId] = useState<string>("__all__");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "¡Hola! Soy tu **Asistente Agronómico Inteligente**.\n\nSelecciona una parcela arriba o escribe tu consulta para recibir recomendaciones en tiempo real con **pasos numerados, tablas de dosis por hectárea y alertas de precaución en campo**.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const parcelsQuery = useQuery({
    queryKey: ["chat-parcels-context"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes.user) {
        identifyClaritySession({ userId: userRes.user.id, screenName: "chat" });
      }
      const { data } = await supabase
        .from("parcels")
        .select("id, name, area_m2, soil_types(name), crops(id, status, crop_catalog(name))")
        .limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 180;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const buildParcelContext = () => {
    const allParcels = parcelsQuery.data ?? [];
    const filtered =
      selectedParcelId === "__all__"
        ? allParcels.slice(0, 6)
        : allParcels.filter((p: any) => p.id === selectedParcelId);

    if (!filtered.length) return "";
    return filtered
      .map((p: any) => {
        const ha = (Number(p.area_m2) / 10000).toFixed(2);
        const soil = p.soil_types?.name || "suelo sin clasificar";
        const crops = Array.isArray(p.crops)
          ? p.crops
              .map((c: any) => `${c.crop_catalog?.name ?? "cultivo"} (${c.status})`)
              .filter(Boolean)
              .join(", ")
          : "";
        return `- Parcela "${p.name}" (${ha} ha, ${soil}): ${crops || "sin cultivos activos"}`;
      })
      .join("\n");
  };

  const handleQuickAction = (action: ChatQuickAction) => {
    trackClarityChatEvent("chat_quick_action_used");
    if (action.kind === "calendar") navigate({ to: "/calendar" });
    if (action.kind === "inventory") navigate({ to: "/inventory" });
  };

  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setMessages((prev) =>
      prev.map((m, idx) =>
        idx === prev.length - 1 && m.isStreaming
          ? { ...m, isStreaming: false, severity: inferSeverity(m.content) }
          : m
      )
    );
  };

  const streamViaSse = async (
    payload: {
      parcelId: string | null;
      messages: { role: "system" | "user" | "assistant"; content: string }[];
      max_tokens: number;
    },
    signal: AbortSignal,
    onDelta: (accumulated: string) => void
  ): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const response = await fetch("/api/chat/stream", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...payload, stream: true }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      if (errJson?.error) {
        throw new Error(String(errJson.error));
      }
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream") || !response.body) {
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        const event = JSON.parse(jsonStr) as { token?: string; done?: boolean; error?: string };
        if (event.error) throw new Error(event.error);
        if (typeof event.token === "string") {
          fullText += event.token;
          onDelta(fullText);
        }
        if (event.done) {
          return fullText;
        }
      }
    }

    return fullText || null;
  };

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend ?? input).trim();
    if (!messageContent || loading) return;

    trackClarityChatEvent("chat_prompt_sent");
    const userMsg: Message = { role: "user", content: messageContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLastUserMessage(messageContent);
    if (!textToSend) setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const parcelSummary = buildParcelContext();
      const apiMessages = [
        ...(parcelSummary ? [{ role: "system" as const, content: parcelSummary }] : []),
        ...newMessages
          .filter((m) => !m.isError)
          .slice(-14)
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
      ];

      const requestPayload = {
        parcelId: selectedParcelId === "__all__" ? null : selectedParcelId,
        messages: apiMessages,
        max_tokens: 1024,
      };

      let streamedAdded = false;
      const streamedReply = await streamViaSse(
        requestPayload,
        controller.signal,
        (partialText) => {
          if (!streamedAdded) {
            streamedAdded = true;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: partialText, isStreaming: true },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m, idx) =>
                idx === prev.length - 1 ? { ...m, content: partialText } : m
              )
            );
          }
        }
      ).catch((streamErr: any) => {
        if (streamErr?.name === "AbortError") throw streamErr;
        if (
          typeof streamErr?.message === "string" &&
          (streamErr.message.includes("RATE_LIMIT_EXCEEDED") ||
            streamErr.message.includes("AI_NOT_CONFIGURED") ||
            streamErr.message.includes("No autorizado"))
        ) {
          throw streamErr;
        }
        return null;
      });

      if (streamedReply !== null) {
        setMessages((prev) =>
          prev.map((m, idx) =>
            idx === prev.length - 1
              ? { ...m, content: streamedReply, isStreaming: false, severity: inferSeverity(streamedReply) }
              : m
          )
        );
      } else {
        // Respaldo automático vía Server Function RPC
        const reply = await chatWithGroq({ data: requestPayload });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, severity: inferSeverity(reply) },
        ]);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : e?.message || t("chat.error");
      if (msg.includes("RATE_LIMIT_EXCEEDED")) {
        trackClarityChatEvent("chat_rate_limited");
      } else {
        trackClarityChatEvent("chat_error_boundary");
      }

      if (msg.includes("AI_NOT_CONFIGURED")) {
        setMessages((prev) => [
          ...prev.filter((m) => !m.isStreaming),
          {
            role: "assistant",
            isError: true,
            content:
              "⚠️ **El asistente aún no está activado en este servidor.**\n\nSi eres administrador, define `GROQ_API_KEY` en las variables de entorno y reinicia el servicio.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev.filter((m) => !m.isStreaming),
          {
            role: "assistant",
            isError: true,
            content: `⚠️ ${msg.replace("RATE_LIMIT_EXCEEDED: ", "")}`,
          },
        ]);
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const quickActions: ChatQuickAction[] = [
    { id: "cal", label: "Agendar labor en Calendario", kind: "calendar" },
    { id: "inv", label: "Ver insumos en Inventario", kind: "inventory" },
  ];

  const isGeneratingStream = messages[messages.length - 1]?.isStreaming === true;

  return (
    <section
      data-testid="chat-screen"
      aria-label={t("chat.title")}
      className="flex h-[calc(100dvh-13.5rem)] min-h-[480px] sm:h-[640px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      {/* Cabecera responsiva con selector de parcela */}
      <div className="flex flex-col gap-2.5 border-b border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-bold text-primary">
            <Bot className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              Asistente Agronómico SIGIC
            </h2>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Leaf className="size-3 text-primary" aria-hidden="true" /> Respuestas en tiempo real por lote
            </p>
          </div>
        </div>

        <Select value={selectedParcelId} onValueChange={setSelectedParcelId}>
          <SelectTrigger
            aria-label="Seleccionar parcela para contexto agronómico"
            data-testid="chat-parcel-selector"
            className="h-10 w-full text-xs sm:w-[235px]"
          >
            <MapPin className="mr-1.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <SelectValue placeholder="Todas mis parcelas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs">Todas mis parcelas</SelectItem>
            {(parcelsQuery.data ?? []).map((p: any) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.name} ({(Number(p.area_m2) / 10000).toFixed(1)} ha)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Historial accesible con máscara de privacidad para Clarity */}
      <div
        ref={scrollContainerRef}
        data-testid="chat-messages-log"
        role="log"
        aria-live="polite"
        aria-busy={loading}
        data-clarity-mask="true"
        className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2.5 sm:gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="mt-0.5 hidden size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:grid">
                <Bot className="size-4" aria-hidden="true" />
              </div>
            )}
            <div
              className={`max-w-[94%] sm:max-w-[85%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-none bg-primary text-primary-foreground shadow-xs"
                  : m.isError
                    ? "rounded-bl-none border border-destructive/25 bg-destructive/10 text-destructive"
                    : "rounded-bl-none border border-border/60 bg-muted/70 text-foreground shadow-xs"
              }`}
            >
              {m.role === "assistant" && !m.isError ? (
                <MarkdownMessage
                  content={m.content}
                  severity={m.severity}
                  quickActions={i > 0 && !m.isStreaming ? quickActions : []}
                  onQuickAction={handleQuickAction}
                  compact={m.isStreaming}
                />
              ) : (
                <p className="whitespace-pre-line">{m.content}</p>
              )}
            </div>
            {m.role === "user" && (
              <div className="mt-0.5 hidden size-8 shrink-0 place-items-center rounded-full bg-primary/20 text-primary sm:grid">
                <User className="size-4" aria-hidden="true" />
              </div>
            )}
          </div>
        ))}

        {loading && !isGeneratingStream && (
          <div className="flex items-center gap-3" role="status">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Bot className="size-4 animate-spin" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-none border border-border/50 bg-muted/80 px-4 py-2.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 animate-pulse text-primary" aria-hidden="true" />
              {t("chat.analyzing")}
            </div>
          </div>
        )}
      </div>

      {/* Sugerencias rápidas desplazables en móvil */}
      {messages.length <= 2 && (
        <div className="border-t border-border/50 bg-muted/20 px-3 py-2">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Sparkles className="size-3 text-primary" aria-hidden="true" /> Consultas frecuentes:
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap">
            {QUICK_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                disabled={loading}
                className="min-h-9 shrink-0 rounded-full border border-border bg-card px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barra de entrada ergonómica (text-base evita auto-zoom en iOS; botón >= 44px) */}
      <div className="space-y-2 border-t border-border bg-card p-2.5 sm:p-3">
        {messages[messages.length - 1]?.isError && lastUserMessage && (
          <button
            type="button"
            onClick={() => {
              setMessages((prev) => prev.filter((_, i) => i !== prev.length - 1));
              handleSend(lastUserMessage);
            }}
            disabled={loading}
            className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning-text transition-colors hover:bg-warning/20"
          >
            <AlertCircle className="size-3.5" aria-hidden="true" />
            Reintentar consulta anterior
          </button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            data-testid="chat-input"
            aria-label={t("chat.placeholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            placeholder={t("chat.placeholder")}
            disabled={loading}
            className="min-h-11 flex-1 rounded-lg border border-border bg-background px-3.5 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          {loading ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleStopStreaming}
              aria-label="Detener generación de respuesta"
              data-testid="chat-stop-button"
              className="min-h-11 min-w-11 gap-1.5 px-3.5"
            >
              <Square className="size-3.5 fill-current" aria-hidden="true" />
              <span className="hidden sm:inline">Detener</span>
            </Button>
          ) : (
            <Button
              type="submit"
              data-testid="chat-send-button"
              aria-label="Enviar consulta agronómica"
              disabled={!input.trim()}
              className="min-h-11 min-w-11 gap-1.5 px-4 shadow-xs"
            >
              <Send className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Consultar</span>
            </Button>
          )}
        </form>
      </div>
    </section>
  );
}
