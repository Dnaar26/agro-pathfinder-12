import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bot,
  Send,
  Square,
  User,
  Sparkles,
  AlertCircle,
  Leaf,
  MapPin,
  ImagePlus,
  Mic,
  MicOff,
  RotateCcw,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chatWithGroq } from "@/lib/api/groq-chat.server";
import { MarkdownMessage, type ChatQuickAction } from "@/components/chat/markdown-message";
import { identifyClaritySession, trackClarityChatEvent } from "@/lib/analytics/clarity";

type Message = {
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  isError?: boolean;
  isStreaming?: boolean;
  severity?: "optimo" | "preventivo" | "alto";
};

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "¡Hola! Soy tu **Copiloto Agronómico SIGIC**.\n\nPuedes escribir, **dictar por voz** o **subir la foto de una hoja** para recibir diagnósticos rápidos con **pasos numerados, tablas de dosis por hectárea y precauciones de campo**.",
};

function inferSeverity(text: string): "optimo" | "preventivo" | "alto" | undefined {
  const lower = text.toLowerCase();
  if (/severa|urgente|alta toxicidad|cuarentena|pérdida total/.test(lower)) return "alto";
  if (/precaución|monitore|preventiv|dosis|aplicar/.test(lower)) return "preventivo";
  return undefined;
}

/** Comprime una imagen en el navegador a JPEG ligero (máx 768px) para envío rápido en redes rurales */
async function compressLeafImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagen no soportado."));
      img.onload = () => {
        const maxDim = 768;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No fue posible procesar la imagen."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.76);
        resolve(compressed);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState("");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Carga enriquecida en una sola promesa paralela: parcelas + alertas activas + plagas abiertas
  const contextQuery = useQuery({
    queryKey: ["chat-enriched-context"],
    queryFn: async () => {
      const { data: sessionRes } = await supabase.auth.getSession();
      const userId = sessionRes.session?.user?.id;
      if (userId) {
        identifyClaritySession({ userId, screenName: "chat" });
      }

      const [parcelsRes, alertsRes, pestsRes] = await Promise.all([
        supabase
          .from("parcels")
          .select("id, name, area_m2, soil_types(name), crops(id, status, crop_catalog(name))")
          .limit(20),
        supabase
          .from("alerts")
          .select("title, kind")
          .eq("status", "PENDIENTE")
          .order("scheduled_at", { ascending: false })
          .limit(4),
        supabase
          .from("pest_incidents")
          .select("pest_name, severity, crops(crop_catalog(name), parcels(id, name))")
          .order("detected_at", { ascending: false })
          .limit(4),
      ]);

      return {
        userId: userId ?? null,
        parcels: parcelsRes.data ?? [],
        alerts: alertsRes.data ?? [],
        pests: pestsRes.data ?? [],
      };
    },
    staleTime: 60_000,
  });

  // Recuperar última conversación guardada en Supabase (si la tabla ai_conversations ya está migrada)
  useEffect(() => {
    let active = true;
    const loadSavedHistory = async () => {
      try {
        const { data: sessionRes } = await supabase.auth.getSession();
        if (!sessionRes.session?.user?.id) return;

        let convQuery = (supabase as any)
          .from("ai_conversations")
          .select("id")
          .order("updated_at", { ascending: false })
          .limit(1);

        if (selectedParcelId !== "__all__") {
          convQuery = convQuery.eq("parcel_id", selectedParcelId);
        } else {
          convQuery = convQuery.is("parcel_id", null);
        }

        const { data: convRows, error: convErr } = await convQuery;
        if (convErr || !active) return;

        const existingConvId = convRows?.[0]?.id as string | undefined;
        if (!existingConvId) {
          setConversationId(null);
          setMessages([WELCOME_MESSAGE]);
          return;
        }

        const { data: msgRows, error: msgErr } = await (supabase as any)
          .from("ai_messages")
          .select("role, content")
          .eq("conversation_id", existingConvId)
          .order("created_at", { ascending: true })
          .limit(20);

        if (!msgErr && active && Array.isArray(msgRows) && msgRows.length > 0) {
          setConversationId(existingConvId);
          setMessages([
            WELCOME_MESSAGE,
            ...msgRows.map((row: { role: "user" | "assistant"; content: string }) => ({
              role: row.role,
              content: row.content,
              severity: row.role === "assistant" ? inferSeverity(row.content) : undefined,
            })),
          ]);
        }
      } catch {
        // Si la migración aún no se aplicó en local, operar en memoria sin interrumpir
      }
    };

    void loadSavedHistory();
    return () => {
      active = false;
    };
  }, [selectedParcelId]);

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
      speechRecognitionRef.current?.stop?.();
      mediaRecorderRef.current?.stop?.();
    };
  }, []);

  const persistTurnInBackground = useCallback(
    async (userText: string, assistantText: string) => {
      try {
        const { data: sessionRes } = await supabase.auth.getSession();
        const userId = sessionRes.session?.user?.id;
        if (!userId || !assistantText.trim()) return;

        let activeConvId = conversationId;
        if (!activeConvId) {
          const { data: created, error: createErr } = await (supabase as any)
            .from("ai_conversations")
            .insert({
              user_id: userId,
              parcel_id: selectedParcelId === "__all__" ? null : selectedParcelId,
              title: userText.slice(0, 80),
            })
            .select("id")
            .single();
          if (createErr || !created?.id) return;
          activeConvId = created.id as string;
          setConversationId(activeConvId);
        } else {
          await (supabase as any)
            .from("ai_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", activeConvId);
        }

        await (supabase as any).from("ai_messages").insert([
          {
            conversation_id: activeConvId,
            user_id: userId,
            role: "user",
            content: userText.slice(0, 4000),
          },
          {
            conversation_id: activeConvId,
            user_id: userId,
            role: "assistant",
            content: assistantText.slice(0, 11500),
          },
        ]);
      } catch {
        // Ignorar silenciosamente si la tabla opcional no está creada aún
      }
    },
    [conversationId, selectedParcelId]
  );

  const handleStartNewConversation = () => {
    abortControllerRef.current?.abort();
    setConversationId(null);
    setAttachedImage(null);
    setMessages([WELCOME_MESSAGE]);
    setInput("");
  };

  const buildParcelContext = () => {
    const allParcels = contextQuery.data?.parcels ?? [];
    const alerts = contextQuery.data?.alerts ?? [];
    const pests = contextQuery.data?.pests ?? [];

    const filtered =
      selectedParcelId === "__all__"
        ? allParcels.slice(0, 5)
        : allParcels.filter((p: any) => p.id === selectedParcelId);

    const lines: string[] = [];
    if (filtered.length > 0) {
      lines.push(
        ...filtered.map((p: any) => {
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
      );
    }

    if (alerts.length > 0) {
      lines.push(
        `Alertas activas: ${alerts.map((a: any) => `${a.kind}: ${a.title}`).join(" | ")}`
      );
    }

    if (pests.length > 0) {
      lines.push(
        `Incidentes sanitarios recientes: ${pests
          .map((inc: any) => `${inc.pest_name} (${inc.severity})`)
          .join(" | ")}`
      );
    }

    return lines.join("\n");
  };

  const handleQuickAction = (action: ChatQuickAction) => {
    trackClarityChatEvent("chat_quick_action_used");
    if (action.kind === "calendar") navigate({ to: "/calendar" });
    if (action.kind === "inventory") navigate({ to: "/inventory" });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen válida (JPG, PNG o WebP).");
      return;
    }
    try {
      const dataUrl = await compressLeafImage(file);
      setAttachedImage(dataUrl);
      if (!input.trim()) {
        setInput("Analiza esta foto de hoja e indícame posible diagnóstico y manejo paso a paso.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al comprimir imagen.");
    }
  };

  const toggleVoiceDictation = async () => {
    if (recordingVoice) {
      speechRecognitionRef.current?.stop?.();
      mediaRecorderRef.current?.stop?.();
      setRecordingVoice(false);
      return;
    }

    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    // 1. Dictado nativo gratuito e instantáneo del navegador (Chrome, Edge, Android, Safari)
    if (SpeechRecognitionCtor) {
      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = "es-CO";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (ev: any) => {
          const transcript = ev?.results?.[0]?.[0]?.transcript ?? "";
          if (transcript) {
            setInput((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
          }
        };
        recognition.onerror = () => setRecordingVoice(false);
        recognition.onend = () => setRecordingVoice(false);
        speechRecognitionRef.current = recognition;
        setRecordingVoice(true);
        recognition.start();
        return;
      } catch {
        // Si falla la API nativa, usar respaldo Whisper gratuito en servidor
      }
    }

    // 2. Respaldo gratuito vía MediaRecorder -> Groq Whisper Large V3 Turbo
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = async () => {
          stream.getTracks().forEach((tr) => tr.stop());
          setRecordingVoice(false);
          const blob = new Blob(chunks, { type: "audio/webm" });
          if (blob.size === 0) return;
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            const fd = new FormData();
            fd.append("audio", blob, "dictado.webm");
            const res = await fetch("/api/chat/transcribe", {
              method: "POST",
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: fd,
            });
            const json = await res.json();
            if (res.ok && json?.text) {
              setInput((prev) => (prev ? `${prev.trim()} ${json.text}` : json.text));
            } else {
              toast.error(json?.error || "No fue posible transcribir el audio.");
            }
          } catch {
            toast.error("Error de red al transcribir el dictado.");
          }
        };
        mediaRecorderRef.current = recorder;
        setRecordingVoice(true);
        recorder.start();
        return;
      } catch {
        toast.error("Permiso de micrófono denegado o no disponible.");
      }
    } else {
      toast.error("El dictado por voz no está soportado en este navegador.");
    }
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
      imageDataUrl?: string | null;
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
    const imageToSend = textToSend ? null : attachedImage;
    const userMsg: Message = {
      role: "user",
      content: messageContent,
      imagePreview: imageToSend ?? undefined,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLastUserMessage(messageContent);
    if (!textToSend) {
      setInput("");
      setAttachedImage(null);
    }
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const parcelSummary = buildParcelContext();
      const apiMessages = [
        ...(parcelSummary ? [{ role: "system" as const, content: parcelSummary }] : []),
        ...newMessages
          .filter((m) => !m.isError)
          .slice(-10)
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
      ];

      const requestPayload = {
        parcelId: selectedParcelId === "__all__" ? null : selectedParcelId,
        messages: apiMessages,
        max_tokens: 800,
        mode: "balanced" as const,
        imageDataUrl: imageToSend,
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
        void persistTurnInBackground(messageContent, streamedReply);
      } else {
        const reply = await chatWithGroq({ data: requestPayload });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, severity: inferSeverity(reply) },
        ]);
        void persistTurnInBackground(messageContent, reply);
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
              "⚠️ **El asistente aún no tiene una clave gratuita configurada.**\n\nDefine `GROQ_API_KEY` (console.groq.com) o `GEMINI_API_KEY` (aistudio.google.com) en las variables de entorno del servidor.",
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
      {/* Cabecera responsiva con selector de parcela y botón de nueva consulta */}
      <div className="flex flex-col gap-2.5 border-b border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-bold text-primary">
              <Bot className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                Asistente Agronómico SIGIC
              </h2>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Leaf className="size-3 text-primary" aria-hidden="true" /> Multi-modelo rápido · Voz y foto de hoja
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleStartNewConversation}
            aria-label="Iniciar nueva consulta limpia"
            title="Iniciar nueva consulta"
            className="h-9 px-2.5 text-xs sm:hidden"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedParcelId} onValueChange={setSelectedParcelId}>
            <SelectTrigger
              aria-label="Seleccionar parcela para contexto agronómico"
              data-testid="chat-parcel-selector"
              className="h-10 w-full text-xs sm:w-[220px]"
            >
              <MapPin className="mr-1.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <SelectValue placeholder="Todas mis parcelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">Todas mis parcelas</SelectItem>
              {(contextQuery.data?.parcels ?? []).map((p: any) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name} ({(Number(p.area_m2) / 10000).toFixed(1)} ha)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStartNewConversation}
            aria-label="Iniciar nueva consulta limpia"
            title="Nueva consulta"
            className="hidden h-10 px-3 text-xs sm:inline-flex gap-1.5"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Nueva
          </Button>
        </div>
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
              {m.imagePreview && (
                <img
                  src={m.imagePreview}
                  alt="Muestra foliar adjunta"
                  className="mb-2 max-h-40 rounded-lg border border-white/20 object-cover"
                />
              )}
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

      {/* Barra de entrada ergonómica con adjunto fotográfico y dictado por voz */}
      <div className="space-y-2 border-t border-border bg-card p-2.5 sm:p-3">
        {attachedImage && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2">
            <div className="flex items-center gap-2 text-xs">
              <img src={attachedImage} alt="Vista previa de hoja" className="size-10 rounded object-cover" />
              <span className="font-medium text-foreground">Foto lista para diagnóstico foliar</span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              aria-label="Quitar foto adjunta"
              className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

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
          className="flex items-center gap-1.5 sm:gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            aria-label={t("chat.upload_photo")}
            onChange={handlePhotoSelect}
            className="hidden"
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            aria-label={t("chat.upload_photo")}
            title={t("chat.upload_photo")}
            className="min-h-11 min-w-11 shrink-0"
          >
            <ImagePlus className="size-4" aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant={recordingVoice ? "destructive" : "outline"}
            size="icon"
            disabled={loading}
            onClick={toggleVoiceDictation}
            aria-label={recordingVoice ? "Detener dictado por voz" : "Dictar consulta por voz"}
            title={recordingVoice ? "Detener dictado" : "Dictar por voz"}
            className="min-h-11 min-w-11 shrink-0"
          >
            {recordingVoice ? (
              <MicOff className="size-4 animate-pulse" aria-hidden="true" />
            ) : (
              <Mic className="size-4" aria-hidden="true" />
            )}
          </Button>

          <input
            data-testid="chat-input"
            aria-label={t("chat.placeholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            placeholder={recordingVoice ? "Escuchando tu voz…" : t("chat.placeholder")}
            disabled={loading}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
          />

          {loading ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleStopStreaming}
              aria-label="Detener generación de respuesta"
              data-testid="chat-stop-button"
              className="min-h-11 min-w-11 shrink-0 gap-1.5 px-3"
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
              className="min-h-11 min-w-11 shrink-0 gap-1.5 px-3.5 shadow-xs"
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
