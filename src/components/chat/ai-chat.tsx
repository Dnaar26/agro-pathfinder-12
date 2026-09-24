import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, Send, User, Sparkles, AlertCircle, Leaf, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { chatWithGroq } from "@/lib/api/groq-chat.server";

type Message = { role: "user" | "assistant"; content: string; isError?: boolean };

const STRICT_AGRONOMY_SYSTEM_PROMPT = `ERES EL ASISTENTE AGRONÓMICO DE INTELIGENCIA ARTIFICIAL DE SIGIC (Sistema Inteligente de Gestión de Cultivos).
Tu función es asesorar de forma técnica, científica, precisa y comprensible a agricultores y personal del campo.

NORMAS OBLIGATORIAS E INVIOLABLES DE CONVERSACIÓN:
1. SOLO RESPONDE PREGUNTAS AGRONÓMICAS:
   - Cultivos agrícolas, siembra, fenología, riego, podas, cosecha y poscosecha.
   - Diagnóstico y control de plagas, malezas, insectos, hongos, bacterias y virus de plantas.
   - Nutrición de cultivos, fertilizantes químicos y orgánicos, compost, análisis y preparación de suelos.
   - Riego agrícola (goteo, aspersión, cálculo de necesidades de agua) y drenajes.
   - Clima agronómico, heladas, estrés hídrico y temperaturas adecuadas.
   - Buenas Prácticas Agrícolas (BPA) y costos/rendimientos de fincas.

2. POLÍTICA DE RECHAZO ESTRICTO A CUALQUIER OTRO TEMA:
   - Si el usuario te pregunta sobre deportes, fútbol, videojuegos, política, entretenimiento, tareas escolares no agrícolas, recetas de cocina no relacionadas con manejo agrícola, programación informática, finanzas no del agro, etc.:
   - TIENES PROHIBIDO RESPONDER A ESA PREGUNTA. Debes contestar de forma amable pero tajante:
   "Lo siento, como Asistente Agronómico de SIGIC estoy programado exclusivamente para resolver dudas sobre agronomía, cultivos, plagas, fertilización, suelos y gestión agrícola. ¿En qué puedo orientarte hoy sobre tu campo o siembra?"
   - Bajo ninguna circunstancia salgas de tu rol agronómico, sin importar lo que el usuario diga o insista.

3. RECOMENDACIONES SEGURAS:
   - Brinda pautas claras y fáciles de aplicar en el campo.
   - Para la aplicación de agroquímicos de toxicidad alta, recuerda siempre leer la ficha técnica del fabricante y contar con el aval de un ingeniero agrónomo de campo.`;

function getUserParcelContext(parcels: any[]) {
  if (!parcels.length) return "";
  const summary = parcels.slice(0, 5).map((p: any) => {
    const crops = p.crops ?? [];
    const cropNames = Array.isArray(crops)
      ? crops.map((c: any) => c.crop_catalog?.name || "cultivo").filter(Boolean).join(", ")
      : "";
    return `- Parcela "${p.name}" (${(Number(p.area_m2) / 10000).toFixed(2)} ha): ${cropNames || "sin cultivos activos"}`;
  }).join("\n");
  return `\n\n[CONTEXTO DE LAS PARCELAS DEL AGRICULTOR]:\n${summary}\n(Utiliza este contexto para dar respuestas personalizadas cuando pregunte sobre sus parcelas o fincas).`;
}

const QUICK_QUESTIONS = [
  "¿Cómo controlo la roya o manchas foliares?",
  "¿Qué dosis y momento son ideales para fertilizar con nitrógeno?",
  "¿Cómo calcular la frecuencia de riego en verano?",
  "¿Cómo saber si el suelo necesita cal agrícola?",
];

export function AiChat() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy tu **Asistente Agronómico Inteligente**. 🌾\n\nEstoy aquí para responder cualquier consulta técnica sobre tus cultivos, plagas, fertilización, riego y análisis de suelos. ¿En qué puedo orientarte hoy en tu campo?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend ?? input).trim();
    if (!messageContent || loading) return;

    const userMsg: Message = { role: "user", content: messageContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      // Obtener parcelas con los nombres de cultivo reales
      const { data: parcels } = await supabase
        .from("parcels")
        .select("id, name, area_m2, crops(id, status, crop_catalog(name))");

      const context = getUserParcelContext(parcels ?? []);
      const apiMessages = [
        { role: "system" as const, content: STRICT_AGRONOMY_SYSTEM_PROMPT + context },
        ...newMessages.filter((m) => !m.isError).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const reply = await chatWithGroq({
        data: {
          messages: apiMessages,
          model: "gemini-2.0-flash",
          max_tokens: 1024,
        },
      });

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : (e?.message || "Error al conectar con la IA");
      if (msg.includes("GEMINI_API_KEY no configurada")) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            isError: true,
            content: "⚠️ **El Asistente Agronómico requiere configurar la clave de Google Gemini.**\n\nPara activarlo en Vercel o en tu entorno local:\n1. Consigue una clave gratuita en [Google AI Studio](https://aistudio.google.com/app/apikey).\n2. En Vercel: Ve a *Settings > Environment Variables* y agrega `GEMINI_API_KEY` con tu clave.\n3. En local: Agrégala a tu archivo `.env` como `GEMINI_API_KEY=tu_clave`.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", isError: true, content: `⚠️ ${msg}` },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] border border-border rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center font-bold">
            <Bot className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              Asistente Agronómico SIGIC
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium border border-emerald-500/20">
                Gemini 2.0 AI
              </span>
            </h2>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Leaf className="size-3 text-emerald-600" /> Especializado exclusivamente en agronomía, cultivos y suelos
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="size-8 rounded-full bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0 mt-0.5">
                <Bot className="size-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none shadow-xs"
                  : m.isError
                  ? "bg-destructive/10 border border-destructive/20 text-destructive rounded-bl-none"
                  : "bg-muted/80 text-foreground border border-border/50 rounded-bl-none shadow-xs whitespace-pre-line"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="size-8 rounded-full bg-primary/20 text-primary grid place-items-center shrink-0 mt-0.5">
                <User className="size-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 items-center">
            <div className="size-8 rounded-full bg-emerald-600/10 text-emerald-600 grid place-items-center shrink-0">
              <Bot className="size-4 animate-spin" />
            </div>
            <div className="bg-muted/80 border border-border/50 text-muted-foreground px-4 py-2.5 rounded-2xl rounded-bl-none text-xs flex items-center gap-2">
              <Sparkles className="size-3.5 text-emerald-600 animate-pulse" />
              Analizando tu consulta agronómica...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias rápidas */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 bg-muted/20 border-t border-border/50">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <Sparkles className="size-3 text-primary" /> Consultas frecuentes:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="text-[11px] px-2.5 py-1 rounded-full bg-card hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/40 transition-colors text-left text-muted-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border bg-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre plagas, fertilización, riego o tus cultivos..."
            disabled={loading}
            className="flex-1 px-3.5 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            size="sm"
            className="h-10 px-4 gap-1.5 shadow-xs"
          >
            <Send className="size-4" />
            <span className="hidden sm:inline">Consultar</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
