import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Calendar, Scale, Scan, X } from "lucide-react";
import { LogoIcon } from "@/components/logo";
import jsQR from "jsqr";

export const Route = createFileRoute("/trace/$code")({
  head: () => ({ meta: [{ title: "Trazabilidad — SIGIC" }] }),
  component: TracePage,
});

function TracePage() {
  const { code } = useParams({ from: "/trace/$code" });
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scannerError, setScannerError] = useState("");

  const stopScan = useCallback(() => {
    scanningRef.current = false;
    setScanning(false);
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !scanningRef.current) return;
    const video = videoRef.current;
    if (video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
      scanTimerRef.current = setTimeout(scanFrame, 500);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const qr = jsQR(imageData.data, imageData.width, imageData.height);
    if (qr) {
      stopScan();
      const url = new URL(qr.data, window.location.origin);
      const match = url.pathname.match(/^\/trace\/(.+)$/);
      if (match?.[1]) navigate({ to: "/trace/$code", params: { code: decodeURIComponent(match[1]) }, replace: true });
      else setScannerError(`Código escaneado: ${qr.data.substring(0, 50)}...`);
    } else {
      scanTimerRef.current = setTimeout(scanFrame, 500);
    }
  }, [navigate, stopScan]);

  const startScan = useCallback(async () => {
    setScannerError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      scanningRef.current = true;
      setScanning(true);
      scanTimerRef.current = setTimeout(scanFrame, 100);
    } catch {
      setScannerError("Cámara no disponible. Verifica los permisos.");
    }
  }, [scanFrame]);

  useEffect(() => () => stopScan(), [stopScan]);

  const { data, isLoading } = useQuery({
    queryKey: ["trace", code],
    queryFn: async () => {
      const { data: batch } = await supabase.from("batches").select("*, crops(*, crop_catalog(*), parcels(*, profiles(full_name)))").eq("batch_code", code).maybeSingle();
      return batch as any;
    },
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Cargando información del lote…</p></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Card className="p-8 text-center"><p className="text-muted-foreground">Lote no encontrado o código inválido.</p></Card></div>;

  const crop = data.crops;
  const catalog = crop?.crop_catalog;
  const parcel = crop?.parcels;
  const farmer = parcel?.profiles;

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex items-center justify-center relative">
      {/* QR Scanner */}
      {scanning && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <button onClick={stopScan} className="absolute top-4 right-4 z-10 text-white"><X className="size-6" /></button>
          <video ref={videoRef} autoPlay playsInline className="max-w-full max-h-full object-contain" />
          <div className="absolute bottom-8 text-white text-sm">Enfoca un código QR de trazabilidad</div>
        </div>
      )}

      <Card className="max-w-lg w-full p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoIcon size="sm" />
            <h1 className="text-lg font-bold">Trazabilidad SIGIC</h1>
          </div>
          <div className="flex items-center gap-2">
            {!scanning && <Button variant="outline" size="icon" className="size-8" onClick={startScan} title="Escanear QR"><Scan className="size-4" /></Button>}
            <QRCodeSVG value={window.location.href} size={60} level="M" />
          </div>
        </div>
        {scannerError && <p className="text-sm text-destructive">{scannerError}</p>}

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Lote</p>
          <p className="text-xl font-bold font-mono">{data.batch_code}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="size-3" /> Cosecha</p>
            <p className="font-medium">{data.harvest_date ? new Date(data.harvest_date + "T12:00:00").toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Scale className="size-3" /> Cantidad</p>
            <p className="font-medium">{Number(data.qty).toFixed(1)} {data.unit}</p>
          </div>
        </div>

        {catalog && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cultivo</p>
            <p className="font-semibold text-lg">{catalog.name}</p>
            {crop?.planting_date && <p className="text-sm text-muted-foreground">Siembra: {new Date(crop.planting_date + "T12:00:00").toLocaleDateString()}</p>}
          </div>
        )}

        {parcel && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Parcela de origen</p>
            <p className="font-medium">{parcel.name}</p>
            {parcel.latitude && parcel.longitude && (
              <p className="text-xs text-muted-foreground">📍 {Number(parcel.latitude).toFixed(4)}, {Number(parcel.longitude).toFixed(4)}</p>
            )}
          </div>
        )}

        {farmer && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Productor</p>
            <p className="font-medium">{farmer.full_name || "—"}</p>
          </div>
        )}

        {data.globalgap_cert && (
          <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">GLOBALG.A.P. Certified</Badge>
        )}

        {data.notes && <p className="text-sm text-muted-foreground border-t border-border pt-3">{data.notes}</p>}

        <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          SIGIC — Sistema de Gestión Inteligente de Cultivos
        </p>
      </Card>
    </div>
  );
}
