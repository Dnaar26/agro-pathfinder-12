import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { chatWithGroq } from "@/lib/api/groq-chat.server";
import { supabase } from "@/integrations/supabase/client";

function getAdviceErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("AI_NOT_CONFIGURED")) {
    return "El servicio de recomendaciones no está configurado. Avisa al administrador.";
  }
  if (/límite de solicitudes/i.test(message)) {
    return "Se alcanzó el límite temporal de consultas. Espera un momento y vuelve a intentarlo.";
  }
  if (/credencial/i.test(message)) {
    return "El servicio de recomendaciones necesita atención del administrador.";
  }
  if (/tardó demasiado|no está disponible/i.test(message)) {
    return "El servicio de recomendaciones está tardando o no está disponible. Inténtalo de nuevo en unos segundos.";
  }
  if (/401|403|unauthorized|sesión|session/i.test(message)) {
    return "Tu sesión no está disponible. Inicia sesión de nuevo e inténtalo.";
  }

  // Evita mostrar al usuario páginas HTML de proxy/Render u otros detalles internos.
  return "No fue posible obtener recomendaciones ahora. Revisa tu conexión e inténtalo de nuevo.";
}

export function AiCropAdvisor() {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextData = useQuery({
    queryKey: ["ai-dashboard-context"],
    queryFn: async () => {
      const [parcelsRes, cropsRes, alertsRes] = await Promise.all([
        supabase.from("parcels").select("name, area_m2, soil_types(name)").limit(20),
        supabase
          .from("crops")
          .select("status, crop_catalog(name)")
          .in("status", ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"])
          .limit(20),
        supabase
          .from("alerts")
          .select("title, body, kind")
          .eq("status", "PENDIENTE")
          .order("scheduled_at", { ascending: false })
          .limit(3),
      ]);

      const queryError = parcelsRes.error ?? cropsRes.error ?? alertsRes.error;
      if (queryError) throw queryError;

      return {
        parcels: parcelsRes.data ?? [],
        crops: cropsRes.data ?? [],
        alerts: alertsRes.data ?? [],
      };
    },
  });

  const hasContext = Boolean(
    contextData.data &&
      (contextData.data.parcels.length > 0 || contextData.data.crops.length > 0),
  );

  const getSmartAdvice = async () => {
    const data = contextData.data;
    if (!data || !hasContext) return;

    setLoading(true);
    setError(null);

    const parcelsSummary = data.parcels
      .map((parcel) => `${parcel.name} (${(Number(parcel.area_m2) / 10000).toFixed(1)} ha, suelo ${parcel.soil_types?.name ?? "no especificado"})`)
      .join("; ")
      .slice(0, 1200);
    const cropsSummary = data.crops
      .map((crop) => crop.crop_catalog?.name)
      .filter(Boolean)
      .join(", ")
      .slice(0, 1000);
    const alertsSummary = data.alerts
      .map((alert) => [alert.title, alert.body].filter(Boolean).join(": "))
      .join("; ")
      .slice(0, 800);

    const prompt = `Como agrónomo de SIGIC, genera 3 recomendaciones prácticas y específicas usando solo este estado actual; no supongas datos que no aparecen:
- Parcelas: ${parcelsSummary || "No hay parcelas registradas"}
- Cultivos activos (sembrado, crecimiento o mantenimiento): ${cropsSummary || "No hay cultivos activos"}
- Alertas o riesgos pendientes: ${alertsSummary || "Ninguna"}

Incluye acciones pertinentes para agua, fertilización y prevención de plagas según los datos disponibles. Si falta información para alguna recomendación, indícalo brevemente. Formatea en puntos breves, máximo 150 palabras y en español.`;

    try {
      const reply = await chatWithGroq({
        data: {
          messages: [
            {
              role: "system",
              content: "Eres el Asistente Inteligente de Gestión Agrícola de SIGIC. Da recomendaciones oportunas, profesionales y accionables, basadas en el contexto proporcionado.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 350,
        },
      });
      setAdvice(reply);
    } catch (e) {
      setError(getAdviceErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-3 border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Recomendación Agronómica Inteligente
            </h3>
            <p className="text-xs text-muted-foreground">Basado en tus parcelas y cultivos</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={getSmartAdvice}
          disabled={loading || contextData.isLoading || contextData.isError || !hasContext}
          className="h-8 text-xs gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : advice ? (
            <RefreshCw className="size-3.5" />
          ) : (
            <Bot className="size-3.5 text-primary" />
          )}
          {loading ? "Analizando..." : advice ? "Reevaluar" : "Obtener diagnóstico"}
        </Button>
      </div>

      {contextData.isError && (
        <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive" role="alert">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>No se pudieron cargar tus parcelas y cultivos. Revisa tu conexión e inténtalo de nuevo.</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => contextData.refetch()}
            disabled={contextData.isFetching}
            className="mt-2 h-7 px-2 text-xs"
          >
            {contextData.isFetching ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : <RefreshCw className="mr-1.5 size-3" />}
            Reintentar carga
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive" role="alert">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {advice && (
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3.5 text-xs leading-relaxed text-foreground whitespace-pre-line">
          {advice}
        </div>
      )}

      {!contextData.isLoading && !contextData.isError && !hasContext && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Registra una parcela o un cultivo activo para recibir recomendaciones personalizadas.
        </p>
      )}

      {!advice && !error && !loading && !contextData.isLoading && hasContext && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Haz clic en <strong>"Obtener diagnóstico"</strong> para recibir sugerencias inteligentes personalizadas para tu finca.
        </p>
      )}
    </Card>
  );
}
