import type jsPDF from "jspdf";
import { format } from "date-fns";
import { fetchOrgBranding } from "@/lib/org-branding";
import { sanitizePdfText } from "@/lib/pdf-report";
import { formatCurrencyInt } from "@/lib/currency";

export interface LaborLogPdfItem {
  id?: string;
  worker_name: string;
  task_kind: string;
  payment_mode: string;
  units_worked: number;
  rate_cop: number;
  total_cop: number;
  work_date: string;
  paid: boolean;
  notes?: string | null;
  cropName?: string;
  parcelName?: string;
  producerName?: string;
}

async function loadPdfEngines() {
  const [jspdfModule, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const jsPDFClass =
    (jspdfModule as any).jsPDF || (jspdfModule as any).default?.jsPDF || jspdfModule.default;
  const autoTable = (autoTableModule as any).default || autoTableModule;
  return { jsPDFClass, autoTable };
}

async function loadPublicSigicLogo(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(`${window.location.origin}/sigic-logo.png`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawInstitutionalBanner(
  doc: jsPDF,
  sigicLogo: string | null,
  orgName: string,
  orgNit: string,
  orgMunicipality: string,
  orgLogoUrl: string,
  subtitleLabel: string,
  folio: string
) {
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(20, 62, 43);
  doc.rect(0, 0, w, 25, "F");
  doc.setFillColor(208, 162, 58);
  doc.rect(0, 25, w, 1.3, "F");

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 4, 17, 17, 2, 2, "F");
  if (sigicLogo) {
    try {
      doc.addImage(sigicLogo, "PNG", 15.5, 5.5, 14, 14);
    } catch {
      doc.setTextColor(20, 62, 43);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("SIGIC", 22.5, 14, { align: "center" });
    }
  } else {
    doc.setTextColor(20, 62, 43);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("SIGIC", 22.5, 14, { align: "center" });
  }

  let textX = 35;
  if (orgLogoUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(33, 4, 17, 17, 2, 2, "F");
      const fmt = orgLogoUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(orgLogoUrl, fmt, 34.5, 5.5, 14, 14);
      textX = 54;
    } catch {
      /* ignore invalid custom logo */
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  const titleHeader = orgName
    ? sanitizePdfText(`SIGIC | ${orgName}`).slice(0, 58)
    : "SIGIC - Gestion de Mano de Obra y Nomina Rural";
  doc.text(titleHeader, textX, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(214, 234, 222);
  const subParts = [
    subtitleLabel,
    orgNit ? `NIT ${orgNit}` : "",
    orgMunicipality || "",
  ]
    .filter(Boolean)
    .join("  |  ");
  doc.text(sanitizePdfText(subParts).slice(0, 75), textX, 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`COMPROBANTE: ${folio}`, w - 14, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(218, 235, 224);
  doc.text(`Emision: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, w - 14, 16, { align: "right" });
}

/**
 * Genera un Comprobante / Recibo Individual de Pago firmable para un jornalero o recolector
 */
export async function exportWorkerVoucherPdf(item: LaborLogPdfItem): Promise<void> {
  const [{ jsPDFClass, autoTable }, sigicLogo, org] = await Promise.all([
    loadPdfEngines(),
    loadPublicSigicLogo(),
    fetchOrgBranding(),
  ]);

  const doc: jsPDF = new jsPDFClass({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const folio = `REC-${format(new Date(), "yyyyMMdd")}-${String(item.id ?? Math.floor(1000 + Math.random() * 9000)).slice(0, 6).toUpperCase()}`;

  drawInstitutionalBanner(
    doc,
    sigicLogo,
    org.orgName,
    org.orgNit,
    org.orgMunicipality,
    org.orgLogoUrl,
    "COMPROBANTE INDIVIDUAL DE LIQUIDACION RURAL",
    folio
  );

  doc.setTextColor(28, 38, 32);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("RECIBO DE PAGO DE JORNAL / DESTAJO AGRICOLA", 14, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 102, 94);
  doc.text(
    sanitizePdfText(
      `Unidad Productiva: ${item.producerName || org.orgName || "Finca Registrada en SIGIC"}  |  Estado: ${item.paid ? "PAGADO" : "PENDIENTE DE PAGO"}`
    ),
    14,
    42
  );

  const unitLabel = item.payment_mode === "JORNAL_DIA" ? "Jornal(es) / Dia" : "Kilogramos (KG)";

  autoTable(doc, {
    startY: 48,
    margin: { left: 14, right: 14 },
    theme: "grid",
    head: [["CONCEPTO", "DETALLE DE LIQUIDACION"]],
    body: [
      ["Trabajador / Beneficiario", sanitizePdfText(item.worker_name)],
      ["Fecha de Ejecucion", sanitizePdfText(item.work_date)],
      ["Cultivo y Lote", sanitizePdfText(`${item.cropName || "Cultivo"} - ${item.parcelName || "Parcela"}`)],
      ["Labor Realizada", sanitizePdfText(item.task_kind.replace(/_/g, " "))],
      ["Modalidad de Contratacion", item.payment_mode === "JORNAL_DIA" ? "Jornal por Dia" : "Recoleccion al Destajo (Peso)"],
      ["Cantidad Trabajada", `${Number(item.units_worked).toLocaleString("es-CO")} ${unitLabel}`],
      ["Tarifa Unitaria Acordada", sanitizePdfText(formatCurrencyInt(Number(item.rate_cop)))],
      ["VALOR TOTAL A LIQUIDAR", sanitizePdfText(formatCurrencyInt(Number(item.total_cop)))],
      ["Observaciones", sanitizePdfText(item.notes || "Labor recibida a satisfaccion en campo.")],
    ],
    headStyles: {
      fillColor: [30, 86, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.8,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3.2,
      textColor: [35, 45, 38],
    },
    columnStyles: {
      0: { cellWidth: 62, fontStyle: "bold", fillColor: [244, 248, 245] },
    },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.row.index === 7) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fontSize = 10.5;
        hookData.cell.styles.textColor = [20, 83, 45];
      }
    },
  });

  const finalY = ((doc as any).lastAutoTable?.finalY ?? 135) + 22;

  // Bloque formal de doble firma con C.C. y huella
  doc.setDrawColor(140, 155, 145);
  doc.setLineWidth(0.35);
  doc.line(18, finalY, 92, finalY);
  doc.line(w - 92, finalY, w - 18, finalY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(28, 38, 32);
  doc.text(sanitizePdfText(item.producerName || org.orgName || "Empleador / Administrador"), 55, finalY + 5, {
    align: "center",
  });
  doc.text(sanitizePdfText(item.worker_name), w - 55, finalY + 5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(104, 116, 108);
  doc.text("Entregue Conforme (Responsable de Finca)", 55, finalY + 9.5, { align: "center" });
  doc.text("Recibi Conforme - Firma y C.C. del Trabajador", w - 55, finalY + 9.5, { align: "center" });

  doc.save(
    `Recibo-Jornal-${sanitizePdfText(item.worker_name).replace(/\s+/g, "_")}-${item.work_date}.pdf`
  );
}

/**
 * Genera la Planilla Consolidada de Cuadrilla en PDF Horizontal con columna física de Firma / Recibido
 * lista para llevar impresa al lote el día de pago.
 */
export async function exportCrewPayrollSheetPdf(
  rows: LaborLogPdfItem[],
  filterTitle = "Planilla General de Cuadrilla"
): Promise<void> {
  const [{ jsPDFClass, autoTable }, sigicLogo, org] = await Promise.all([
    loadPdfEngines(),
    loadPublicSigicLogo(),
    fetchOrgBranding(),
  ]);

  const doc: jsPDF = new jsPDFClass({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const folio = `PLA-${format(new Date(), "yyyyMMdd-HHmm")}`;

  drawInstitutionalBanner(
    doc,
    sigicLogo,
    org.orgName,
    org.orgNit,
    org.orgMunicipality,
    org.orgLogoUrl,
    "PLANILLA OFICIAL DE NOMINA Y DESTAJO DE CUADRILLA",
    folio
  );

  const totalAmount = rows.reduce((s, r) => s + Number(r.total_cop || 0), 0);
  const pendingAmount = rows.filter((r) => !r.paid).reduce((s, r) => s + Number(r.total_cop || 0), 0);
  const uniqueWorkers = new Set(rows.map((r) => r.worker_name.toLowerCase())).size;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(28, 38, 32);
  doc.text(sanitizePdfText(filterTitle), 14, 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(95, 108, 98);
  doc.text(
    sanitizePdfText(
      `Trabajadores incluidos: ${uniqueWorkers}   |   Registros: ${rows.length}   |   Total Planilla: ${formatCurrencyInt(totalAmount)}   |   Saldo Pendiente: ${formatCurrencyInt(pendingAmount)}`
    ),
    14,
    39.5
  );

  autoTable(doc, {
    startY: 44,
    margin: { top: 18, left: 14, right: 14, bottom: 18 },
    theme: "grid",
    head: [
      [
        "FECHA",
        "TRABAJADOR / RECOLECTOR",
        "CULTIVO / LOTE",
        "LABOR",
        "CANT.",
        "TARIFA",
        "TOTAL ($ COP)",
        "ESTADO",
        "FIRMA DE RECIBIDO / C.C.",
      ],
    ],
    body: rows.map((r) => [
      sanitizePdfText(r.work_date),
      sanitizePdfText(r.worker_name),
      sanitizePdfText(`${r.cropName || "Cultivo"} (${r.parcelName || "Lote"})`),
      sanitizePdfText(r.task_kind.replace(/_/g, " ")),
      `${Number(r.units_worked).toLocaleString("es-CO")} ${r.payment_mode === "JORNAL_DIA" ? "Jor." : "KG"}`,
      sanitizePdfText(formatCurrencyInt(Number(r.rate_cop))),
      sanitizePdfText(formatCurrencyInt(Number(r.total_cop))),
      r.paid ? "PAGADO" : "PENDIENTE",
      "",
    ]),
    styles: {
      fontSize: 8,
      cellPadding: { top: 3.8, right: 2.5, bottom: 3.8, left: 2.5 },
      valign: "middle",
      lineColor: [210, 220, 212],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [30, 86, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.8,
    },
    alternateRowStyles: {
      fillColor: [246, 249, 246],
    },
    columnStyles: {
      0: { cellWidth: 21 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 25 },
      6: { halign: "right", fontStyle: "bold", cellWidth: 28 },
      7: { halign: "center", cellWidth: 22 },
      8: { cellWidth: 48 },
    },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.column.index === 7) {
        const isPaid = String(hookData.cell.raw) === "PAGADO";
        hookData.cell.styles.textColor = isPaid ? [21, 115, 71] : [180, 83, 9];
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(30, 86, 59);
    doc.setLineWidth(0.35);
    doc.line(14, h - 11, w - 14, h - 11);
    doc.setFontSize(7.5);
    doc.setTextColor(104, 116, 108);
    doc.text(`SIGIC - Planilla Oficial de Mano de Obra  |  Folio ${folio}`, 14, h - 6.5);
    doc.text(`Pagina ${i} de ${pageCount}`, w - 14, h - 6.5, { align: "right" });
  }

  doc.save(`Planilla-Cuadrilla-SIGIC-${format(new Date(), "yyyyMMdd")}.pdf`);
}
