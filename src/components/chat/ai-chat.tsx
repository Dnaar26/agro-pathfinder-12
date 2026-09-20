import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, Send, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chatWithGroq } from "@/lib/api/groq-chat.server";

type Message = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = "Eres un asistente agronómico experto. Responde preguntas sobre cultivos, plagas, enfermedades, fertilización, riego y prácticas agrícolas. Responde en español de forma clara y breve.";

function getUserParcelContext(parcels: any[]) {
  if (!parcels.length) return "";
  const summary = parcels.slice(0, 5).map((p: any) => {
    const crops = p.crops ?? [];
    const cropNames = Array.isArray(crops) ? crops.map((c: any) => c.crop_catalog?.name ?? c.crop_type ?? "").filter(Boolean).join(", ") : "";
    return `- Parcela "${p.name}" (${(Number(p.area_m2) / 10000).toFixed(2)} ha): ${cropNames || "sin cultivos"}`;
  }).join("\n");
  return `\n\nContexto del usuario:\n${summary}\n\nUsa este contexto para responder preguntas sobre sus parcelas.`;
}

export function AiChat() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "¡Hola! Soy tu asistente agronómico. Pregúntame sobre plagas, enfermedades, fertilización y prácticas agrícolas." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data: parcels } = await supabase.from("parcels").select("id, name, area_m2, crops:crops(id, crop_type)");
      const context = getUserParcelContext(parcels ?? []);
      const apiMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT + context },
        ...newMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      const reply = await chatWithGroq({ data: { messages: apiMessages } });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      if (msg.includes("GROQ_API_KEY no configurada")) {
        setMessages((prev) => [...prev, { role: "assistant", content: "El asistente IA no está disponible. Contacta al administrador para configurar la API key en el servidor." }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[500px] border border-border rounded-lg bg-card">
      <div className="p-3 border-b border-border flex items-center gap-2 text-sm font-medium">
        <Bot className="size-4 text-primary" />
        Asistente agronómico <span className="text-xs text-muted-foreground">(Groq)</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && <div className="size-7 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0"><Bot className="size-4" /></div>}
            <div className={`max-w-[80%] p-3 rounded-xl text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m.content}
            </div>
            {m.role === "user" && <div className="size-7 rounded-full bg-muted grid place-items-center shrink-0"><User className="size-4" /></div>}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="size-7 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0"><Bot className="size-4" /></div>
            <div className="bg-muted p-3 rounded-xl text-sm">{t("chat.analyzing")}</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre cultivos, plagas, fertilización..."
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={loading}
            className="flex-1 px-3 py-1.5 text-sm border border-border rounded-md bg-background"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
