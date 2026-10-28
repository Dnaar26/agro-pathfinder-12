import type jsPDF from "jspdf";
import { format } from "date-fns";

export type PdfReportTemplate = "actividades" | "parcelas" | "resumen";

export interface PdfSection {
  title?: string;
  head?: string[];
  body: (string | number)[][];
  columnStyles?: Record<number, { cellWidth?: number | "auto" }>;
}

export interface PdfBarChart {
  title: string;
  data: { label: string; value: number }[];
  maxItems?: number;
  valueFormatter?: (value: number) => string;
  color?: [number, number, number];
}

export interface PdfReportOptions {
  template: PdfReportTemplate;
  title: string;
  subtitle?: string;
  filters?: Record<string, string>;
  summary?: { label: string; value: string }[];
  charts?: PdfBarChart[];
  sections: PdfSection[];
  author?: string;
  orientation?: "portrait" | "landscape";
}

const BRAND: [number, number, number] = [36, 79, 58];
const MUTED: [number, number, number] = [110, 110, 110];

let cachedLogo: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${baseUrl}/sigic-logo.png`);
    if (!res.ok) return null;
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
  return {
    actividades: "Reporte de Actividades",
    parcelas: "Inventario de Parcelas",
    resumen: "Resumen Ejecutivo",
  }[t];
}

function drawHeader(doc: jsPDF, opts: PdfReportOptions, logoDataUrl: string | null) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 22, "F");
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 8, 4, 14, 14);
    } catch {
      /* noop */
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("SIGIC — Gestión Inteligente de Cultivos", 26, 10);
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
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const line = Object.entries(opts.filters)
    .map(([k, v]) => `${k}: ${v || "—"}`)
    .join("   •   ");
  const lines = doc.splitTextToSize(line, doc.internal.pageSize.getWidth() - 28);
  doc.text(lines, 14, startY);
  doc.setTextColor(0, 0, 0);
  return startY + lines.length * 4 + 2;
}

function addContentPage(doc: jsPDF, opts: PdfReportOptions, logo: string | null) {
  doc.addPage();
  drawHeader(doc, opts, logo);
  return 40;
}

function drawSummary(doc: jsPDF, opts: PdfReportOptions, logo: string | null, startY: number): number {
  const metrics = opts.summary ?? [];
  if (metrics.length === 0) return startY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const columns = Math.min(4, metrics.length);
  const gap = 3;
  const cardWidth = (pageWidth - 28 - gap * (columns - 1)) / columns;
  const cardHeight = 19;
  let y = startY;

  for (let index = 0; index < metrics.length; index += columns) {
    if (y + cardHeight > pageHeight - 18) y = addContentPage(doc, opts, logo);
    const row = metrics.slice(index, index + columns);
    row.forEach((metric, column) => {
      const x = 14 + column * (cardWidth + gap);
      doc.setFillColor(245, 248, 244);
      doc.setDrawColor(218, 225, 218);
      doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(doc.splitTextToSize(metric.label, cardWidth - 6).slice(0, 1), x + 3, y + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(35, 45, 35);
      doc.text(doc.splitTextToSize(metric.value, cardWidth - 6).slice(0, 1), x + 3, y + 14);
    });
    y += cardHeight + 3;
  }
  doc.setTextColor(0, 0, 0);
  return y + 1;
}

function drawBarCharts(doc: jsPDF, opts: PdfReportOptions, logo: string | null, startY: number): number {
  const charts = opts.charts ?? [];
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 14;
  const width = pageWidth - 28;
  let y = startY;

  for (const chart of charts) {
    const data = chart.data.filter((item) => Number.isFinite(item.value)).slice(0, chart.maxItems ?? 8);
    const height = 13 + Math.max(data.length, 1) * 8;
    if (y + height > pageHeight - 18) y = addContentPage(doc, opts, logo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(35, 45, 35);
    doc.text(chart.title, left, y + 4);
    y += 8;

    if (data.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("Sin datos para el periodo.", left, y + 3);
      y += 9;
      continue;
    }

    const labelWidth = Math.min(68, width * 0.32);
    const valueWidth = 34;
    const barX = left + labelWidth + 3;
    const barWidth = width - labelWidth - valueWidth - 6;
    const maxValue = Math.max(...data.map((item) => Math.max(0, item.value)), 1);
    data.forEach((item) => {
      const labelLines = doc.splitTextToSize(item.label, labelWidth - 2).slice(0, 2);
      const rowHeight = Math.max(7, labelLines.length * 3.5);
      const baseline = y + Math.min(rowHeight - 1, 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(55, 65, 55);
      doc.text(labelLines, left, y + 3);
      doc.setFillColor(239, 243, 239);
      doc.roundedRect(barX, y + 1, barWidth, 4, 1, 1, "F");
      doc.setFillColor(...(chart.color ?? BRAND));
      const fillWidth = Math.max(0, Math.min(barWidth, (item.value / maxValue) * barWidth));
      if (fillWidth > 0) doc.roundedRect(barX, y + 1, fillWidth, 4, 1, 1, "F");
      doc.setTextColor(...MUTED);
      doc.text(chart.valueFormatter?.(item.value) ?? item.value.toLocaleString("es-CO"), left + width, baseline, { align: "right" });
      y += rowHeight;
    });
    y += 4;
  }
  doc.setTextColor(0, 0, 0);
  return y;
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
    const left = `SIGIC • ${templateLabel(opts.template)}${opts.author ? ` • ${opts.author}` : ""}`;
    const right = `Página ${i} de ${pageCount}`;
    const mid = `Generado ${format(new Date(), "yyyy-MM-dd HH:mm")}`;
    doc.text(left, 14, h - 7);
    doc.text(mid, w / 2, h - 7, { align: "center" });
    doc.text(right, w - 14, h - 7, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }
}

export async function generatePdfReport(opts: PdfReportOptions): Promise<jsPDF> {
  const [jspdfModule, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const jsPDFClass = (jspdfModule as any).jsPDF || (jspdfModule as any).default?.jsPDF || jspdfModule.default;
  const autoTable = (autoTableModule as any).default || autoTableModule;
  const doc = new jsPDFClass({
    orientation: opts.orientation ?? "landscape",
    unit: "mm",
    format: "a4",
  });
  const logo = await loadLogo();
  drawHeader(doc, opts, logo);

  let y = drawFilters(doc, opts, opts.subtitle ? 44 : 40);
  y = drawSummary(doc, opts, logo, y);
  y = drawBarCharts(doc, opts, logo, y);

  for (const section of opts.sections) {
    if (section.title) {
      if (y > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        drawHeader(doc, opts, logo);
        y = 40;
      }
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
      didDrawPage: () => {
        drawHeader(doc, opts, logo);
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  drawFooter(doc, opts);
  return doc;
}
