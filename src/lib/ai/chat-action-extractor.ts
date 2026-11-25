import { inferCategory } from "@/lib/queries";

export interface CalendarPrefillPayload {
  title: string;
  description: string;
  cropId?: string;
  itemId?: string;
  itemQuery?: string;
  qty?: number;
}

export interface InventoryFilterPayload {
  q?: string;
  category?: string;
  lowStock?: boolean;
  openAdd?: boolean;
  addName?: string;
  addCategory?: string;
  addUnit?: string;
}

export interface ChatQuickAction {
  id: string;
  label: string;
  kind: "calendar" | "inventory" | "prompt";
  badgeText?: string;
  badgeTone?: "ok" | "warn" | "missing";
  calendarPrefill?: CalendarPrefillPayload;
  inventoryFilter?: InventoryFilterPayload;
  payload?: string;
}

export interface InventoryItemSummary {
  id: string;
  name: string;
  unit: string;
  stock_qty: number;
  min_stock?: number;
}

export interface ParcelContextSummary {
  id: string;
  name: string;
  area_m2: number;
  crops?: { id: string; status: string; crop_catalog?: { name?: string } | null }[];
}

export function normalizeSearchText(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_NON_PRODUCT_WORDS = new Set([
  "monitoreo",
  "poda",
  "podas",
  "drenaje",
  "drenajes",
  "riego",
  "desyerbe",
  "cosecha",
  "inspeccion",
  "revision",
  "limpieza",
  "control cultural",
  "mano de obra",
  "etapa",
  "labor",
  "actividad",
]);

function normalizeUnit(rawUnit: string): { unit: string; factorToStandard: number } {
  const u = normalizeSearchText(rawUnit);
  if (u === "g" || u === "gr" || u === "gramos") return { unit: "KG", factorToStandard: 0.001 };
  if (u === "ml" || u === "cc" || u === "cm3") return { unit: "L", factorToStandard: 0.001 };
  if (u === "ton" || u === "t" || u.startsWith("tonelada")) return { unit: "TON", factorToStandard: 1 };
  if (u === "l" || u === "lt" || u.startsWith("litro")) return { unit: "L", factorToStandard: 1 };
  if (u.startsWith("saco") || u.startsWith("bulto")) return { unit: "SACO", factorToStandard: 1 };
  if (u === "gl" || u.startsWith("galon")) return { unit: "GL", factorToStandard: 1 };
  if (u === "un" || u.startsWith("unidad")) return { unit: "UN", factorToStandard: 1 };
  return { unit: "KG", factorToStandard: 1 };
}

function parseDoseCell(doseText: string): { amount: number; unit: string; isPerHectare: boolean } | null {
  const cleaned = doseText.replace(/,/g, ".");
  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:-|a)\s*(\d+(?:\.\d+)?)\s*(kg|g|gr|l|lt|litros?|ml|cc|ton|t|sacos?|bultos?|gl|un)\b/i);
  const singleMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|l|lt|litros?|ml|cc|ton|t|sacos?|bultos?|gl|un)\b/i);

  let rawVal: number | null = null;
  let rawUnit = "KG";

  if (rangeMatch) {
    rawVal = (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2;
    rawUnit = rangeMatch[3];
  } else if (singleMatch) {
    rawVal = Number(singleMatch[1]);
    rawUnit = singleMatch[2];
  }

  if (rawVal === null || !Number.isFinite(rawVal) || rawVal <= 0) return null;
  const { unit, factorToStandard } = normalizeUnit(rawUnit);
  const isPerHectare = /\/\s*ha\b|por\s+hect[aá]rea/i.test(cleaned);
  return {
    amount: Math.round(rawVal * factorToStandard * 100) / 100,
    unit,
    isPerHectare,
  };
}

function cleanMarkdownInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function findBestInventoryMatch(
  candidateName: string,
  inventory: InventoryItemSummary[]
): InventoryItemSummary | null {
  if (!candidateName || !inventory.length) return null;
  const targetNorm = normalizeSearchText(candidateName);
  if (!targetNorm) return null;

  const stopTokens = new Set(["de", "del", "la", "el", "en", "con", "al", "para", "agricola", "foliar", "aplicacion"]);
  const targetTokens = targetNorm.split(" ").filter((t) => t.length >= 3 && !stopTokens.has(t));

  let best: { item: InventoryItemSummary; score: number } | null = null;

  for (const item of inventory) {
    const itemNorm = normalizeSearchText(item.name);
    if (!itemNorm) continue;
    if (itemNorm === targetNorm) return item;

    let score = 0;
    if (itemNorm.includes(targetNorm) || targetNorm.includes(itemNorm)) score += 5;
    for (const tok of targetTokens) {
      if (itemNorm.includes(tok)) score += tok.length >= 4 ? 3 : 1.5;
    }
    if (score >= 3 && (!best || score > best.score)) {
      best = { item, score };
    }
  }

  return best?.item ?? null;
}

function extractShortSearchKeyword(rawProductName: string): string {
  const clean = cleanMarkdownInline(rawProductName)
    .replace(/\([^)]*\)/g, "")
    .replace(/^(aplicaci[oó]n\s+de|uso\s+de|control\s+con|fertilizaci[oó]n\s+con)\s+/i, "")
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(" ").slice(0, 45);
}

export function extractStructuredActionsFromAiReply(params: {
  replyContent: string;
  userPrompt?: string;
  selectedParcel?: ParcelContextSummary | null;
  inventory?: InventoryItemSummary[];
}): ChatQuickAction[] {
  const { replyContent, userPrompt = "", selectedParcel = null, inventory = [] } = params;
  const lines = replyContent.replace(/\r\n/g, "\n").split("\n");

  const steps: string[] = [];
  const warnings: string[] = [];
  const tableInputs: { name: string; doseRaw: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^\d+\.\s+/.test(t) && steps.length < 4) {
      steps.push(cleanMarkdownInline(t));
    } else if (t.startsWith(">")) {
      warnings.push(cleanMarkdownInline(t.replace(/^>\s*/, "")));
    }

    if (
      t.includes("|") &&
      i + 1 < lines.length &&
      lines[i + 1].includes("|") &&
      /^:?-{2,}:?$/.test(
        lines[i + 1]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")[0]
          ?.trim() ?? ""
      )
    ) {
      i += 2;
      while (i < lines.length && lines[i].trim().includes("|")) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => cleanMarkdownInline(c));
        if (cells.length >= 2 && cells[0]) {
          tableInputs.push({ name: cells[0], doseRaw: cells[1] ?? "" });
        }
        i++;
      }
    }
  }

  const concreteInputs = tableInputs.filter((row) => {
    const norm = normalizeSearchText(row.name);
    return Boolean(norm) && !GENERIC_NON_PRODUCT_WORDS.has(norm);
  });

  const primaryInput = concreteInputs[0] ?? null;
  const areaHa = selectedParcel ? Math.max(0.01, Number(selectedParcel.area_m2 || 0) / 10000) : null;
  const activeCrop =
    selectedParcel?.crops?.find((c) =>
      ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO", "PLANEADO"].includes(c.status)
    ) ?? selectedParcel?.crops?.[0];

  const parsedDose = primaryInput ? parseDoseCell(primaryInput.doseRaw) : null;
  let calculatedQty: number | undefined;
  let doseNote = "";

  if (parsedDose) {
    if (parsedDose.isPerHectare && areaHa) {
      calculatedQty = Math.round(parsedDose.amount * areaHa * 100) / 100;
      doseNote = `Dosis ajustada a ${areaHa.toFixed(2)} ha (${selectedParcel?.name}): ${calculatedQty} ${parsedDose.unit} (${parsedDose.amount} ${parsedDose.unit}/ha).`;
    } else {
      calculatedQty = parsedDose.amount;
      doseNote = `Dosis de referencia: ${parsedDose.amount} ${parsedDose.unit}${parsedDose.isPerHectare ? "/ha" : ""}.`;
    }
  }

  const matchedPrimaryInventory = primaryInput
    ? findBestInventoryMatch(primaryInput.name, inventory)
    : null;

  let calendarTitle = "Labor agronómica recomendada";
  if (primaryInput) {
    const shortName = extractShortSearchKeyword(primaryInput.name);
    calendarTitle = selectedParcel
      ? `Aplicación: ${shortName} (${selectedParcel.name})`
      : `Aplicación de ${shortName}`;
  } else if (steps[0]) {
    calendarTitle = steps[0].replace(/^\d+\.\s*/, "").slice(0, 75);
  } else if (userPrompt.trim()) {
    calendarTitle = `Labor: ${userPrompt.trim().slice(0, 65)}`;
  }

  const descParts: string[] = [];
  if (doseNote) descParts.push(doseNote);
  if (steps.length > 0) descParts.push(steps.slice(0, 3).join("\n"));
  if (warnings[0]) descParts.push(warnings[0]);
  const calendarDescription = descParts.join("\n\n").slice(0, 480);

  const actions: ChatQuickAction[] = [
    {
      id: "schedule-calendar",
      label:
        primaryInput && calculatedQty
          ? `Agendar: ${extractShortSearchKeyword(primaryInput.name)} (${calculatedQty} ${parsedDose?.unit ?? ""})`
          : "Agendar labor en Calendario",
      kind: "calendar",
      calendarPrefill: {
        title: calendarTitle.slice(0, 140),
        description: calendarDescription,
        cropId: activeCrop?.id,
        itemId: matchedPrimaryInventory?.id,
        itemQuery: primaryInput ? extractShortSearchKeyword(primaryInput.name) : undefined,
        qty: calculatedQty,
      },
    },
  ];

  if (concreteInputs.length > 0) {
    const seenKeywords = new Set<string>();
    for (const inp of concreteInputs.slice(0, 2)) {
      const keyword = extractShortSearchKeyword(inp.name);
      const normKey = normalizeSearchText(keyword);
      if (!normKey || seenKeywords.has(normKey)) continue;
      seenKeywords.add(normKey);

      const matched = findBestInventoryMatch(inp.name, inventory);
      const inpDose = parseDoseCell(inp.doseRaw);
      const neededQty =
        inpDose && inpDose.isPerHectare && areaHa
          ? Math.round(inpDose.amount * areaHa * 100) / 100
          : inpDose?.amount;

      if (matched) {
        const stock = Number(matched.stock_qty || 0);
        const isEnough = neededQty ? stock >= neededQty : stock > Number(matched.min_stock || 0);
        actions.push({
          id: `inv-${normKey}`,
          label: `Ver "${matched.name}" en Inventario`,
          badgeText: `${stock} ${matched.unit}`,
          badgeTone: isEnough ? "ok" : "warn",
          kind: "inventory",
          inventoryFilter: { q: matched.name },
        });
      } else {
        actions.push({
          id: `inv-missing-${normKey}`,
          label: `Comprobar "${keyword}" en Inventario`,
          badgeText: inventory.length > 0 ? "Sin registro" : undefined,
          badgeTone: inventory.length > 0 ? "missing" : undefined,
          kind: "inventory",
          inventoryFilter: {
            q: keyword,
            addName: cleanMarkdownInline(inp.name).slice(0, 80),
            addCategory: inferCategory(inp.name),
            addUnit: inpDose?.unit ?? "KG",
          },
        });
      }
    }
  } else {
    actions.push({
      id: "inv-general",
      label: "Ver insumos en Inventario",
      kind: "inventory",
      inventoryFilter: {},
    });
  }

  return actions;
}
