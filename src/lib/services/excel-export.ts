import { saveAs } from "file-saver";

type ColumnDef = { header: string; key: string; width?: number; format?: string };

function csvCell(value: unknown) {
  if (value == null) return "";
  let text = String(value).replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRows(data: Record<string, unknown>[], columns: ColumnDef[]) {
  return [
    columns.map((column) => csvCell(column.header)).join(","),
    ...data.map((row) => columns.map((column) => csvCell(row[column.key])).join(",")),
  ];
}

function saveCsv(lines: string[], filename: string) {
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  saveAs(blob, `${filename}-${new Date().toISOString().split("T")[0]}.csv`);
}

export async function exportToExcel(data: Record<string, unknown>[], columns: ColumnDef[], filename: string) {
  saveCsv(csvRows(data, columns), filename);
}

export function exportParcelsToExcel(parcels: any[]) {
  exportToExcel(
    parcels.map((p) => ({
      name: p.name,
      area_m2: Number(p.area_m2),
      area_ha: (Number(p.area_m2) / 10000).toFixed(2),
      soil: p.soil_types?.name || "",
      latitude: p.latitude ?? "",
      longitude: p.longitude ?? "",
      notes: p.notes || "",
    })),
    [
      { header: "Nombre", key: "name", width: 25 },
      { header: "Área (m²)", key: "area_m2", width: 12 },
      { header: "Área (ha)", key: "area_ha", width: 10 },
      { header: "Suelo", key: "soil", width: 18 },
      { header: "Latitud", key: "latitude", width: 14 },
      { header: "Longitud", key: "longitude", width: 14 },
      { header: "Notas", key: "notes", width: 30 },
    ],
    "parcelas"
  );
}

export async function exportFullReport(parcels: any[], costs: any[], harvests: any[], activities: any[]) {
  const sheets: [string, Record<string, unknown>[], ColumnDef[]][] = [
    ["Parcelas", parcels.map((p) => ({ name: p.name, area_m2: Number(p.area_m2), area_ha: (Number(p.area_m2) / 10000).toFixed(2), soil: p.soil_types?.name || "", latitude: p.latitude ?? "", longitude: p.longitude ?? "" })), [
      { header: "Nombre", key: "name", width: 25 }, { header: "Área (m²)", key: "area_m2", width: 12 }, { header: "Área (ha)", key: "area_ha", width: 10 },
      { header: "Suelo", key: "soil", width: 18 }, { header: "Latitud", key: "latitude", width: 14 }, { header: "Longitud", key: "longitude", width: 14 },
    ]],
    ["Costos", costs.map((c) => ({ tipo: c.kind, descripcion: c.description || "", cantidad: c.qty ?? "", unitario: c.unit_cost, total: c.total })), [
      { header: "Tipo", key: "tipo", width: 20 }, { header: "Descripción", key: "descripcion", width: 30 },
      { header: "Cantidad", key: "cantidad", width: 12 }, { header: "Costo Unit.", key: "unitario", width: 14 }, { header: "Total", key: "total", width: 14 },
    ]],
    ["Cosechas", harvests.map((h) => ({ fecha: h.performed_at?.split("T")[0] || "", cantidad: Number(h.harvested_qty).toFixed(1), unidad: h.unit || "KG", precio: h.sale_price ? `$ ${Number(h.sale_price).toFixed(2)}` : "", ingreso: h.total_revenue ? `$ ${Number(h.total_revenue).toFixed(2)}` : "", notas: h.notes || "" })), [
      { header: "Fecha", key: "fecha", width: 14 }, { header: "Cantidad", key: "cantidad", width: 12 }, { header: "Unidad", key: "unidad", width: 8 },
      { header: "Precio", key: "precio", width: 14 }, { header: "Ingreso", key: "ingreso", width: 14 }, { header: "Notas", key: "notas", width: 30 },
    ]],
    ["Actividades", activities.map((a) => ({ fecha: a.performed_at?.split("T")[0] || "", tipo: a.kind, notas: a.notes || "" })), [
      { header: "Fecha", key: "fecha", width: 14 }, { header: "Tipo", key: "tipo", width: 25 }, { header: "Notas", key: "notas", width: 40 },
    ]],
  ];

  const lines: string[] = [];
  for (const [name, data, cols] of sheets) {
    if (data.length === 0) continue;
    if (lines.length > 0) lines.push("");
    lines.push(csvCell(name), ...csvRows(data, cols));
  }

  saveCsv(lines, "reporte-completo");
}

export function exportCostsToExcel(costs: any[], harvests: any[]) {
  const all = [
    ...costs.map((c) => ({ type: "COST", kind: c.kind, description: c.description, qty: c.qty, unit_cost: c.unit_cost, total: c.total })),
    ...harvests.map((h) => ({ type: "HARVEST", kind: "Cosecha", description: h.notes || "", qty: h.harvested_qty, unit_cost: h.sale_price, total: h.total_revenue })),
  ];
  exportToExcel(
    all,
    [
      { header: "Tipo", key: "type", width: 10 },
      { header: "Categoría", key: "kind", width: 20 },
      { header: "Descripción", key: "description", width: 30 },
      { header: "Cantidad", key: "qty", width: 12 },
      { header: "Costo/Prec. Unit.", key: "unit_cost", width: 14 },
      { header: "Total", key: "total", width: 14 },
    ],
    "costos-rentabilidad"
  );
}
