import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Plus, Download, Award, Printer } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { exportTraceabilityCertificatePdf } from "@/lib/pdf-certificate";

export function BatchQR({ cropId, parcelId: _parcelId, canManage = false }: { cropId: string; parcelId?: string; canManage?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const batches = useQuery({
    queryKey: ["batches", cropId],
    queryFn: async () => {
      const { data } = await supabase
        .from("batches")
        .select("*")
        .eq("crop_id", cropId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const cropMeta = useQuery({
    queryKey: ["batch-crop-meta", cropId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("crops")
        .select("crop_catalog(name), parcels(name, profiles!owner_id(full_name))")
        .eq("id", cropId)
        .maybeSingle();
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (input: { batch_code: string; harvest_date: string; qty: number; globalgap_cert: boolean }) => {
      const qrValue = `${window.location.origin}/trace/${input.batch_code}`;
      const { error } = await supabase.from("batches").insert({
        crop_id: cropId,
        ...input,
        qr_code: qrValue,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches", cropId] });
      setOpen(false);
      toast.success("Lote de trazabilidad creado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateCode = () => `LOTE-${cropId.slice(0, 6)}-${Date.now().toString(36).toUpperCase()}`;

  const handleDownloadCertificate = async (b: any) => {
    try {
      const svg = document.querySelector(`svg[data-code="${b.batch_code}"]`) as SVGSVGElement | null;
      const verifyUrl = b.qr_code || `${window.location.origin}/trace/${b.batch_code}`;
      const producerName = cropMeta.data?.parcels?.profiles?.full_name || "Productor SIGIC";
      const parcelName = cropMeta.data?.parcels?.name || "Parcela registrada";
      const cropName = cropMeta.data?.crop_catalog?.name || "Cultivo certificado";

      await exportTraceabilityCertificatePdf({
        batchCode: b.batch_code,
        cropName,
        parcelName,
        farmName: `Unidad Productiva ${producerName}`,
        producerName,
        harvestDate: b.harvest_date ? new Date(b.harvest_date + "T12:00:00").toLocaleDateString("es-CO") : "—",
        quantityText: `${Number(b.qty).toFixed(1)} ${b.unit || "KG"}`,
        bpaApproved: Boolean(b.globalgap_cert),
        globalGapCertified: Boolean(b.globalgap_cert),
        qrSvgElement: svg,
        verifyUrl,
      });
      toast.success("Certificado oficial de trazabilidad descargado en PDF");
    } catch (err: any) {
      toast.error(err?.message ?? "Error al generar certificado PDF");
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <QrCode className="size-4 text-primary" />
          {t("traceability.title")}
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4 mr-1" /> {t("traceability.create_batch")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("traceability.create_batch")}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  create.mutate({
                    batch_code: fd.get("batch_code") as string,
                    harvest_date: fd.get("harvest_date") as string,
                    qty: Number(fd.get("qty")),
                    globalgap_cert: fd.get("globalgap") === "on",
                  });
                }}
                className="space-y-3"
              >
                <div className="space-y-2">
                  <Label>{t("traceability.batch_code")}</Label>
                  <Input name="batch_code" defaultValue={generateCode()} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("traceability.harvest_date")}</Label>
                    <Input name="harvest_date" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("traceability.qty")} (KG)</Label>
                    <Input name="qty" type="number" inputMode="decimal" step="any" required />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input name="globalgap" type="checkbox" className="rounded border-border" />
                  {t("traceability.globalgap")}
                </label>
                <DialogFooter>
                  <Button type="submit">{t("common.create")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(batches.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("common.no_data")}</p>
      ) : (
        <div className="space-y-3">
          {(batches.data ?? []).map((b) => (
            <div key={b.id} className="flex flex-col sm:flex-row sm:items-start gap-4 p-3.5 rounded-xl border border-border">
              <div className="shrink-0">
                <QRCodeSVG value={b.qr_code || b.batch_code} size={84} level="M" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm font-mono">{b.batch_code}</span>
                  {b.globalgap_cert && (
                    <Badge className="border-success/30 bg-success/10 text-xs text-success">
                      <Award className="size-3 mr-1" /> GLOBALG.A.P.
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(b.harvest_date + "T12:00:00").toLocaleDateString("es-CO")} · {Number(b.qty).toFixed(1)} KG
                </p>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs h-8 gap-1.5"
                    onClick={() => void handleDownloadCertificate(b)}
                  >
                    <Download className="size-3.5" /> Certificado PDF Oficial
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1"
                    onClick={() => {
                      const svg = document.querySelector(`[data-code="${b.batch_code}"]`);
                      if (svg) {
                        const s = new XMLSerializer().serializeToString(svg);
                        const w = window.open();
                        w?.document.write(s);
                        w?.print();
                      }
                    }}
                  >
                    <Printer className="size-3.5" /> {t("traceability.print_qr")}
                  </Button>
                </div>
              </div>
              <div className="hidden">
                <QRCodeSVG value={b.qr_code || b.batch_code} size={180} level="M" data-code={b.batch_code} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
