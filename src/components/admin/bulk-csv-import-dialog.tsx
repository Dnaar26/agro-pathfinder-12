import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  bulkImportProducersServerFn,
  type BulkImportResult,
  type BulkProducerRowInput,
} from "@/lib/api/bulk-import.server";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

type ParsedCsvRowResult = {
  validRows: BulkProducerRowInput[];
  invalidRows: { rowNumber: number; reason: string; rawPreview: string }[];
};

const CSV_TEMPLATE_CONTENT = [
  "nombre_productor,correo,telefono,nombre_parcela,area_ha,tipo_suelo,latitud,longitud,cultivo_inicial,fecha_siembra,notas",
  'Hernando Gómez Vargas,hernando.gomez@cooperativa-agro.co,3104567810,Finca El Mirador - Lote Alto,2.5,Franco,1.8538,-76.0507,Café,2026-10-15,"Variedad Castillo resistente a roya, sombra regulada"',
  "Hernando Gómez Vargas,hernando.gomez@cooperativa-agro.co,3104567810,Finca El Mirador - Lote Bajo,1.2,Franco arcilloso,1.8512,-76.0489,Plátano,2026-11-02,Barrera asociada al cafetal",
  "Luz Marina Córdoba,luz.cordoba@cooperativa-agro.co,3157894321,Parcela Santa Helena,3.8,Franco,6.1542,-75.3741,Aguacate,2026-09-20,Aguacate Hass con monitoreo BPA activo",
  "Álvaro Tibaduiza Ruiz,alvaro.tibaduiza@cooperativa-agro.co,3206549870,Vereda San Isidro Lote 1,1.75,Franco arenoso,5.5353,-73.3678,Papa,2026-11-10,Semilla certificada ICA con riego por aspersión",
  "Yolanda Quiñones Mina,yolanda.quinones@cooperativa-agro.co,3123456789,Parcela La Esperanza,4.0,Arcilloso,1.8056,-78.7647,Cacao,2026-08-12,Clon fino de aroma con drenaje perimetral",
  "Ramiro Perdomo Polanía,ramiro.perdomo@cooperativa-agro.co,3189871234,Lote Las Brisas,5.5,Limoso,4.1420,-74.8814,Maíz,2026-12-05,Siembra programada ciclo tecnificado",
].join("\n");

function downloadTextCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeHeaderKey(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Parser CSV RFC-4180 compatible con separador coma (,) o punto y coma (;) de Excel en español */
function splitCsvRecords(rawText: string): string[][] {
  const cleaned = rawText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = cleaned.split("\n").find((l) => l.trim().length > 0) ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  const delimiter = semiCount > commaCount ? ";" : ",";

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if (ch === "\n") {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseFlexibleNumber(raw: string | undefined): number | null {
  if (!raw || !raw.trim()) return null;
  const normalized = raw.trim().replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function normalizeIsoDate(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dmy = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  return null;
}

function parseProducersCsv(rawText: string): ParsedCsvRowResult {
  const matrix = splitCsvRecords(rawText);
  if (matrix.length < 2) {
    return {
      validRows: [],
      invalidRows: [{ rowNumber: 1, reason: "El archivo no contiene filas de datos bajo el encabezado.", rawPreview: "" }],
    };
  }

  const headers = matrix[0].map(normalizeHeaderKey);
  const findCol = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));

  const idxName = findCol(["nombre_productor", "productor", "agricultor", "nombre", "nombre_completo", "full_name"]);
  const idxEmail = findCol(["correo", "email", "correo_electronico", "mail"]);
  const idxPhone = findCol(["telefono", "celular", "whatsapp", "phone", "movil"]);
  const idxParcel = findCol(["nombre_parcela", "parcela", "lote", "finca", "unidad_productiva"]);
  const idxAreaHa = findCol(["area_ha", "hectareas", "ha", "superficie_ha"]);
  const idxAreaM2 = findCol(["area_m2", "metros_cuadrados", "m2"]);
  const idxSoil = findCol(["tipo_suelo", "suelo", "soil_type", "textura"]);
  const idxLat = findCol(["latitud", "latitude", "lat"]);
  const idxLng = findCol(["longitud", "longitude", "lng", "lon"]);
  const idxCrop = findCol(["cultivo_inicial", "cultivo", "especie", "crop"]);
  const idxPlantDate = findCol(["fecha_siembra", "siembra", "planting_date"]);
  const idxNotes = findCol(["notas", "observaciones", "descripcion", "notes"]);

  if (idxName === -1 || idxEmail === -1 || idxParcel === -1 || (idxAreaHa === -1 && idxAreaM2 === -1)) {
    return {
      validRows: [],
      invalidRows: [
        {
          rowNumber: 1,
          reason:
            "Faltan columnas obligatorias en el encabezado (requiere: nombre_productor, correo, nombre_parcela y area_ha).",
          rawPreview: matrix[0].join(" | "),
        },
      ],
    };
  }

  const validRows: BulkProducerRowInput[] = [];
  const invalidRows: { rowNumber: number; reason: string; rawPreview: string }[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const rowNumber = r + 1;
    const producerName = (cells[idxName] ?? "").trim();
    const email = (cells[idxEmail] ?? "").trim().toLowerCase();
    const parcelName = (cells[idxParcel] ?? "").trim();

    const haVal = idxAreaHa !== -1 ? parseFlexibleNumber(cells[idxAreaHa]) : null;
    const m2Val = idxAreaM2 !== -1 ? parseFlexibleNumber(cells[idxAreaM2]) : null;
    const areaM2 = haVal !== null && haVal > 0 ? Math.round(haVal * 10000) : m2Val !== null && m2Val > 0 ? Math.round(m2Val) : 0;

    if (producerName.length < 2) {
      invalidRows.push({ rowNumber, reason: "Nombre de productor vacío o menor a 2 caracteres", rawPreview: cells.join(", ") });
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalidRows.push({ rowNumber, reason: `Correo electrónico inválido (${email || "vacío"})`, rawPreview: cells.join(", ") });
      continue;
    }
    if (parcelName.length < 2) {
      invalidRows.push({ rowNumber, reason: "Nombre de parcela vacío", rawPreview: cells.join(", ") });
      continue;
    }
    if (areaM2 <= 0 || areaM2 > 100_000_000) {
      invalidRows.push({ rowNumber, reason: "Área fuera de rango válido (> 0 ha)", rawPreview: cells.join(", ") });
      continue;
    }

    const rawLat = idxLat !== -1 ? parseFlexibleNumber(cells[idxLat]) : null;
    const rawLng = idxLng !== -1 ? parseFlexibleNumber(cells[idxLng]) : null;
    const validLat = rawLat !== null && rawLat >= -90 && rawLat <= 90 ? rawLat : null;
    const validLng = rawLng !== null && rawLng >= -180 && rawLng <= 180 ? rawLng : null;

    const rawDateCell = idxPlantDate !== -1 ? cells[idxPlantDate] : "";
    const parsedPlantDate = normalizeIsoDate(rawDateCell);
    if (rawDateCell?.trim() && !parsedPlantDate) {
      invalidRows.push({
        rowNumber,
        reason: `Fecha de siembra inválida (${rawDateCell}); usa YYYY-MM-DD o DD/MM/YYYY`,
        rawPreview: cells.join(", "),
      });
      continue;
    }

    validRows.push({
      rowNumber,
      producerName,
      email,
      phone: idxPhone !== -1 && cells[idxPhone]?.trim() ? cells[idxPhone].trim().slice(0, 30) : null,
      parcelName,
      areaM2,
      soilTypeName: idxSoil !== -1 && cells[idxSoil]?.trim() ? cells[idxSoil].trim().slice(0, 80) : null,
      latitude: validLat,
      longitude: validLng,
      initialCropName: idxCrop !== -1 && cells[idxCrop]?.trim() ? cells[idxCrop].trim().slice(0, 80) : null,
      plantingDate: parsedPlantDate,
      notes: idxNotes !== -1 && cells[idxNotes]?.trim() ? cells[idxNotes].trim().slice(0, 800) : null,
    });
  }

  return { validRows: validRows.slice(0, 200), invalidRows };
}

export function BulkCsvImportDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedCsvRowResult | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

  const summaryPreview = useMemo(() => {
    if (!parsed) return null;
    const uniqueEmails = new Set(parsed.validRows.map((r) => r.email)).size;
    const totalHa = parsed.validRows.reduce((s, r) => s + r.areaM2 / 10000, 0);
    const withCrop = parsed.validRows.filter((r) => Boolean(r.initialCropName)).length;
    return { uniqueEmails, totalHa, withCrop };
  }, [parsed]);

  const importMutation = useMutation({
    mutationFn: async (rows: BulkProducerRowInput[]) => {
      return bulkImportProducersServerFn({ data: { rows } });
    },
    onSuccess: (res) => {
      setImportResult(res);
      toast.success(
        `Importación completada: ${res.createdParcels} parcelas nuevas y ${res.createdUsers} cuentas creadas.`
      );
      void qc.invalidateQueries({ queryKey: ["admin-farmers"] });
      void qc.invalidateQueries({ queryKey: ["admin-metrics"] });
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-user-directory"] });
      void qc.invalidateQueries({ queryKey: ["parcels"] });
      void qc.invalidateQueries({ queryKey: ["crops"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al ejecutar la carga masiva");
    },
  });

  const resetWizard = () => {
    setFileName("");
    setParsed(null);
    setImportResult(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);
    const text = await file.text();
    setParsed(parseProducersCsv(text));
  };

  const handleDownloadCredentialsCsv = () => {
    if (!importResult?.credentials.length) return;
    const lines = [
      "nombre_productor,correo_acceso,contrasena_temporal",
      ...importResult.credentials.map(
        (c) => `"${c.producerName.replace(/"/g, '""')}",${c.email},"${c.temporaryPassword}"`
      ),
    ].join("\n");
    downloadTextCsv(`credenciales-nuevos-productores-${new Date().toISOString().slice(0, 10)}.csv`, lines);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetWizard();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="gap-1.5 text-xs">
          <Upload className="size-3.5" /> Importar Padrón CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Carga Masiva de Productores, Parcelas y Cultivos (CSV)
          </DialogTitle>
        </DialogHeader>

        {!importResult ? (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  1. Descarga la plantilla oficial compatible con Excel
                </p>
                <p className="text-muted-foreground">
                  Soporta coma (<code>,</code>) o punto y coma (<code>;</code>), múltiples parcelas por productor y siembra inicial opcional (máx. 200 filas por lote).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadTextCsv("plantilla-carga-masiva-productores-sigic.csv", CSV_TEMPLATE_CONTENT)
                }
                className="gap-1.5 shrink-0 bg-card"
              >
                <Download className="size-3.5 text-primary" /> Descargar plantilla CSV
              </Button>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/25 p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
              <Upload className="size-6 text-primary" />
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {fileName ? `Archivo cargado: ${fileName}` : "2. Selecciona tu archivo .CSV de productores"}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Columnas: nombre_productor, correo, telefono, nombre_parcela, area_ha, tipo_suelo, latitud, longitud, cultivo_inicial, fecha_siembra
                </p>
              </div>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
            </label>

            {parsed && summaryPreview && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <Card className="p-2.5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Filas válidas</p>
                    <p className="text-lg font-bold text-success">{parsed.validRows.length}</p>
                  </Card>
                  <Card className="p-2.5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Productores únicos</p>
                    <p className="text-lg font-bold">{summaryPreview.uniqueEmails}</p>
                  </Card>
                  <Card className="p-2.5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Superficie total</p>
                    <p className="text-lg font-bold">{summaryPreview.totalHa.toFixed(2)} ha</p>
                  </Card>
                  <Card className="p-2.5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Con errores</p>
                    <p className={`text-lg font-bold ${parsed.invalidRows.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {parsed.invalidRows.length}
                    </p>
                  </Card>
                </div>

                {parsed.invalidRows.length > 0 && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1.5 max-h-32 overflow-y-auto">
                    <p className="font-semibold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" /> Filas omitidas por formato inválido:
                    </p>
                    {parsed.invalidRows.map((inv) => (
                      <p key={inv.rowNumber} className="text-[11px] text-muted-foreground">
                        <strong>Fila {inv.rowNumber}:</strong> {inv.reason}
                      </p>
                    ))}
                  </div>
                )}

                {parsed.validRows.length > 0 && (
                  <div className="rounded-xl border border-border overflow-x-auto max-h-52">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-muted/60 text-muted-foreground sticky top-0">
                        <tr>
                          <th className="p-2">Fila</th>
                          <th className="p-2">Productor</th>
                          <th className="p-2">Correo</th>
                          <th className="p-2">Parcela</th>
                          <th className="p-2 text-right">Área (ha)</th>
                          <th className="p-2">Cultivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {parsed.validRows.slice(0, 25).map((r) => (
                          <tr key={r.rowNumber}>
                            <td className="p-2 font-mono text-muted-foreground">#{r.rowNumber}</td>
                            <td className="p-2 font-medium text-foreground">{r.producerName}</td>
                            <td className="p-2 text-muted-foreground">{r.email}</td>
                            <td className="p-2">{r.parcelName}</td>
                            <td className="p-2 text-right tabular-nums">{(r.areaM2 / 10000).toFixed(2)}</td>
                            <td className="p-2">
                              {r.initialCropName ? (
                                <Badge variant="outline" className="text-[10px]">
                                  {r.initialCropName}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!parsed || parsed.validRows.length === 0 || importMutation.isPending}
                onClick={() => parsed && importMutation.mutate(parsed.validRows)}
                className="gap-1.5"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Procesando padrón…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" /> Importar {parsed?.validRows.length ?? 0} fila(s)
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 flex items-start gap-3">
              <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-foreground">Padrón procesado de forma idempotente</p>
                <p className="text-muted-foreground">
                  Las unidades productivas ya están disponibles en el Directorio de Fincas y listas para asignarles técnico o generar reportes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <Card className="p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Cuentas nuevas</p>
                <p className="text-lg font-bold text-primary">{importResult.createdUsers}</p>
              </Card>
              <Card className="p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Cuentas existentes</p>
                <p className="text-lg font-bold">{importResult.linkedUsers}</p>
              </Card>
              <Card className="p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Parcelas creadas</p>
                <p className="text-lg font-bold text-success">{importResult.createdParcels}</p>
              </Card>
              <Card className="p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Cultivos creados</p>
                <p className="text-lg font-bold text-success">{importResult.createdCrops}</p>
              </Card>
              <Card className="p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Ya existían</p>
                <p className="text-lg font-bold text-muted-foreground">{importResult.skippedParcels}</p>
              </Card>
            </div>

            {importResult.credentials.length > 0 && (
              <Card className="p-3.5 border-warning/40 bg-warning/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <KeyRound className="size-4 text-warning-text" />
                    Se generaron {importResult.credentials.length} contraseñas temporales nuevas
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Descarga esta hoja única de entrega para compartir el acceso inicial con cada nuevo productor.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadCredentialsCsv}
                  className="gap-1.5 shrink-0 bg-card"
                >
                  <Download className="size-3.5 text-primary" /> Descargar credenciales CSV
                </Button>
              </Card>
            )}

            {importResult.rowErrors.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1 max-h-32 overflow-y-auto">
                <p className="font-semibold text-destructive">Errores reportados por servidor:</p>
                {importResult.rowErrors.map((err, idx) => (
                  <p key={idx} className="text-[11px] text-muted-foreground">
                    <strong>Fila {err.rowNumber} ({err.email}):</strong> {err.message}
                  </p>
                ))}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={resetWizard} className="gap-1.5">
                <RotateCcw className="size-3.5" /> Cargar otro archivo
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Finalizar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
