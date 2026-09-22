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
import { QrCode, Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function BatchQR({ cropId, parcelId }: { cropId: string; parcelId?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const batches = useQuery({
    queryKey: ["batches", cropId],
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("*").eq("crop_id", cropId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (input: { batch_code: string; harvest_date: string; qty: number; globalgap_cert: boolean }) => {
      const qrValue = `${window.location.origin}/trace/${input.batch_code}`;
      const { error } = await supabase.from("batches").insert({
        crop_id: cropId, ...input, qr_code: qrValue,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batches", cropId] }); setOpen(false); toast.success("Batch created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateCode = () => `LOTE-${cropId.slice(0, 6)}-${Date.now().toString(36).toUpperCase()}`;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <QrCode className="size-4 text-primary" />
          {t("traceability.title")}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" /> {t("traceability.create_batch")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("traceability.create_batch")}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); create.mutate({ batch_code: fd.get("batch_code") as string, harvest_date: fd.get("harvest_date") as string, qty: Number(fd.get("qty")), globalgap_cert: fd.get("globalgap") === "on" }); }} className="space-y-3">
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
              <DialogFooter><Button type="submit">{t("common.create")}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(batches.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("common.no_data")}</p>
      ) : (
        <div className="space-y-3">
          {(batches.data ?? []).map((b) => (
            <div key={b.id} className="flex items-start gap-4 p-3 rounded-lg border border-border">
              <div className="shrink-0">
                <QRCodeSVG value={b.qr_code || b.batch_code} size={80} level="M" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{b.batch_code}</span>
                  {b.globalgap_cert && <Badge className="text-xs bg-green-100 text-green-700">GLOBALG.A.P.</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(b.harvest_date + "T12:00:00").toLocaleDateString()} · {Number(b.qty).toFixed(1)} KG
                </p>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                    const svg = document.querySelector(`[data-code="${b.batch_code}"]`);
                    if (svg) { const s = new XMLSerializer().serializeToString(svg); const w = window.open(); w?.document.write(s); w?.print(); }
                  }}>
                    <Download className="size-3 mr-1" /> {t("traceability.print_qr")}
                  </Button>
                </div>
              </div>
              <div className="hidden"><QRCodeSVG value={b.qr_code || b.batch_code} size={80} level="M" data-code={b.batch_code} /></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
