import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { inferCategory } from "@/lib/queries";
import { formatCurrencyInt } from "@/lib/currency";
import {
  bulkImportInventoryServerFn,
  type BulkInventoryImportResult,
  type BulkInventoryRowInput,
} from "@/lib/api/bulk-import.server";
import { isLikelyOfflineNetworkError, queueMutation } from "@/lib/services/offline-sync";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCcw,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";

type InventoryCategory = BulkInventoryRowInput["category"];
type InventoryUnit = BulkInventoryRowInput["unit"];

interface ParsedInventoryCsv {
  validRows: BulkInventoryRowInput[];
  invalidRows: { rowNumber: number; reason: string }[];
}

const INVENTORY_CSV_TEMPLATE = [
  "nombre_insumo,categoria,unidad,stock_inicial,stock_minimo,costo_unitario_cop,correo_productor,notas_kardex",
  "Urea Agrícola 46%,Fertilizante,KG,200,40,3400,,Inventario inicial de bodega - Lote fertilizantes nitrogenados",
  "Fertilizante NPK 15-15-15,Fertilizante,SACO,18,4,142000,,Bultos de 50 kg para mantenimiento de cultivos",
  "Cal Dolomítica Agrícola,Fertilizante,KG,500,100,650,,Enmienda correctiva de acidez y aluminio",
  "Trichoderma harzianum WP,Bioinsumo,KG,12,3,68000,,Control biológico preventivo de hongos de suelo",
  "Fungicida Oxicloruro de Cobre,Plaguicida,KG,15,5,39500,,Manejo preventivo de roya y manchas foliares",
  "Jabón Potásico Agrícola,Bioinsumo,L,20,5,28000,,Control orgánico de áfidos, mosca blanca y trips",
  "Semilla Certificada Maíz Amarillo,Semilla,KG,60,15,24500,,Semilla con registro ICA lote vigente",
  "Bomba Fumigadora de Espalda 20L,Herramienta,UN,4,1,185000,,Dotación operativa revisada y calibrada",
].join("\n");

function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function splitCsvMatrix(rawText: string): string[][] {
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
      if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
  }

  return rows;
}

function parseNumericCell(raw: string | undefined): number | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.replace(/[$\s]/g, "").replace(",", ".");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeCategory(rawCat: string | undefined, itemName: string): InventoryCategory {
  const c = (rawCat ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (c.includes("fertiliz") || c.includes("abono") || c.includes("enmienda")) return "Fertilizante";
  if (c.includes("plaguic") || c.includes("pestic") || c.includes("fungic") || c.includes("insectic") || c.includes("herbic") || c.includes("fitosanit")) {
    return "Plaguicida";
  }
  if (c.includes("bio") || c.includes("organic")) return "Bioinsumo";
  if (c.includes("semill") || c.includes("plantul")) return "Semilla";
  if (c.includes("herram") || c.includes("equipo") || c.includes("maquin")) return "Herramienta";
  if (c.includes("combust") || c.includes("acpm") || c.includes("gasolin")) return "Combustible";
  if (c === "otro" || c === "otros") return "Otro";

  const inferred = inferCategory(itemName);
  const allowed: InventoryCategory[] = [
    "Fertilizante",
    "Plaguicida",
    "Bioinsumo",
    "Semilla",
    "Herramienta",
    "Combustible",
    "Otro",
  ];
  return allowed.includes(inferred as InventoryCategory) ? (inferred as InventoryCategory) : "Otro";
}

function normalizeUnit(rawUnit: string | undefined): InventoryUnit {
  const u = (rawUnit ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (u === "l" || u === "lt" || u.startsWith("litro")) return "L";
  if (u === "un" || u === "und" || u.startsWith("unidad")) return "UN";
  if (u.startsWith("saco") || u.startsWith("bulto")) return "SACO";
  if (u === "gl" || u.startsWith("galon")) return "GL";
  if (u === "ton" || u === "t" || u.startsWith("tonelada")) return "TON";
  return "KG";
}

function parseInventoryCsv(rawText: string): ParsedInventoryCsv {
  const matrix = splitCsvMatrix(rawText);
  if (matrix.length < 2) {
    return {
      validRows: [],
      invalidRows: [{ rowNumber: 1, reason: "El archivo no contiene filas de insumos bajo el encabezado." }],
    };
  }

  const headers = matrix[0].map(normalizeHeader);
  const findCol = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));

  const idxName = findCol(["nombre_insumo", "insumo", "nombre", "producto", "item", "name"]);
  const idxCat = findCol(["categoria", "tipo", "category"]);
  const idxUnit = findCol(["unidad", "unidad_medida", "medida", "unit"]);
  const idxStock = findCol(["stock_inicial", "stock", "cantidad", "existencias", "stock_qty"]);
  const idxMin = findCol(["stock_minimo", "minimo", "alerta_minima", "min_stock"]);
  const idxCost = findCol(["costo_unitario_cop", "costo_unitario", "costo", "precio_unitario", "valor_unitario", "unit_cost"]);
  const idxEmail = findCol(["correo_productor", "correo", "email", "productor_email"]);
  const idxNotes = findCol(["notas_kardex", "notas", "observaciones", "motivo", "notes"]);

  if (idxName === -1 || idxStock === -1) {
    return {
      validRows: [],
      invalidRows: [
        {
          rowNumber: 1,
          reason: "Faltan columnas obligatorias en el encabezado (requiere al menos: nombre_insumo y stock_inicial).",
        },
      ],
    };
  }

  const validRows: BulkInventoryRowInput[] = [];
  const invalidRows: { rowNumber: number; reason: string }[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const rowNumber = r + 1;
    const itemName = (cells[idxName] ?? "").trim();

    if (itemName.length < 2) {
      invalidRows.push({ rowNumber, reason: "Nombre de insumo vacío o menor a 2 caracteres." });
      continue;
    }

    const stockVal = parseNumericCell(cells[idxStock]);
    if (stockVal === null || stockVal < 0 || stockVal > 10_000_000) {
      invalidRows.push({ rowNumber, reason: `Stock inicial inválido en «${itemName}» (debe ser un número >= 0).` });
      continue;
    }

    const rawMin = idxMin !== -1 ? parseNumericCell(cells[idxMin]) : 5;
    const minStock = rawMin !== null && rawMin >= 0 ? rawMin : 5;

    const rawCost = idxCost !== -1 ? parseNumericCell(cells[idxCost]) : 0;
    const unitCostCop = rawCost !== null && rawCost >= 0 ? rawCost : 0;

    const rawEmail = idxEmail !== -1 ? (cells[idxEmail] ?? "").trim().toLowerCase() : "";
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      invalidRows.push({ rowNumber, reason: `Correo de productor inválido (${rawEmail}).` });
      continue;
    }

    validRows.push({
      rowNumber,
      itemName: itemName.slice(0, 120),
      category: normalizeCategory(idxCat !== -1 ? cells[idxCat] : undefined, itemName),
      unit: normalizeUnit(idxUnit !== -1 ? cells[idxUnit] : undefined),
      initialStock: Math.round(stockVal * 100) / 100,
      minStock: Math.round(minStock * 100) / 100,
      unitCostCop: Math.round(unitCostCop * 100) / 100,
      producerEmail: rawEmail || null,
      notes: idxNotes !== -1 && cells[idxNotes]?.trim() ? cells[idxNotes].trim().slice(0, 500) : null,
    });
  }

  return { validRows: validRows.slice(0, 300), invalidRows };
}

export interface BulkInventoryCsvDialogProps {
  targetOwnerId?: string;
  targetOwnerName?: string;
  isAdmin?: boolean;
  buttonLabel?: string;
}

export function BulkInventoryCsvDialog({
  targetOwnerId,
  targetOwnerName,
  isAdmin = false,
  buttonLabel = "Importar CSV",
}: BulkInventoryCsvDialogProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [duplicateStrategy, setDuplicateStrategy] = useState<"SKIP" | "ADD_STOCK">("SKIP");
  const [parsed, setParsed] = useState<ParsedInventoryCsv | null>(null);
  const [importResult, setImportResult] = useState<(BulkInventoryImportResult & { queuedOffline?: boolean }) | null>(null);

  const previewStats = useMemo(() => {
    if (!parsed) return null;
    const totalCop = parsed.validRows.reduce((s, r) => s + r.initialStock * r.unitCostCop, 0);
    const categoriesCount = new Set(parsed.validRows.map((r) => r.category)).size;
    const multiProducerEmails = new Set(parsed.validRows.map((r) => r.producerEmail).filter(Boolean)).size;
    return { totalCop, categoriesCount, multiProducerEmails };
  }, [parsed]);

  const importMutation = useMutation({
    mutationFn: async (rows: BulkInventoryRowInput[]): Promise<BulkInventoryImportResult & { queuedOffline?: boolean }> => {
      const hasMultiEmails = rows.some((r) => Boolean(r.producerEmail));

      const enqueueOfflineIfPossible = async () => {
        const { data: s } = await supabase.auth.getSession();
        const ownerId = targetOwnerId || s.session?.user?.id;
        if (!ownerId || hasMultiEmails) {
          throw new Error("La importación multi-productor por correo requiere conexión a internet.");
        }
        for (const r of rows) {
          await queueMutation({
            table: "inventory_items",
            action: "INSERT",
            data: {
              owner_id: ownerId,
              name: r.itemName,
              category: r.category,
              unit: r.unit,
              stock_qty: r.initialStock,
              min_stock: r.minStock,
              unit_cost: r.unitCostCop,
            },
          });
        }
        const offlineTotal = rows.reduce((acc, r) => acc + r.initialStock * r.unitCostCop, 0);
        return {
          createdItems: rows.length,
          updatedItems: 0,
          skippedItems: 0,
          kardexMovementsLogged: 0,
          totalImportedValueCop: Math.round(offlineTotal),
          rowErrors: [],
          queuedOffline: true,
        };
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return enqueueOfflineIfPossible();
      }

      try {
        return await bulkImportInventoryServerFn({
          data: {
            targetOwnerId: targetOwnerId || null,
            duplicateStrategy,
            rows,
          },
        });
      } catch (err) {
        if (isLikelyOfflineNetworkError(err) && !hasMultiEmails) {
          return enqueueOfflineIfPossible();
        }
        throw err;
      }
    },
    onSuccess: (res) => {
      setImportResult(res);
      if (res.queuedOffline) {
        toast.success(`Sin señal: ${res.createdItems} insumos guardados en cola offline para sincronizar.`);
      } else {
        toast.success(
          `Bodega actualizada: ${res.createdItems} nuevos, ${res.updatedItems} recargados y ${res.kardexMovementsLogged} entradas Kardex.`
        );
      }
      void qc.invalidateQueries({ queryKey: ["inventory"] });
      void qc.invalidateQueries({ queryKey: ["calendar-inventory"] });
      void qc.invalidateQueries({ queryKey: ["crop-detail-inventory"] });
      void qc.invalidateQueries({ queryKey: ["my-inventory-report"] });
      void qc.invalidateQueries({ queryKey: ["global-inventory"] });
      void qc.invalidateQueries({ queryKey: ["inv-value"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo importar el archivo CSV de inventario");
    },
  });

  const resetState = () => {
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
    setParsed(parseInventoryCsv(text));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
          <Upload className="size-3.5 text-primary" />
          <span>{buttonLabel}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Importación Masiva de Inventario Inicial y Kardex (CSV)
          </DialogTitle>
        </DialogHeader>

        {!importResult ? (
          <div className="space-y-4 text-xs">
            {/* Banner de destino y descarga de plantilla */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">
                    1. Descarga la plantilla oficial de bodega
                  </span>
                  {targetOwnerName ? (
                    <Badge className="bg-primary text-primary-foreground text-[10px]">
                      Bodega destino: {targetOwnerName}
                    </Badge>
                  ) : isAdmin ? (
                    <Badge variant="outline" className="bg-card text-[10px]">
                      Soporta columna opcional correo_productor
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground">
                  Clasifica categorías automáticamente, registra el movimiento inicial <strong>ENTRADA</strong> en el Kardex y admite hasta 300 insumos por archivo.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsvFile("plantilla-inventario-inicial-sigic.csv", INVENTORY_CSV_TEMPLATE)
                }
                className="gap-1.5 shrink-0 bg-card"
              >
                <Download className="size-3.5 text-primary" /> Plantilla CSV
              </Button>
            </div>

            {/* Selector de comportamiento ante duplicados */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border bg-muted/25 p-3">
              <div>
                <p className="font-semibold text-foreground">Si un insumo del CSV ya existe en la bodega:</p>
                <p className="text-[11px] text-muted-foreground">
                  Elige si prefieres evitar cargas repetidas o sumar las unidades al stock actual.
                </p>
              </div>
              <Select
                value={duplicateStrategy}
                onValueChange={(v) => setDuplicateStrategy(v as "SKIP" | "ADD_STOCK")}
              >
                <SelectTrigger className="w-full sm:w-64 h-9 text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SKIP" className="text-xs">
                    Omitir existentes (Idempotente seguro)
                  </SelectItem>
                  <SelectItem value="ADD_STOCK" className="text-xs">
                    Sumar al stock actual (+ Entrada Kardex)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Zona de carga del archivo */}
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 p-5 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
              <Upload className="size-6 text-primary" />
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {fileName ? `Archivo seleccionado: ${fileName}` : "2. Haz clic para cargar tu archivo .CSV de inventario"}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Columnas: nombre_insumo, categoria, unidad (KG/L/UN/SACO/GL/TON), stock_inicial, stock_minimo, costo_unitario_cop
                </p>
              </div>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
            </label>

            {parsed && previewStats && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <Card className="p-2.5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Insumos válidos</p>
                    <p className="text-lg font-bold text-success">{parsed.validRows.length}</p>
                  </Card>
                  <Card className="p-2.5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Categorías</p>
                    <p className="text-lg font-bold">{previewStats.categoriesCount}</p>
                  </Card>
                  <Card className="p-2.5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Valor lote (COP)</p>
                    <p className="text-sm font-bold text-primary mt-1">
                      {formatCurrencyInt(previewStats.totalCop)}
                    </p>
                  </Card>
                  <Card className="p-2.5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Filas con error</p>
                    <p className={`text-lg font-bold ${parsed.invalidRows.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {parsed.invalidRows.length}
                    </p>
                  </Card>
                </div>

                {parsed.invalidRows.length > 0 && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1 max-h-28 overflow-y-auto">
                    <p className="font-semibold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" /> Correcciones requeridas en filas omitidas:
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
                          <th className="p-2">Insumo</th>
                          <th className="p-2">Categoría</th>
                          <th className="p-2 text-right">Stock inicial</th>
                          <th className="p-2 text-right">Mín.</th>
                          <th className="p-2 text-right">Costo unit.</th>
                          {previewStats.multiProducerEmails > 0 && <th className="p-2">Productor</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {parsed.validRows.slice(0, 30).map((r) => (
                          <tr key={r.rowNumber}>
                            <td className="p-2 font-medium text-foreground">{r.itemName}</td>
                            <td className="p-2">
                              <Badge variant="outline" className="text-[10px]">
                                {r.category}
                              </Badge>
                            </td>
                            <td className="p-2 text-right font-semibold tabular-nums">
                              {r.initialStock} {r.unit}
                            </td>
                            <td className="p-2 text-right text-muted-foreground tabular-nums">
                              {r.minStock}
                            </td>
                            <td className="p-2 text-right tabular-nums">
                              {formatCurrencyInt(r.unitCostCop)}
                            </td>
                            {previewStats.multiProducerEmails > 0 && (
                              <td className="p-2 text-muted-foreground">{r.producerEmail || "Actual"}</td>
                            )}
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
                    <Loader2 className="size-4 animate-spin" /> Cargando bodega…
                  </>
                ) : (
                  <>
                    <PackageCheck className="size-4" /> Importar {parsed?.validRows.length ?? 0} insumo(s)
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
                <p className="font-bold text-sm text-foreground">
                  {importResult.queuedOffline
                    ? "Inventario encolado localmente para sincronización automática"
                    : "Inventario y movimientos iniciales de Kardex registrados con éxito"}
                </p>
                <p className="text-muted-foreground">
                  Valor total incorporado: <strong>{formatCurrencyInt(importResult.totalImportedValueCop)}</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <Card className="p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Nuevos creados</p>
                <p className="text-lg font-bold text-success">{importResult.createdItems}</p>
              </Card>
              <Card className="p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Stock sumado</p>
                <p className="text-lg font-bold text-primary">{importResult.updatedItems}</p>
              </Card>
              <Card className="p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Entradas Kardex</p>
                <p className="text-lg font-bold">{importResult.kardexMovementsLogged}</p>
              </Card>
              <Card className="p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Omitidos (ya existían)</p>
                <p className="text-lg font-bold text-muted-foreground">{importResult.skippedItems}</p>
              </Card>
            </div>

            {importResult.rowErrors.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1 max-h-32 overflow-y-auto">
                <p className="font-semibold text-destructive">Incidencias por fila:</p>
                {importResult.rowErrors.map((err, idx) => (
                  <p key={idx} className="text-[11px] text-muted-foreground">
                    <strong>Fila {err.rowNumber} ({err.itemName}):</strong> {err.message}
                  </p>
                ))}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={resetState} className="gap-1.5">
                <RotateCcw className="size-3.5" /> Cargar otro CSV
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
