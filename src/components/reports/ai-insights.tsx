import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Lightbulb, Loader2, AlertCircle } from "lucide-react";
import { chatWithGroq } from "@/lib/api/groq-chat.server";

interface AiInsightsProps {
  activities: any[];
  parcels: any[];
  totalCost: number;
  totalRevenue: number;
  pendingAlerts: number;
  costsByKind: Record<string, number>;
  byKind: Record<string, number>;
}

export function AiReportInsights({ activities, parcels, totalCost, totalRevenue, pendingAlerts, costsByKind, byKind }: AiInsightsProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    setInsight(null);

    const margin = totalRevenue - totalCost;
    const marginPct = totalCost > 0 ? ((margin / totalCost) * 100).toFixed(1) : "0";
    const topCost = Object.entries(costsByKind).sort(([, a], [, b]) => b - a).slice(0, 3);
    const topActivity = Object.entries(byKind).sort(([, a], [, b]) => b - a).slice(0, 3);
    const totalActivities = activities.length;

    const dataSummary = `
Resumen de datos del sistema SIGIC:
- Parcelas registradas: ${parcels.length}
- Actividades totales en el periodo: ${totalActivities}
- Costo total: $ ${totalCost.toFixed(2)}
- Ingreso total: $ ${totalRevenue.toFixed(2)}
- Margen bruto: $ ${margin.toFixed(2)} (${marginPct}%)
- Alertas pendientes: ${pendingAlerts}
- Top 3 costos por tipo: ${topCost.map(([k, v]) => `${k} ($ ${v.toFixed(0)})`).join(", ")}
- Top 3 actividades: ${topActivity.map(([k, v]) => `${k} (${v} veces)`).join(", ")}
`;

    try {
      const reply = await chatWithGroq({
        data: {
          messages: [
            {
              role: "system",
              content: "Eres un analista agronómico experto. Dado un resumen de datos agrícolas, genera un análisis breve (máximo 4 párrafos) en español con: 1) diagnóstico rápido de la situación, 2) oportunidades de mejora, 3) riesgos identificados, 4) recomendaciones accionables. Sé concreto y práctico para pequeños agricultores.",
            },
            { role: "user", content: dataSummary },
          ],
          model: "gemini-3.6-flash",
          max_tokens: 600,
        },
      });
      setInsight(reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      if (msg.includes("GEMINI_API_KEY no configurada") || msg.includes("GROQ_API_KEY no configurada")) {
        setError("⚠️ El módulo de Análisis IA no se encuentra disponible en este momento. Comunícate con el administrador del sistema para verificar la configuración del servidor.");
      } else {
        setError(`Error: ${msg}`);
      }
    }
    setLoading(false);
  };

  return (
    <section className="p-5 rounded-xl border border-border bg-card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="size-4 text-primary" /> Insights IA
        </h2>
        <Button variant="outline" size="sm" onClick={generateInsights} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Lightbulb className="size-3.5 mr-1" />}
          {loading ? "Analizando..." : "Generar análisis"}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {insight && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-sm leading-relaxed whitespace-pre-line">
          {insight}
        </div>
      )}

      {!insight && !error && (
        <p className="text-sm text-muted-foreground text-center py-3">
          Presioná "Generar análisis" para obtener recomendaciones inteligentes basadas en tus datos.
        </p>
      )}
    </section>
  );
}
