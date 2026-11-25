import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, Scale, Scan, X, Download, Award, Sprout, Droplets, ShieldCheck, CheckCircle2 } from "lucide-react";
import { exportTraceabilityCertificatePdf } from "@/lib/pdf-certificate";
import { LogoIcon } from "@/components/logo";
import jsQR from "jsqr";

type PublicTraceBatch = {
  batch_code: string;
  harvest_date: string | null;
  qty: number;
  unit: string;
  globalgap_cert: boolean;
  notes: string | null;
  crop_name: string | null;
  planting_date: string | null;
  parcel_name: string | null;
  approx_latitude: number | null;
  approx_longitude: number | null;
  farmer_name: string | null;
};

export const Route = createFileRoute("/trace/$code")({
  head: () => ({ meta: [{ title: "Trazabilidad — SIGIC" }] }),
  component: TracePage,
});

function TracePage() {
  const { code } = useParams({ from: "/trace/$code" });
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [qrValue, setQrValue] = useState(`/trace/${encodeURIComponent(code)}`);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scannerError, setScannerError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQrValue(window.location.href);
    }
  }, [code]);

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
      try {
        const url = new URL(qr.data, window.location.origin);
        const match = url.pathname.match(/^\/trace\/(.+)$/);
        if (match?.[1]) {
          navigate({ to: "/trace/$code", params: { code: decodeURIComponent(match[1]) }, replace: true });
        } else {
          setScannerError("El código escaneado no pertenece a un lote de trazabilidad SIGIC.");
        }
      } catch {
        setScannerError("Formato de código QR inválido.");
      }
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
    queryKey: ["public-trace-rpc", code],
    queryFn: async (): Promise<PublicTraceBatch | null> => {
      const { data: rpcPayload, error } = await (supabase as any).rpc("get_public_trace_batch", {
        p_batch_code: code,
      });
      if (!error && rpcPayload) {
        return rpcPayload as PublicTraceBatch;
      }
      return null;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando información del lote…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Lote no encontrado o código inválido.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30 p-4 flex items-center justify-center relative">
      {scanning && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <button
            type="button"
            aria-label="Cerrar escáner QR"
            onClick={stopScan}
            className="absolute top-4 right-4 z-10 min-h-11 min-w-11 grid place-items-center text-white"
          >
            <X className="size-6" />
          </button>
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
            {!scanning && (
              <Button
                variant="outline"
                size="icon"
                className="size-10"
                onClick={startScan}
                aria-label="Escanear QR"
                title="Escanear QR"
              >
                <Scan className="size-4" />
              </Button>
            )}
            <QRCodeSVG value={qrValue} size={60} level="M" data-public-trace-qr={data.batch_code} />
          </div>
        </div>
        {scannerError && <p className="text-sm text-destructive">{scannerError}</p>}

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Lote</p>
          <p className="text-xl font-bold font-mono">{data.batch_code}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" /> Cosecha
            </p>
            <p className="font-medium">
              {data.harvest_date ? new Date(data.harvest_date + "T12:00:00").toLocaleDateString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Scale className="size-3" /> Cantidad
            </p>
            <p className="font-medium">
              {Number(data.qty).toFixed(1)} {data.unit}
            </p>
          </div>
        </div>

        {data.crop_name && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cultivo</p>
            <p className="font-semibold text-lg">{data.crop_name}</p>
            {data.planting_date && (
              <p className="text-sm text-muted-foreground">
                Siembra: {new Date(data.planting_date + "T12:00:00").toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {data.parcel_name && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Origen registrado</p>
            <p className="font-medium">{data.parcel_name}</p>
            {data.approx_latitude != null && data.approx_longitude != null && (
              <p className="text-xs text-muted-foreground">
                📍 Zona aproximada: {Number(data.approx_latitude).toFixed(2)}°, {Number(data.approx_longitude).toFixed(2)}°
              </p>
            )}
          </div>
        )}

        {data.farmer_name && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Productor</p>
            <p className="font-medium">{data.farmer_name}</p>
          </div>
        )}

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Historia Verificada del Campo a tu Mesa
          </p>
          <ol className="space-y-2.5 text-xs">
            <li className="flex items-start gap-2.5">
              <Sprout className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">1. Siembra Georreferenciada:</span>{" "}
                <span className="text-muted-foreground">
                  Establecida en {data.parcel_name || "parcela registrada"}{" "}
                  {data.planting_date ? `el ${new Date(data.planting_date + "T12:00:00").toLocaleDateString("es-CO")}` : ""}.
                </span>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <Droplets className="size-4 text-info shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">2. Nutrición y Manejo Trazable:</span>{" "}
                <span className="text-muted-foreground">
                  Bitácora digital de labores culturales y fertilización monitoreada en SIGIC.
                </span>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">3. Aseguramiento de Inocuidad:</span>{" "}
                <span className="text-muted-foreground">
                  {data.globalgap_cert
                    ? "Auditoría BPA / GLOBALG.A.P. aprobada con períodos de carencia cumplidos."
                    : "Control sanitario verificado en origen."}
                </span>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">4. Cosecha de Origen Fresco:</span>{" "}
                <span className="text-muted-foreground">
                  Lote {data.batch_code} recolectado{" "}
                  {data.harvest_date ? `el ${new Date(data.harvest_date + "T12:00:00").toLocaleDateString("es-CO")}` : ""}.
                </span>
              </div>
            </li>
          </ol>
        </div>

        {data.globalgap_cert && (
          <Badge className="border-success/30 bg-success/10 text-xs text-success">GLOBALG.A.P. Certified</Badge>
        )}

        {data.notes && <p className="text-sm text-muted-foreground border-t border-border pt-3">{data.notes}</p>}

        <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          SIGIC — Sistema de Gestión Inteligente de Cultivos
        </p>
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
          {data.globalgap_cert ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs">
              <Award className="size-3.5 mr-1" /> Sello BPA / GLOBALG.A.P. Verificado
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Origen digital verificado en SIGIC</span>
          )}

          <Button
            type="button"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              const svg = document.querySelector(`svg[data-public-trace-qr="${data.batch_code}"]`) as SVGSVGElement | null;
              void exportTraceabilityCertificatePdf({
                batchCode: data.batch_code,
                cropName: data.crop_name || "Producto Agrícola",
                parcelName: data.parcel_name || "Parcela Registrada",
                producerName: data.farmer_name || "Productor Verificado SIGIC",
                locationText:
                  data.approx_latitude != null && data.approx_longitude != null
                    ? `Zona aprox. ${Number(data.approx_latitude).toFixed(2)}°, ${Number(data.approx_longitude).toFixed(2)}°`
                    : undefined,
                harvestDate: data.harvest_date
                  ? new Date(data.harvest_date + "T12:00:00").toLocaleDateString("es-CO")
                  : "—",
                quantityText: `${Number(data.qty).toFixed(1)} ${data.unit || "KG"}`,
                bpaApproved: Boolean(data.globalgap_cert),
                globalGapCertified: Boolean(data.globalgap_cert),
                phytosanitarySummary: data.notes || undefined,
                qrSvgElement: svg,
                verifyUrl: qrValue,
              });
            }}
          >
            <Download className="size-3.5" /> Descargar Certificado PDF
          </Button>
        </div>
      </Card>
    </div>
  );
}
