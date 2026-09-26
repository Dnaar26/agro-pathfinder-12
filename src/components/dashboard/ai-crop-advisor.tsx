import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { chatWithGroq } from "@/lib/api/groq-chat.server";
import { supabase } from "@/integrations/supabase/client";

export function AiCropAdvisor() {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextData = useQuery({
    queryKey: ["ai-dashboard-context"],
    queryFn: async () => {
      const [parcelsRes, cropsRes, alertsRes] = await Promise.all([
        supabase.from("parcels").select("name, area_m2, soil_types(name)"),
        supabase.from("crops").select("status, crop_catalog(name)").eq("status", "SEMBRADO"),
        supabase.from("alerts").select("message, kind").eq("status", "PENDIENTE").limit(3),
      ]);
      return {
        parcels: parcelsRes.data ?? [],
        crops: cropsRes.data ?? [],
        alerts: alertsRes.data ?? [],
      };
    },
  });

  const getSmartAdvice = async () => {
    setLoading(true);
    setError(null);

    const parcelsSummary = (contextData.data?.parcels ?? [])
      .map((p: any) => `${p.name} (${(Number(p.area_m2) / 10000).toFixed(1)} ha, suelo ${p.soil_types?.name ?? "estándar"})`)
      .join("; ");
    const cropsSummary = (contextData.data?.crops ?? [])
      .map((c: any) => c.crop_catalog?.name)
      .filter(Boolean)
      .join(", ");
    const alertsSummary = (contextData.data?.alerts ?? []).map((a: any) => a.message).join("; ");

    const prompt = `Como Agrónomo Experto de IA (SIGIC), genera 3 recomendaciones prácticas y específicas para el agricultor basado en este estado actual:
- Parcelas: ${parcelsSummary || "General"}
- Cultivos sembrados activos: ${cropsSummary || "Sin especificar"}
- Alertas o riesgos pendientes: ${alertsSummary || "Ninguna"}

Formatéalo en puntos breves y directos enfocados en optimización de agua, fertilización y prevención de plagas. Máximo 150 palabras en español.`;

    try {
      const reply = await chatWithGroq({
        data: {
          messages: [
            {
              role: "system",
              content: "Eres el Asistente Inteligente de Gestión Agrícola de SIGIC (Gemini AI). Da recomendaciones oportunas, profesionales y accionables.",
            },
            { role: "user", content: prompt },
          ],
          model: "gemini-2.5-flash",
          max_tokens: 350,
        },
      });
      setAdvice(reply);
    } catch (e: any) {
      const msg = e?.message ?? "Error al consultar la IA";
      setError(msg.includes("GEMINI_API_KEY") ? "El servicio de IA no está configurado en el servidor." : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-emerald-950/20 via-card to-card border-emerald-500/20 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center">
            <Sparkles className="size-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Recomendación Agronómica Inteligente
            </h3>
            <p className="text-[11px] text-muted-foreground">Potenciado por Gemini 3.6 AI</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={getSmartAdvice}
          disabled={loading || contextData.isLoading}
          className="h-8 text-xs gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : advice ? (
            <RefreshCw className="size-3.5" />
          ) : (
            <Bot className="size-3.5 text-emerald-600" />
          )}
          {loading ? "Analizando..." : advice ? "Reevaluar" : "Obtener diagnóstico"}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {advice && (
        <div className="p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-xs leading-relaxed text-foreground whitespace-pre-line">
          {advice}
        </div>
      )}

      {!advice && !error && !loading && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Haz clic en <strong>"Obtener diagnóstico"</strong> para recibir sugerencias inteligentes personalizadas para tu finca.
        </p>
      )}
    </Card>
  );
}
