import type jsPDF from "jspdf";

export interface BpaChecklistItemPdf {
  code?: string;
  label: string;
  compliant: boolean;
}

export interface BpaCertificateOptions {
  folio?: string;
  farmName: string;
  producerName: string;
  parcelName: string;
  cropName?: string;
  batchCode?: string;
  score: number;
  approved: boolean;
  evaluatedAt: string;
  validUntil?: string;
  evaluatorName?: string;
  globalGapCertified?: boolean;
  observations?: string;
  organizationName?: string;
  organizationNit?: string;
  organizationLogoUrl?: string;
  qrSvgElement?: SVGSVGElement | null;
  verifyUrl?: string;
  checklist: BpaChecklistItemPdf[];
}

export interface TraceabilityCertificateOptions {
  batchCode: string;
  cropName: string;
  parcelName: string;
  farmName?: string;
  producerName: string;
  locationText?: string;
  harvestDate: string;
  quantityText: string;
  bpaApproved?: boolean;
  globalGapCertified?: boolean;
  phytosanitarySummary?: string;
  organizationLogoUrl?: string;
  qrSvgElement?: SVGSVGElement | null;
  verifyUrl: string;
}

function sanitizeCertText(input: unknown): string {
  return String(input ?? "")
    .replace(/[—–]/g, "-")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•·]/g, "|")
    .replace(/✓|✔|✅/g, "SI")
    .replace(/✗|✘|⚠️|⚠/g, "NO")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function loadImageAsPngDataUrl(
  url?: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!url || typeof window === "undefined") return null;
  try {
    const resolvedUrl = url.startsWith("/") ? `${window.location.origin}${url}` : url;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = resolvedUrl;
    });
    const canvas = document.createElement("canvas");
    const maxDim = 420;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    canvas.width = Math.max(1, Math.round((img.naturalWidth || 200) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || 200) * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  }
}

export async function svgElementToPngDataUrl(
  svgEl?: SVGSVGElement | null,
  sizePx = 360
): Promise<string | null> {
  if (!svgEl || typeof window === "undefined") return null;
  try {
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgEl);
    if (!svgStr.includes("xmlns=")) {
      svgStr = svgStr.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = blobUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = sizePx;
      canvas.height = sizePx;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sizePx, sizePx);
      ctx.drawImage(img, 0, 0, sizePx, sizePx);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    return null;
  }
}

function drawDiplomaticFrame(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Fondo marfil diplomático
  doc.setFillColor(252, 252, 249);
  doc.rect(0, 0, w, h, "F");

  // Marco exterior verde bosque institucional
  doc.setDrawColor(20, 83, 45);
  doc.setLineWidth(1.4);
  doc.rect(8, 8, w - 16, h - 16);

  // Filete interior dorado
  doc.setDrawColor(180, 138, 40);
  doc.setLineWidth(0.5);
  doc.rect(11, 11, w - 22, h - 22);

  // Esquineros ornamentales
  const corners = [
    [11, 11, 1, 1],
    [w - 11, 11, -1, 1],
    [11, h - 11, 1, -1],
    [w - 11, h - 11, -1, -1],
  ];
  doc.setDrawColor(20, 83, 45);
  doc.setLineWidth(0.8);
  for (const [cx, cy, dx, dy] of corners) {
    doc.line(cx, cy + dy * 5, cx + dx * 5, cy + dy * 5);
    doc.line(cx + dx * 5, cy, cx + dx * 5, cy + dy * 5);
  }
}

function drawGoldVerificationSeal(
  doc: jsPDF,
  centerX: number,
  centerY: number,
  topLabel: string,
  mainLabel: string,
  subLabel: string,
  approved = true
) {
  doc.setFillColor(approved ? 20 : 153, approved ? 83 : 27, approved ? 45 : 27);
  doc.triangle(centerX - 8, centerY + 12, centerX - 2, centerY + 12, centerX - 11, centerY + 26, "F");
  doc.triangle(centerX + 2, centerY + 12, centerX + 8, centerY + 12, centerX + 11, centerY + 26, "F");

  doc.setFillColor(180, 138, 40);
  doc.circle(centerX, centerY, 16.5, "F");

  doc.setFillColor(255, 255, 255);
  doc.circle(centerX, centerY, 14.6, "F");

  doc.setFillColor(approved ? 20 : 180, approved ? 83 : 83, approved ? 45 : 9);
  doc.circle(centerX, centerY, 13.4, "F");

  doc.setDrawColor(234, 197, 94);
  doc.setLineWidth(0.45);
  doc.circle(centerX, centerY, 11.8, "S");

  doc.setTextColor(254, 243, 199);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.text(sanitizeCertText(topLabel), centerX, centerY - 5.2, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.8);
  doc.text(sanitizeCertText(mainLabel), centerX, centerY + 0.8, { align: "center" });

  doc.setTextColor(234, 197, 94);
  doc.setFontSize(5.4);
  doc.text(sanitizeCertText(subLabel), centerX, centerY + 5.8, { align: "center" });
}

function drawHeaderLogos(
  doc: jsPDF,
  sigicLogo: { dataUrl: string; width: number; height: number } | null,
  orgLogo: { dataUrl: string; width: number; height: number } | null,
  rightBadgeTitle: string,
  rightBadgeSubtitle: string,
  folio: string
) {
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(20, 83, 45);
  doc.roundedRect(15, 15, w - 30, 26, 2.5, 2.5, "F");

  // Contenedor blanco para Logo Oficial SIGIC
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(18, 17.5, 22, 21, 2, 2, "F");
  if (sigicLogo) {
    const ratio = Math.min(18 / sigicLogo.width, 17 / sigicLogo.height);
    const lw = sigicLogo.width * ratio;
    const lh = sigicLogo.height * ratio;
    doc.addImage(sigicLogo.dataUrl, "PNG", 18 + (22 - lw) / 2, 17.5 + (21 - lh) / 2, lw, lh);
  } else {
    doc.setTextColor(20, 83, 45);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("SIGIC", 29, 29.5, { align: "center" });
  }

  let textStartX = 44;
  if (orgLogo) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(42, 17.5, 22, 21, 2, 2, "F");
    const ratio = Math.min(18 / orgLogo.width, 17 / orgLogo.height);
    const lw = orgLogo.width * ratio;
    const lh = orgLogo.height * ratio;
    doc.addImage(orgLogo.dataUrl, "PNG", 42 + (22 - lw) / 2, 17.5 + (21 - lh) / 2, lw, lh);
    textStartX = 68;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SIGIC - SISTEMA INTEGRAL DE GESTION DE CULTIVOS", textStartX, 24.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(220, 252, 231);
  doc.text("Plataforma de Trazabilidad Agricola, Sanidad Vegetal y Aseguramiento BPA", textStartX, 30);

  doc.setTextColor(253, 230, 138);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(`FOLIO OFICIAL: ${sanitizeCertText(folio)}`, textStartX, 35.8);

  // Emblema normativo derecho
  doc.setFillColor(254, 249, 195);
  doc.setDrawColor(180, 138, 40);
  doc.setLineWidth(0.5);
  doc.roundedRect(w - 57, 17.5, 39, 21, 2, 2, "FD");

  doc.setTextColor(20, 83, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(sanitizeCertText(rightBadgeTitle), w - 37.5, 25.5, { align: "center" });

  doc.setTextColor(146, 64, 14);
  doc.setFontSize(6.5);
  doc.text(sanitizeCertText(rightBadgeSubtitle), w - 37.5, 32.5, { align: "center" });
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

export async function exportBpaCertificatePdf(opts: BpaCertificateOptions): Promise<void> {
  const [{ jsPDFClass, autoTable }, sigicLogo, orgLogo, qrPng] = await Promise.all([
    loadPdfEngines(),
    loadImageAsPngDataUrl("/sigic-logo.png"),
    loadImageAsPngDataUrl(opts.organizationLogoUrl),
    svgElementToPngDataUrl(opts.qrSvgElement),
  ]);

  const doc: jsPDF = new jsPDFClass({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  const folio =
    opts.folio ||
    `BPA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

  drawDiplomaticFrame(doc);
  drawHeaderLogos(
    doc,
    sigicLogo,
    orgLogo,
    opts.globalGapCertified ? "GLOBALG.A.P." : "NORMA BPA",
    opts.approved ? "CERTIFICADO ACTIVO" : "ACTA DE AUDITORIA",
    folio
  );

  doc.setTextColor(146, 64, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("CERTIFICADO Y CONSTANCIA DE AUDITORIA FITOSANITARIA E INOCUIDAD", w / 2, 53, {
    align: "center",
  });

  doc.setTextColor(20, 83, 45);
  doc.setFontSize(18.5);
  doc.text(
    opts.approved
      ? "CERTIFICADO DE BUENAS PRACTICAS AGRICOLAS"
      : "INFORME OFICIAL DE EVALUACION BPA",
    w / 2,
    63,
    { align: "center" }
  );

  doc.setDrawColor(180, 138, 40);
  doc.setLineWidth(0.6);
  doc.line(42, 67.5, w - 42, 67.5);

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Se otorga y certifica que la unidad productiva detallada a continuacion:", w / 2, 76, {
    align: "center",
  });

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(22, 81, w - 44, 24, 2.5, 2.5, "FD");

  doc.setTextColor(20, 83, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15.5);
  doc.text(sanitizeCertText(opts.farmName || opts.producerName).toUpperCase(), w / 2, 91.5, {
    align: "center",
  });

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  const titularLine = opts.organizationName
    ? `Titular: ${opts.producerName}  |  Asociacion: ${opts.organizationName}${opts.organizationNit ? ` (NIT ${opts.organizationNit})` : ""}`
    : `Productor Titular Responsable: ${opts.producerName}`;
  doc.text(sanitizeCertText(titularLine), w / 2, 99.5, { align: "center" });

  autoTable(doc, {
    startY: 112,
    margin: { left: 22, right: 22 },
    theme: "grid",
    head: [["PARAMETRO DE AUDITORIA", "DETALLE VERIFICADO EN CAMPO"]],
    body: [
      ["Parcela / Lote Evaluado", sanitizeCertText(opts.parcelName)],
      ["Cultivo / Especie", sanitizeCertText(opts.cropName || "Produccion Agricola Registrada")],
      ["Codigo de Lote Trazable", sanitizeCertText(opts.batchCode || "Evaluacion general de cultivo")],
      [
        "Puntaje de Cumplimiento BPA",
        `${Math.round(opts.score)}% (${opts.approved ? "APROBADO - Umbral min. 80%" : "CON HALLAZGOS POR CORREGIR"})`,
      ],
      [
        "Estandar de Calidad",
        opts.globalGapCertified ? "Homologado GLOBALG.A.P. + Inocuidad BPA" : "Protocolo Nacional BPA / ICA",
      ],
      [
        "Fecha de Evaluacion y Vigencia",
        `Emitido: ${sanitizeCertText(opts.evaluatedAt)}  |  Vigencia: ${sanitizeCertText(opts.validUntil || "12 meses desde emision")}`,
      ],
    ],
    headStyles: {
      fillColor: [20, 83, 45],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8.8,
      textColor: [30, 41, 59],
      cellPadding: 3.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 62, fillColor: [248, 250, 252] },
    },
  });

  const afterTableY = (doc as any).lastAutoTable?.finalY ?? 175;

  if (opts.observations) {
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    doc.roundedRect(22, afterTableY + 5, w - 44, 18, 2, 2, "FD");
    doc.setTextColor(146, 64, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("CONCEPTO TECNICO Y OBSERVACIONES:", 26, afterTableY + 11);
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "normal");
    const splitObs = doc.splitTextToSize(sanitizeCertText(opts.observations), w - 52);
    doc.text(splitObs.slice(0, 2), 26, afterTableY + 16.5);
  }

  const footerBaseY = 236;

  drawGoldVerificationSeal(
    doc,
    w / 2,
    footerBaseY + 6,
    opts.globalGapCertified ? "GLOBALG.A.P." : "SIGIC BPA",
    opts.approved ? `${Math.round(opts.score)}% OK` : `${Math.round(opts.score)}%`,
    opts.approved ? "VERIFICADO" : "REVISION",
    opts.approved
  );

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.line(22, footerBaseY + 14, 78, footerBaseY + 14);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.text(sanitizeCertText(opts.producerName), 50, footerBaseY + 19, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text("Productor / Titular de la Finca", 50, footerBaseY + 23.5, { align: "center" });

  if (qrPng) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(20, 83, 45);
    doc.roundedRect(w - 50, footerBaseY - 12, 28, 32, 1.8, 1.8, "FD");
    doc.addImage(qrPng, "PNG", w - 48, footerBaseY - 10, 24, 24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(20, 83, 45);
    doc.text("ESCANEAR QR", w - 36, footerBaseY + 17.5, { align: "center" });

    doc.setDrawColor(100, 116, 139);
    doc.line(w - 92, footerBaseY + 14, w - 54, footerBaseY + 14);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(7.8);
    doc.text(sanitizeCertText(opts.evaluatorName || "Direccion Tecnica SIGIC"), w - 73, footerBaseY + 19, {
      align: "center",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text("Ing. Agronomo / Evaluador BPA", w - 73, footerBaseY + 23.5, { align: "center" });
  } else {
    doc.setDrawColor(100, 116, 139);
    doc.line(w - 78, footerBaseY + 14, w - 22, footerBaseY + 14);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.text(sanitizeCertText(opts.evaluatorName || "Direccion Tecnica Agronomica"), w - 50, footerBaseY + 19, {
      align: "center",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text("Evaluador Tecnico / Aval BPA", w - 50, footerBaseY + 23.5, { align: "center" });
  }

  if (opts.verifyUrl) {
    doc.setTextColor(20, 83, 45);
    doc.setFontSize(7);
    doc.text(`Verificacion publica en linea: ${sanitizeCertText(opts.verifyUrl)}`, w / 2, 279, {
      align: "center",
    });
  }

  if (opts.checklist.length > 0) {
    doc.addPage();
    drawDiplomaticFrame(doc);
    drawHeaderLogos(doc, sigicLogo, orgLogo, "ANEXO BPA", `FOLIO ${folio.slice(-8)}`, folio);

    doc.setTextColor(20, 83, 45);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("MATRIZ DETALLADA DE PUNTOS CRITICOS DE INOCUIDAD Y BPA", 18, 51);

    autoTable(doc, {
      startY: 56,
      margin: { left: 18, right: 18 },
      head: [["#", "CRITERIO TECNICO EVALUADO", "ESTADO"]],
      body: opts.checklist.map((item, idx) => [
        item.code || String(idx + 1),
        sanitizeCertText(item.label),
        item.compliant ? "CUMPLE [SI]" : "PENDIENTE [NO]",
      ]),
      headStyles: {
        fillColor: [20, 83, 45],
        textColor: [255, 255, 255],
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8.5,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 16, halign: "center", fontStyle: "bold" },
        2: { cellWidth: 34, halign: "center", fontStyle: "bold" },
      },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.column.index === 2) {
          const val = String(hookData.cell.raw || "");
          hookData.cell.styles.textColor = val.includes("[SI]") ? [21, 128, 61] : [185, 28, 28];
        }
      },
    });
  }

  doc.save(`Certificado-BPA-${sanitizeCertText(opts.parcelName).replace(/\s+/g, "-")}-${folio}.pdf`);
}

export async function exportTraceabilityCertificatePdf(
  opts: TraceabilityCertificateOptions
): Promise<void> {
  const [{ jsPDFClass, autoTable }, sigicLogo, orgLogo, qrPng] = await Promise.all([
    loadPdfEngines(),
    loadImageAsPngDataUrl("/sigic-logo.png"),
    loadImageAsPngDataUrl(opts.organizationLogoUrl),
    svgElementToPngDataUrl(opts.qrSvgElement),
  ]);

  const doc: jsPDF = new jsPDFClass({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  const folio = `TRZ-${sanitizeCertText(opts.batchCode).toUpperCase()}`;
  drawDiplomaticFrame(doc);
  drawHeaderLogos(
    doc,
    sigicLogo,
    orgLogo,
    opts.globalGapCertified ? "GLOBALG.A.P." : "TRAZABILIDAD",
    "ORIGEN VERIFICADO",
    folio
  );

  doc.setTextColor(146, 64, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("PASAPORTE FITOSANITARIO Y CERTIFICADO DE ORIGEN DE COSECHA", w / 2, 54, {
    align: "center",
  });

  doc.setTextColor(20, 83, 45);
  doc.setFontSize(18);
  doc.text(`LOTE CERTIFICADO: ${sanitizeCertText(opts.batchCode)}`, w / 2, 64, {
    align: "center",
  });

  autoTable(doc, {
    startY: 74,
    margin: { left: 22, right: 22 },
    theme: "grid",
    head: [["ATRIBUTO DE TRAZABILIDAD", "INFORMACION REGISTRADA EN CADENA"]],
    body: [
      ["Producto / Cultivo Cosechado", sanitizeCertText(opts.cropName)],
      [
        "Unidad Productiva y Parcela",
        sanitizeCertText(`${opts.farmName ? `${opts.farmName} - ` : ""}${opts.parcelName}`),
      ],
      ["Productor Responsable", sanitizeCertText(opts.producerName)],
      [
        "Ubicacion Geografica",
        sanitizeCertText(opts.locationText || "Colombia - Registro Georreferenciado SIGIC"),
      ],
      ["Fecha de Cosecha / Emision", sanitizeCertText(opts.harvestDate)],
      ["Volumen del Lote", sanitizeCertText(opts.quantityText)],
      [
        "Estatus de Inocuidad",
        opts.globalGapCertified
          ? "Sello GLOBALG.A.P. Certified + Buenas Practicas Agricolas"
          : opts.bpaApproved
            ? "Buenas Practicas Agricolas (BPA) Verificadas"
            : "Trazabilidad Digital Registrada en Campo",
      ],
      [
        "Resumen de Manejo Limpio",
        sanitizeCertText(
          opts.phytosanitarySummary ||
            "Registro verificado de labores culturales, nutricion y respeto de periodos de carencia."
        ),
      ],
    ],
    headStyles: { fillColor: [20, 83, 45], textColor: [255, 255, 255], fontSize: 8.5 },
    bodyStyles: { fontSize: 9, cellPadding: 3.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 62, fillColor: [248, 250, 252] } },
  });

  const boxY = 178;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(20, 83, 45);
  doc.roundedRect(22, boxY, w - 44, 46, 2.5, 2.5, "FD");

  if (qrPng) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(26, boxY + 4, 38, 38, 2, 2, "F");
    doc.addImage(qrPng, "PNG", 28, boxY + 6, 34, 34);
  }

  const infoX = qrPng ? 70 : 28;
  doc.setTextColor(20, 83, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("AUTENTICIDAD VERIFICABLE POR CODIGO QR", infoX, boxY + 13);

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const qrExplain = doc.splitTextToSize(
    `Cualquier comprador, comercializadora o consumidor puede escanear el codigo QR adjunto o consultar ${sanitizeCertText(opts.verifyUrl)} para validar en tiempo real el origen, fecha de cosecha y certificaciones de este lote.`,
    w - infoX - 28
  );
  doc.text(qrExplain, infoX, boxY + 20);

  drawGoldVerificationSeal(
    doc,
    w / 2,
    250,
    "SIGIC QR",
    opts.globalGapCertified ? "GLOBALG.A.P." : "TRAZABLE",
    "AUTENTICO",
    true
  );

  doc.setDrawColor(100, 116, 139);
  doc.line(22, 258, 78, 258);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(sanitizeCertText(opts.producerName), 50, 263, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Productor / Origen del Lote", 50, 267.5, { align: "center" });

  doc.line(w - 78, 258, w - 22, 258);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Plataforma SIGIC Trazabilidad", w - 50, 263, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Sello Digital de Integridad", w - 50, 267.5, { align: "center" });

  doc.save(`Certificado-Trazabilidad-${sanitizeCertText(opts.batchCode)}.pdf`);
}
