import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sprout, AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

function calculateHealth(crop: any, activities: any[], pests: any[], harvests: any[]) {
  let score = 70;

  const actCount = activities.length;
  if (actCount >= 10) score += 15;
  else if (actCount >= 5) score += 10;
  else if (actCount >= 2) score += 5;

  const recentActs = activities.filter((a: any) => {
    const days = (Date.now() - new Date(a.performed_at).getTime()) / 86400000;
    return days <= 14;
  }).length;
  if (recentActs >= 2) score += 10;
  else if (recentActs === 0) score -= 10;

  const severePests = pests.filter((p: any) => p.severity === "ALTA" || p.severity === "CRITICA").length;
  score -= severePests * 15;
  const mildPests = pests.filter((p: any) => p.severity === "MEDIA").length;
  score -= mildPests * 8;

  if (harvests.length > 0) score += 10;

  if (crop.status === "FINALIZADO") score = -1;
  if (crop.status === "COSECHA") score = Math.min(score + 5, 100);
  if (crop.status === "PLANEADO" && actCount === 0) score = 50;

  return Math.max(0, Math.min(100, score));
}

function healthColor(score: number): string {
  if (score < 0) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function healthBg(score: number): string {
  if (score < 0) return "bg-muted";
  if (score >= 80) return "bg-green-100 dark:bg-green-950/30";
  if (score >= 50) return "bg-amber-100 dark:bg-amber-950/30";
  return "bg-red-100 dark:bg-red-950/30";
}

function healthLabel(score: number): string {
  if (score < 0) return "Finalizado";
  if (score >= 80) return "Saludable";
  if (score >= 50) return "Regular";
  return "En riesgo";
}

export function CropHealthWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["crop-health"],
    queryFn: async () => {
      const { data: crops } = await supabase
        .from("crops")
        .select("id, parcel_id, catalog_id, status, planting_date, crop_catalog(name), parcels(name)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (!crops) return [];

      const result = [];
      for (const crop of crops) {
        const [acts, pests, harvests] = await Promise.all([
          supabase.from("activities").select("id, performed_at").eq("crop_id", crop.id),
          supabase.from("pest_incidents").select("id, severity").eq("crop_id", crop.id),
          supabase.from("crop_harvests").select("id").eq("crop_id", crop.id),
        ]);
        const score = calculateHealth(crop, acts.data ?? [], pests.data ?? [], harvests.data ?? []);
        result.push({ ...crop, score, actCount: (acts.data ?? []).length, pestCount: (pests.data ?? []).length });
      }
      return result;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground bg-card rounded-lg border border-border/50">
        Cargando estado de salud de cultivos...
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground bg-card rounded-lg border border-border/50">
        No hay cultivos activos registrados para evaluar salud.
      </div>
    );
  }

  return (
    <div className="space-y-2">

      {data.map((c: any) => (
        <div key={c.id} className={cn("flex items-center gap-3 p-3 rounded-lg border border-border", healthBg(c.score))}>
          <div className="size-8 rounded-full grid place-items-center bg-background">
            {c.score >= 80 ? <CheckCircle2 className="size-4 text-green-600" /> :
             c.score >= 50 ? <Sprout className="size-4 text-amber-600" /> :
             c.score < 0 ? <Sprout className="size-4 text-muted-foreground" /> :
             <AlertTriangle className="size-4 text-red-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {(c as any).crop_catalog?.name ?? "—"} — {(c as any).parcels?.name ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {c.actCount} actividades · {c.pestCount} plagas · {c.status}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={cn("text-lg font-bold", healthColor(c.score))}>
              {c.score < 0 ? "—" : c.score}
            </p>
            <p className={cn("text-[10px]", healthColor(c.score))}>{healthLabel(c.score)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
