import type jsPDF from "jspdf";
import { format } from "date-fns";

export type PdfReportTemplate = "actividades" | "parcelas" | "resumen";

export interface PdfSection {
  title?: string;
  head?: string[];
  body: (string | number)[][];
  columnStyles?: Record<number, { cellWidth?: number | "auto"; halign?: "left" | "center" | "right" }>;
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
  includeSignatures?: boolean;
}

// Paleta institucional ejecutiva SIGIC
const BRAND_DARK: [number, number, number] = [20, 62, 43];
const BRAND_PRIMARY: [number, number, number] = [30, 86, 59];
const ACCENT_GOLD: [number, number, number] = [208, 162, 58];
const INK_DARK: [number, number, number] = [28, 38, 32];
const INK_BODY: [number, number, number] = [52, 64, 56];
const INK_MUTED: [number, number, number] = [104, 116, 108];
const SURFACE_CARD: [number, number, number] = [249, 251, 249];
const SURFACE_ZEBRA: [number, number, number] = [244, 248, 245];
const BORDER_SUBTLE: [number, number, number] = [218, 227, 220];

const STATUS_GREEN: [number, number, number] = [21, 115, 71];
const STATUS_AMBER: [number, number, number] = [180, 83, 9];
const STATUS_RED: [number, number, number] = [185, 28, 28];
const STATUS_BLUE: [number, number, number] = [29, 78, 216];

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

/**
 * Normaliza caracteres Unicode fuera de WinAnsiEncoding (ISO-8859-1) para que la fuente
 * estándar Helvetica de jsPDF jamás pinte símbolos corruptos ni desalinee anchos.
 */
export function sanitizePdfText(raw: unknown): string {
  if (raw === null || raw === undefined) return "-";
  return String(raw)
    .replace(/⚠️|⚠/g, "[ALERTA]")
    .replace(/✅|✓|✔/g, "[OK]")
    .replace(/❄️|❄/g, "[HELADA]")
    .replace(/🌧️|🌧/g, "[LLUVIA]")
    .replace(/[—–]/g, "-")
    .replace(/[•·]/g, "|")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    // Elimina pares subrogados / emojis restantes fuera de Latin-1 conservando tildes, ñ, °, ², ³
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function templateLabel(t: PdfReportTemplate): string {
  return {
    actividades: "BITACORA TECNICA DE CAMPO",
    parcelas: "CATASTRO E INVENTARIO DE PARCELAS",
    resumen: "INFORME EJECUTIVO AGROPECUARIO",
  }[t];
}

function buildFolioCode(): string {
  const datePart = format(new Date(), "yyyyMMdd");
  const timePart = format(new Date(), "HHmm");
  return `SIGIC-${datePart}-${timePart}`;
}

/** Encabezado principal ejecutivo (solo Página 1) */
function drawCoverHeader(
  doc: jsPDF,
  opts: PdfReportOptions,
  logoDataUrl: string | null,
  folio: string
): number {
  const w = doc.internal.pageSize.getWidth();

  // Banda institucional verde bosque profundo + filete dorado inferior
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, w, 26, "F");
  doc.setFillColor(...ACCENT_GOLD);
  doc.rect(0, 26, w, 1.4, "F");

  // Contenedor blanco redondeado para resaltar el logo institucional
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 4.5, 17, 17, 2.5, 2.5, "F");
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 15.5, 6, 14, 14);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...BRAND_DARK);
      doc.text("SIGIC", 22.5, 14.5, { align: "center" });
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND_DARK);
    doc.text("SIGIC", 22.5, 14.5, { align: "center" });
  }

  // Identidad institucional izquierda
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text("SIGIC - Sistema Inteligente de Gestion Integral de Cultivos", 35, 11.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(212, 232, 220);
  doc.text(templateLabel(opts.template), 35, 17.5);

  // Caja de metadatos de control documental a la derecha
  const metaRightX = w - 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`FOLIO: ${folio}`, metaRightX, 9.5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(218, 235, 224);
  doc.text(`Emision: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, metaRightX, 14.5, { align: "right" });
  if (opts.author) {
    const cleanAuthor = sanitizePdfText(opts.author).slice(0, 38);
    doc.text(`Titular / Autor: ${cleanAuthor}`, metaRightX, 19.5, { align: "right" });
  }

  // Bloque de Título Principal del Reporte sobre fondo limpio
  let y = 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...INK_DARK);
  const titleLines = doc.splitTextToSize(sanitizePdfText(opts.title), w - 28).slice(0, 2);
  doc.text(titleLines, 14, y);
  y += titleLines.length * 6;

  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK_MUTED);
    const subLines = doc.splitTextToSize(sanitizePdfText(opts.subtitle), w - 28).slice(0, 2);
    doc.text(subLines, 14, y);
    y += subLines.length * 4.5 + 1;
  }

  // Línea divisoria sutil bajo el encabezado de portada
  doc.setDrawColor(...BORDER_SUBTLE);
  doc.setLineWidth(0.35);
  doc.line(14, y + 1, w - 14, y + 1);

  return y + 5;
}

/** Encabezado compacto para páginas de continuación (Página 2 en adelante — cero solapamiento con tablas) */
function drawContinuationHeader(
  doc: jsPDF,
  opts: PdfReportOptions,
  logoDataUrl: string | null,
  folio: string
) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, w, 13.5, "F");
  doc.setFillColor(...ACCENT_GOLD);
  doc.rect(0, 13.5, w, 0.9, "F");

  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, 2.2, 9, 9, 1.5, 1.5, "F");
      doc.addImage(logoDataUrl, "PNG", 14.8, 3, 7.4, 7.4);
    } catch {
      /* noop */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  const shortTitle = sanitizePdfText(opts.title).slice(0, 68);
  doc.text(`SIGIC  |  ${shortTitle}`, logoDataUrl ? 26 : 14, 8.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(215, 232, 222);
  doc.text(`Folio ${folio}`, w - 14, 8.5, { align: "right" });
  doc.setTextColor(...INK_DARK);
}

function addContinuationPage(
  doc: jsPDF,
  opts: PdfReportOptions,
  logo: string | null,
  folio: string
): number {
  doc.addPage();
  drawContinuationHeader(doc, opts, logo, folio);
  return 21;
}

function drawFilters(doc: jsPDF, opts: PdfReportOptions, startY: number): number {
  if (!opts.filters || Object.keys(opts.filters).length === 0) return startY;
  const entries = Object.entries(opts.filters).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return startY;

  const w = doc.internal.pageSize.getWidth();
  const text = entries
    .map(([k, v]) => `${sanitizePdfText(k)}: ${sanitizePdfText(v || "Todos")}`)
    .join("   |   ");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const lines = doc.splitTextToSize(`Parametros aplicados ->  ${text}`, w - 34);
  const boxH = lines.length * 4 + 4;

  doc.setFillColor(...SURFACE_ZEBRA);
  doc.setDrawColor(...BORDER_SUBTLE);
  doc.setLineWidth(0.25);
  doc.roundedRect(14, startY, w - 28, boxH, 1.8, 1.8, "FD");

  doc.setTextColor(...INK_BODY);
  doc.text(lines, 17, startY + 4.6);
  doc.setTextColor(...INK_DARK);

  return startY + boxH + 4;
}

function inferMetricAccent(label: string, value: string): [number, number, number] {
  const l = label.toLowerCase();
  const v = value.toLowerCase();
  if (v.startsWith("-$") || v.startsWith("- $") || l.includes("critica") || l.includes("superada")) {
    return STATUS_RED;
  }
  if ((l.includes("stock bajo") || l.includes("alerta") || l.includes("riesgo")) && v !== "0") {
    return STATUS_AMBER;
  }
  if (l.includes("costo") || l.includes("egreso") || l.includes("gasto")) {
    return STATUS_AMBER;
  }
  if (l.includes("ingreso") || l.includes("margen") || l.includes("rentabilidad") || v.startsWith("+")) {
    return STATUS_GREEN;
  }
  return BRAND_PRIMARY;
}

function drawSummaryCards(
  doc: jsPDF,
  metrics: { label: string; value: string }[],
  opts: PdfReportOptions,
  logo: string | null,
  folio: string,
  startY: number
): number {
  if (metrics.length === 0) return startY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const columns = Math.min(4, Math.max(2, metrics.length));
  const gap = 3.5;
  const cardWidth = (pageWidth - 28 - gap * (columns - 1)) / columns;
  const cardHeight = 20;
  let y = startY;

  for (let index = 0; index < metrics.length; index += columns) {
    if (y + cardHeight > pageHeight - 24) {
      y = addContinuationPage(doc, opts, logo, folio);
    }
    const row = metrics.slice(index, index + columns);
    row.forEach((metric, colIdx) => {
      const x = 14 + colIdx * (cardWidth + gap);
      const cleanLabel = sanitizePdfText(metric.label).toUpperCase();
      const cleanVal = sanitizePdfText(metric.value);
      const accent = inferMetricAccent(cleanLabel, cleanVal);

      // Tarjeta ejecutiva con barra lateral de acento semántico
      doc.setFillColor(...SURFACE_CARD);
      doc.setDrawColor(...BORDER_SUBTLE);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");

      doc.setFillColor(...accent);
      doc.roundedRect(x, y, 2.2, cardHeight, 1, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...INK_MUTED);
      const labelLine = doc.splitTextToSize(cleanLabel, cardWidth - 8)[0] ?? cleanLabel;
      doc.text(labelLine, x + 5, y + 6.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...(accent === STATUS_RED ? STATUS_RED : INK_DARK));
      const valLine = doc.splitTextToSize(cleanVal, cardWidth - 8)[0] ?? cleanVal;
      doc.text(valLine, x + 5, y + 14.8);
    });
    y += cardHeight + 3.5;
  }

  doc.setTextColor(...INK_DARK);
  return y + 2;
}

function drawBarCharts(
  doc: jsPDF,
  opts: PdfReportOptions,
  logo: string | null,
  folio: string,
  startY: number
): number {
  const charts = opts.charts ?? [];
  if (charts.length === 0) return startY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 14;
  const boxWidth = pageWidth - 28;
  let y = startY;

  for (const chart of charts) {
    const data = chart.data
      .filter((item) => Number.isFinite(item.value) && item.value >= 0)
      .slice(0, chart.maxItems ?? 8);

    const nonZeroTotal = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
    const cardH = data.length === 0 ? 20 : 14 + data.length * 7.2 + 3;

    if (y + cardH > pageHeight - 24) {
      y = addContinuationPage(doc, opts, logo, folio);
    }

    // Contenedor enmarcado para la gráfica
    doc.setFillColor(...SURFACE_CARD);
    doc.setDrawColor(...BORDER_SUBTLE);
    doc.setLineWidth(0.3);
    doc.roundedRect(left, y, boxWidth, cardH, 2, 2, "FD");

    // Encabezado de gráfica
    doc.setFillColor(...SURFACE_ZEBRA);
    doc.roundedRect(left, y, boxWidth, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(...BRAND_DARK);
    doc.text(sanitizePdfText(chart.title), left + 4, y + 6);

    let rowY = y + 13;
    if (data.length === 0 || nonZeroTotal === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...INK_MUTED);
      doc.text("Sin registros cuantificables en el periodo seleccionado.", left + 4, rowY + 2);
      y += cardH + 4;
      continue;
    }

    const labelWidth = Math.min(64, boxWidth * 0.28);
    const valueWidth = 46;
    const barX = left + labelWidth + 6;
    const barMaxW = Math.max(30, boxWidth - labelWidth - valueWidth - 12);
    const maxVal = Math.max(...data.map((item) => item.value), 1);
    const barColor = chart.color ?? BRAND_PRIMARY;

    data.forEach((item) => {
      const cleanLbl = sanitizePdfText(item.label);
      const shortLbl = doc.splitTextToSize(cleanLbl, labelWidth)[0] ?? cleanLbl;
      const pct = nonZeroTotal > 0 ? Math.round((item.value / nonZeroTotal) * 100) : 0;
      const formattedVal = sanitizePdfText(
        chart.valueFormatter?.(item.value) ?? item.value.toLocaleString("es-CO")
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...INK_BODY);
      doc.text(shortLbl, left + 4, rowY + 3.2);

      // Pista de fondo + barra proporcional
      doc.setFillColor(232, 238, 234);
      doc.roundedRect(barX, rowY + 0.4, barMaxW, 3.8, 1, 1, "F");

      const fillW = Math.max(item.value > 0 ? 1.8 : 0, (item.value / maxVal) * barMaxW);
      if (fillW > 0) {
        doc.setFillColor(...barColor);
        doc.roundedRect(barX, rowY + 0.4, Math.min(barMaxW, fillW), 3.8, 1, 1, "F");
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...INK_DARK);
      doc.text(`${formattedVal} (${pct}%)`, left + boxWidth - 4, rowY + 3.2, { align: "right" });

      rowY += 7.2;
    });

    y += cardH + 4.5;
  }

  doc.setTextColor(...INK_DARK);
  return y;
}

function isNumericOrCurrencyHeader(headerText: string): boolean {
  const h = headerText.toLowerCase();
  return (
    h.includes("costo") ||
    h.includes("ingreso") ||
    h.includes("margen") ||
    h.includes("valor") ||
    h.includes("total") ||
    h.includes("stock") ||
    h.includes("cantidad") ||
    h.includes("area") ||
    h.includes("área") ||
    h.includes("cosecha") && !h.includes("fecha") && !h.includes("estimada") ||
    h.includes("actividades") ||
    h.includes("incidencias")
  );
}

function isNumericLikeCell(text: string): boolean {
  return /^([+-]?\s*\$\s*[\d.,]+|[+-]?[\d.,]+\s*(%|ha|m2|kg|l|un|ton|saco|dias|días)?)$/i.test(
    text.trim()
  );
}

function drawSignatureBlock(
  doc: jsPDF,
  opts: PdfReportOptions,
  logo: string | null,
  folio: string,
  startY: number
) {
  if (opts.includeSignatures === false) return;

  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  let y = startY + 6;

  if (y + 26 > h - 22) {
    y = addContinuationPage(doc, opts, logo, folio) + 8;
  }

  const colW = Math.min(78, (w - 48) / 2);
  const leftX = 22;
  const rightX = w - 22 - colW;

  doc.setDrawColor(160, 175, 165);
  doc.setLineWidth(0.35);
  doc.line(leftX, y + 12, leftX + colW, y + 12);
  doc.line(rightX, y + 12, rightX + colW, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK_DARK);
  doc.text(
    opts.author ? sanitizePdfText(opts.author) : "Productor / Responsable Operativo",
    leftX + colW / 2,
    y + 16.5,
    { align: "center" }
  );
  doc.text("Revision / Aval Tecnico Agronomo", rightX + colW / 2, y + 16.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_MUTED);
  doc.text("Titular del registro en SIGIC", leftX + colW / 2, y + 20.5, { align: "center" });
  doc.text("Firma y matricula profesional (si aplica)", rightX + colW / 2, y + 20.5, { align: "center" });
}

function drawFooter(doc: jsPDF, opts: PdfReportOptions, folio: string) {
  const pageCount = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND_PRIMARY);
    doc.setLineWidth(0.4);
    doc.line(14, h - 13, w - 14, h - 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK_MUTED);
    const leftText = `SIGIC - ${templateLabel(opts.template)}  |  Folio ${folio}`;
    doc.text(leftText, 14, h - 8);

    // Píldora de paginación limpia a la derecha (nunca choca en vertical ni horizontal)
    const pageStr = `Pagina ${i} de ${pageCount}`;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_DARK);
    doc.text(pageStr, w - 14, h - 8, { align: "right" });
  }
  doc.setTextColor(...INK_DARK);
}

export async function generatePdfReport(opts: PdfReportOptions): Promise<jsPDF> {
  const [jspdfModule, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const jsPDFClass =
    (jspdfModule as any).jsPDF || (jspdfModule as any).default?.jsPDF || jspdfModule.default;
  const autoTable = (autoTableModule as any).default || autoTableModule;

  const doc = new jsPDFClass({
    orientation: opts.orientation ?? "landscape",
    unit: "mm",
    format: "a4",
  });

  const folio = buildFolioCode();
  const logo = await loadLogo();

  // Si el reporte no pasó tarjetas summary pero su primera sección es una tabla pequeña Indicador/Valor,
  // la promovemos automáticamente a tarjetas KPI ejecutivas para un acabado visual superior.
  let effectiveSummary = [...(opts.summary ?? [])];
  let effectiveSections = [...opts.sections];

  if (
    effectiveSummary.length === 0 &&
    effectiveSections.length > 1 &&
    effectiveSections[0].head?.length === 2 &&
    effectiveSections[0].body.length > 0 &&
    effectiveSections[0].body.length <= 6
  ) {
    effectiveSummary = effectiveSections[0].body.map((r) => ({
      label: String(r[0] ?? ""),
      value: String(r[1] ?? ""),
    }));
    effectiveSections = effectiveSections.slice(1);
  }

  let y = drawCoverHeader(doc, opts, logo, folio);
  y = drawFilters(doc, opts, y);
  y = drawSummaryCards(doc, effectiveSummary, opts, logo, folio, y);
  y = drawBarCharts(doc, opts, logo, folio, y);

  for (const section of effectiveSections) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    if (section.title) {
      if (y > pageHeight - 42) {
        y = addContinuationPage(doc, opts, logo, folio);
      }
      // Barra de acento vertical + título de sección limpio
      doc.setFillColor(...BRAND_PRIMARY);
      doc.roundedRect(14, y, 2.2, 5.5, 0.6, 0.6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK_DARK);
      doc.text(sanitizePdfText(section.title), 18.5, y + 4.3);

      doc.setDrawColor(...BORDER_SUBTLE);
      doc.setLineWidth(0.25);
      doc.line(14, y + 7, pageWidth - 14, y + 7);
      y += 9.5;
    }

    const sanitizedHead = section.head
      ? [section.head.map((h) => sanitizePdfText(h))]
      : undefined;
    const sanitizedBody =
      section.body.length > 0
        ? section.body.map((row) => row.map((cell) => sanitizePdfText(cell)))
        : [
            [
              sanitizedHead?.[0]
                ? "Sin registros disponibles para esta seccion."
                : "Sin datos.",
            ],
          ];

    const numericColIndexes = new Set<number>();
    if (sanitizedHead?.[0]) {
      sanitizedHead[0].forEach((hText, colIdx) => {
        if (isNumericOrCurrencyHeader(hText)) numericColIndexes.add(colIdx);
      });
    }

    autoTable(doc, {
      startY: y,
      head: sanitizedHead,
      body: sanitizedBody,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8.3,
        cellPadding: { top: 2.8, right: 3, bottom: 2.8, left: 3 },
        textColor: INK_BODY,
        lineColor: BORDER_SUBTLE,
        lineWidth: 0.2,
        valign: "middle",
      },
      headStyles: {
        fillColor: BRAND_PRIMARY,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.3,
        lineColor: BRAND_DARK,
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: SURFACE_ZEBRA,
      },
      columnStyles: section.columnStyles as any,
      // Margen superior reservado (20mm) para que las páginas 2+ jamás pisen el encabezado de continuación
      margin: { top: 20, left: 14, right: 14, bottom: 20 },
      didParseCell: (hookData: any) => {
        const colIdx = hookData.column.index as number;
        const cellText = String(hookData.cell.raw ?? "");

        // Alineación numérica automática en encabezados y celdas de moneda / cantidades
        if (numericColIndexes.has(colIdx) || (hookData.section === "body" && isNumericLikeCell(cellText))) {
          hookData.cell.styles.halign = "right";
        }

        // Semántica visual de estados, alertas y márgenes en celdas del cuerpo
        if (hookData.section === "body") {
          const upper = cellText.toUpperCase();
          if (
            upper.includes("CRITICA") ||
            upper.includes("CRÍTICA") ||
            upper.includes("[ALERTA]") ||
            upper === "ALTA" ||
            cellText.trim().startsWith("-$") ||
            cellText.trim().startsWith("- $")
          ) {
            hookData.cell.styles.textColor = STATUS_RED;
            hookData.cell.styles.fontStyle = "bold";
            hookData.cell.styles.fillColor = [254, 242, 242];
          } else if (
            upper === "OK" ||
            upper.includes("[OK]") ||
            upper === "SALUDABLE" ||
            upper.includes("APROBADO") ||
            cellText.trim().startsWith("+$") ||
            cellText.trim().startsWith("+ $")
          ) {
            hookData.cell.styles.textColor = STATUS_GREEN;
            hookData.cell.styles.fontStyle = "bold";
          } else if (upper === "MEDIA" || upper === "PENDIENTE" || upper.includes("BAJO")) {
            hookData.cell.styles.textColor = STATUS_AMBER;
            hookData.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawPage: (hookData: any) => {
        // IMPORTANTE: solo pintar encabezado compacto en páginas > 1 (la página 1 ya tiene portada ejecutiva)
        if (hookData.pageNumber > 1) {
          drawContinuationHeader(doc, opts, logo, folio);
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  drawSignatureBlock(doc, opts, logo, folio, y);
  drawFooter(doc, opts, folio);
  return doc;
}
