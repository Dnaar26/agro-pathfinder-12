import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { supabase } from "@/integrations/supabase/client";
import { listParcels } from "@/lib/queries";
import { deleteParcelCascade } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { MapPin, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { ParcelMap } from "@/components/map/parcel-map";
const EMPTY_PARCELS: Awaited<ReturnType<typeof listParcels>> = [];

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => ({ meta: [{ title: "Mapa — SIGIC" }] }),
  component: MapaPage,
});

function MapaPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const parcels = useQuery({ queryKey: ["parcels"], queryFn: listParcels });
  const [selectedId, setSelectedId] = useState<string>("__all__");
  const [pending, setPending] = useState<{ parcelId: string; geometry: any; area: number } | null>(null);
  const [cardPage, setCardPage] = useState(1);
  const [parcelToDelete, setParcelToDelete] = useState<{ id: string; name: string } | null>(null);
  const cardPageSize = 12;

  const parcelRows = parcels.data ?? EMPTY_PARCELS;
  const selected = useMemo(
    () => selectedId === "__all__" ? null : parcelRows.find((p) => p.id === selectedId) ?? null,
    [parcelRows, selectedId],
  );
  const displayParcels = useMemo(() => selected ? [selected] : parcelRows, [parcelRows, selected]);
  const showAll = selectedId === "__all__" || !selected;
  const cardList = displayParcels;
  const cardTotalPages = Math.max(1, Math.ceil(cardList.length / cardPageSize));
  const paginatedCards = useMemo(() => cardList.slice((cardPage - 1) * cardPageSize, cardPage * cardPageSize), [cardList, cardPage]);

  useEffect(() => {
    setCardPage(1);
  }, [selectedId, parcels.data]);

  const saveGeometry = useMutation({
    mutationFn: async ({ id, geometry, area }: { id: string; geometry: any; area: number }) => {
      const { error } = await supabase.from("parcels").update({ geometry: JSON.stringify(geometry), polygon_area_m2: area }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["parcels"] }); toast.success("Geometría guardada"); setPending(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteParcel = useMutation({
    mutationFn: deleteParcelCascade,
    onSuccess: () => {
      toast.success("Parcela y cultivos eliminados");
      setParcelToDelete(null);
      setSelectedId("__all__");
      qc.invalidateQueries({ queryKey: ["parcels"] });
      qc.invalidateQueries({ queryKey: ["crops"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handlePolygonCreated = useCallback((geo: any, area: number) => {
    if (!selected) { toast.error("Selecciona una parcela primero"); return; }
    setPending({ parcelId: selected.id, geometry: geo, area });
  }, [selected]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("parcels.map_view")}</h1>
          <p className="text-sm text-muted-foreground">Dibuja polígonos sobre tus parcelas para calcular área real</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setPending(null); }}>
            <SelectTrigger className="min-w-[200px] max-w-[320px]">
              <SelectValue placeholder="Seleccionar parcela…" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="__all__" className="text-muted-foreground">Todas las parcelas</SelectItem>
              {(parcels.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id} className="truncate">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pending && selected && (
            <Button onClick={() => saveGeometry.mutate({ id: selected.id, geometry: pending.geometry, area: pending.area })} disabled={saveGeometry.isPending}>
              <Save className="size-4 mr-1" /> Guardar ({pending.area.toFixed(0)} m²)
            </Button>
          )}
        </div>
      </header>

      <Suspense fallback={<div className="h-[400px] rounded-xl bg-muted animate-pulse" />}>
        <ParcelMap parcels={displayParcels} onPolygonCreated={handlePolygonCreated} editGeometry={pending?.geometry} onDeleteParcel={setParcelToDelete} />
      </Suspense>

      <AlertDialog open={!!parcelToDelete} onOpenChange={(open) => !open && setParcelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar parcela</AlertDialogTitle><AlertDialogDescription>Se eliminarán “{parcelToDelete?.name}” y todos sus cultivos y dependencias. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteParcel.isPending} onClick={(event) => { event.preventDefault(); if (parcelToDelete) deleteParcel.mutate(parcelToDelete.id); }}>{deleteParcel.isPending ? "Eliminando…" : "Eliminar"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {paginatedCards.map((p) => (
          <div key={p.id} className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="size-4 text-primary shrink-0" />
              <span className="truncate">{p.name}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(Number(p.polygon_area_m2 || p.area_m2) / 10000).toFixed(2)} ha · {Number(p.area_m2).toFixed(0)} m²
            </p>
            {p.geometry && <span className="text-xs text-green-600">✓ Polígono</span>}
          </div>
        ))}
      </div>
      {showAll && displayParcels.length > cardPageSize && <PaginationBar page={cardPage} totalPages={cardTotalPages} onPageChange={setCardPage} />}
    </div>
  );
}
