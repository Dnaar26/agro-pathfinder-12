import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import logoAsset from "@/assets/sgic-logo.png.asset.json";

export type PdfReportTemplate = "actividades" | "parcelas" | "resumen";

export interface PdfSection {
  title?: string;
  head?: string[];
  body: (string | number)[][];
  columnStyles?: Record<number, { cellWidth?: number | "auto" }>;
}

export interface PdfReportOptions {
  template: PdfReportTemplate;
  title: string;
  subtitle?: string;
  filters?: Record<string, string>;
  sections: PdfSection[];
  author?: string;
  orientation?: "portrait" | "landscape";
}

const BRAND: [number, number, number] = [34, 113, 56];
const MUTED: [number, number, number] = [110, 110, 110];

let cachedLogo: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(logoAsset.url);
    const blob = await res.blob();
    cachedLogo = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return cachedLogo;
  } catch {
    return null;
  }
}

function templateLabel(t: PdfReportTemplate): string {
  return { actividades: "Reporte de Actividades", parcelas: "Inventario de Parcelas", resumen: "Resumen Ejecutivo" }[t];
}

function drawHeader(doc: jsPDF, opts: PdfReportOptions, logoDataUrl: string | null) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 22, "F");
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", 8, 4, 14, 14); } catch { /* noop */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("SGIC — Sistema de Gestión Integral de Cultivos", 26, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(templateLabel(opts.template), 26, 16);
  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(opts.title, 14, 32);
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(opts.subtitle, 14, 38);
    doc.setTextColor(0, 0, 0);
  }
}

function drawFilters(doc: jsPDF, opts: PdfReportOptions, startY: number): number {
  if (!opts.filters || Object.keys(opts.filters).length === 0) return startY;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const line = Object.entries(opts.filters)
    .map(([k, v]) => `${k}: ${v || "—"}`)
    .join("   •   ");
  doc.text(line, 14, startY);
  doc.setTextColor(0, 0, 0);
  return startY + 6;
}

function drawFooter(doc: jsPDF, opts: PdfReportOptions) {
  const pageCount = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.4);
    doc.line(14, h - 12, w - 14, h - 12);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const left = `SGIC • ${templateLabel(opts.template)}${opts.author ? ` • ${opts.author}` : ""}`;
    const right = `Página ${i} de ${pageCount}`;
    const mid = `Generado ${format(new Date(), "yyyy-MM-dd HH:mm")}`;
    doc.text(left, 14, h - 7);
    doc.text(mid, w / 2, h - 7, { align: "center" });
    doc.text(right, w - 14, h - 7, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }
}

export async function generatePdfReport(opts: PdfReportOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: opts.orientation ?? "landscape", unit: "mm", format: "a4" });
  const logo = await loadLogo();
  drawHeader(doc, opts, logo);

  let y = drawFilters(doc, opts, opts.subtitle ? 44 : 40);

  for (const section of opts.sections) {
    if (section.title) {
      if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); drawHeader(doc, opts, logo); y = 40; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(section.title, 14, y);
      y += 3;
    }
    autoTable(doc, {
      startY: y,
      head: section.head ? [section.head] : undefined,
      body: section.body,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: BRAND, textColor: 255 },
      alternateRowStyles: { fillColor: [245, 248, 244] },
      columnStyles: section.columnStyles,
      margin: { left: 14, right: 14, bottom: 18 },
      didDrawPage: () => { drawHeader(doc, opts, logo); },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  drawFooter(doc, opts);
  return doc;
}
