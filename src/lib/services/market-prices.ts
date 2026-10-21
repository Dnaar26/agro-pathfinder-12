import { z } from "zod";

export interface MarketPrice {
  product: string;
  price: number;
  unit: string;
  market: string;
  date: string;
  change: number;
}

export type MarketPriceSource = "sipsa" | "reference";

export interface MarketPriceResult {
  prices: MarketPrice[];
  source: MarketPriceSource;
  fetchedAt: string;
}

const MARKET_PRICES_URL = import.meta.env.VITE_MARKET_PRICES_URL?.trim() ?? "";
const payloadSchema = z.union([
  z.array(z.unknown()),
  z.object({ data: z.array(z.unknown()) }),
]);

export async function fetchMarketPrices(): Promise<MarketPriceResult> {
  const fetchedAt = new Date().toISOString();

  // El endpoint se configura por entorno porque la URL pública de SIPSA puede cambiar.
  // Nunca se presenta el catálogo local como si fuera una lectura actual del mercado.
  if (!MARKET_PRICES_URL) {
    return { prices: getReferencePrices(), source: "reference", fetchedAt };
  }

  try {
    const response = await fetchWithTimeout(MARKET_PRICES_URL, 8_000);
    if (!response.ok) throw new Error(`Market prices request failed: ${response.status}`);

    const parsedPayload = payloadSchema.safeParse(await response.json());
    if (!parsedPayload.success) throw new Error("Market prices payload has an unsupported shape");

    const rows = Array.isArray(parsedPayload.data) ? parsedPayload.data : parsedPayload.data.data;
    const prices = rows.map(normalizePrice).filter((price): price is MarketPrice => price !== null);
    if (prices.length === 0) throw new Error("Market prices payload has no valid rows");

    return { prices, source: "sipsa", fetchedAt };
  } catch {
    return { prices: getReferencePrices(), source: "reference", fetchedAt };
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizePrice(raw: unknown): MarketPrice | null {
  const product = readText(raw, ["producto", "product"]);
  const price = readNumber(raw, ["precio", "price"]);
  if (!product || price === null || price <= 0) return null;

  const rawDate = readText(raw, ["fecha", "date"]);
  const parsedDate = rawDate && !Number.isNaN(Date.parse(rawDate))
    ? rawDate
    : new Date().toISOString().slice(0, 10);

  return {
    product,
    price,
    unit: readText(raw, ["unidad", "unit"]) ?? "KG",
    market: readText(raw, ["mercado", "market"]) ?? "Mercado mayorista",
    date: parsedDate,
    change: readNumber(raw, ["variacion", "change"]) ?? 0,
  };
}

function readText(raw: unknown, keys: string[]): string | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumber(raw: unknown, keys: string[]): number | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  for (const key of keys) {
    const value = typeof record[key] === "string" ? Number(record[key]) : record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function getReferencePrices(): MarketPrice[] {
  const date = new Date().toISOString().slice(0, 10);
  return [
    ["Papa", 2100, "KG", "Central de Abastos", 0.5],
    ["Arroz", 3200, "KG", "Central de Abastos", -0.3],
    ["Maíz", 1800, "KG", "Central de Abastos", 1.2],
    ["Café", 8500, "KG", "FNC Colombia", 2.1],
    ["Cacao", 12000, "KG", "Fedecacao", -0.8],
    ["Plátano", 1500, "KG", "Central de Abastos", 0],
    ["Tomate", 2800, "KG", "Central de Abastos", 3.5],
    ["Yuca", 1200, "KG", "Central de Abastos", -0.5],
    ["Frijol", 4500, "KG", "Central de Abastos", 1.8],
    ["Cebolla", 2200, "KG", "Central de Abastos", 0.7],
    ["Zanahoria", 1600, "KG", "Central de Abastos", -0.2],
    ["Lechuga", 1800, "UN", "Central de Abastos", 0.3],
    ["Caña de azúcar", 950, "KG", "Asocaña", 0.1],
    ["Palma aceitera", 2500, "KG", "Fedepalma", -0.4],
  ].map(([product, price, unit, market, change]) => ({
    product: String(product),
    price: Number(price),
    unit: String(unit),
    market: String(market),
    date,
    change: Number(change),
  }));
}
