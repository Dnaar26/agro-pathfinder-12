import { saveAs } from "file-saver";

type ColumnDef = { header: string; key: string; width?: number; format?: string };

export async function exportToExcel(data: Record<string, unknown>[], columns: ColumnDef[], filename: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const wsData = [columns.map((c) => c.header), ...data.map((row) => columns.map((c) => row[c.key] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  columns.forEach((c, i) => {
    if (c.width) ws["!cols"] = ws["!cols"] || [];
    if (c.width) ws["!cols"][i] = { wch: c.width };
  });

  ws["!rows"] = [{ hpx: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "Data");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `${filename}-${new Date().toISOString().split("T")[0]}.xlsx`);
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
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

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

  for (const [name, data, cols] of sheets) {
    if (data.length === 0) continue;
    const wsData = [cols.map((c) => c.header), ...data.map((row) => cols.map((c) => row[c.key] ?? ""))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    cols.forEach((c, i) => { if (c.width) { ws["!cols"] = ws["!cols"] || []; ws["!cols"][i] = { wch: c.width }; } });
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `reporte-completo-${new Date().toISOString().split("T")[0]}.xlsx`);
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
