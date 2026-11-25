import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMarketPrices } from "@/lib/services/market-prices";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Search,
  Award,
  QrCode,
  MessageCircle,
  Calendar,
  MapPin,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { formatCurrencyInt } from "@/lib/currency";

type PublicListing = {
  id: string;
  farmer_display_name: string;
  product_name: string;
  variety: string | null;
  available_qty: number;
  unit: string;
  min_order_qty: number;
  price_per_unit: number;
  available_from: string;
  location_label: string;
  whatsapp_phone: string | null;
  bpa_verified: boolean;
  batch_code: string | null;
  status: "PREVENTA" | "DISPONIBLE";
  notes: string | null;
};

export const Route = createFileRoute("/vitrina")({
  head: () => ({
    meta: [
      { title: "Vitrina Pública de Cosechas — SIGIC" },
      {
        name: "description",
        content:
          "Catálogo abierto de cosechas disponibles y en preventa directa de agricultores verificados en SIGIC con trazabilidad QR.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { productor?: string; q?: string } => ({
    productor:
      typeof s.productor === "string" && /^[0-9a-fA-F-]{36}$/.test(s.productor)
        ? s.productor
        : undefined,
    q: typeof s.q === "string" && s.q.trim() ? s.q.trim().slice(0, 80) : undefined,
  }),
  component: PublicShowcasePage,
});

function buildWhatsAppUrl(phone: string, listing: PublicListing): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `57${digits}` : digits;
  const text = encodeURIComponent(
    `Hola ${listing.farmer_display_name}, vi tu cosecha publicada en la Vitrina Pública SIGIC: ${listing.product_name} (${listing.available_qty} ${listing.unit} a ${formatCurrencyInt(Number(listing.price_per_unit))}/${listing.unit}). Me gustaría coordinar compra directa.`
  );
  return `https://wa.me/${normalized}?text=${text}`;
}

function PublicShowcasePage() {
  const searchParams = Route.useSearch();
  const [search, setSearch] = useState(searchParams.q ?? "");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DISPONIBLE" | "PREVENTA">("ALL");

  const listingsQuery = useQuery({
    queryKey: ["public-vitrina", searchParams.productor ?? "all"],
    queryFn: async (): Promise<PublicListing[]> => {
      const { data, error } = await (supabase as any).rpc("get_public_marketplace_listings", {
        p_owner_id: searchParams.productor ?? null,
      });
      if (error || !Array.isArray(data)) return [];
      return data as PublicListing[];
    },
  });

  const marketRefQuery = useQuery({
    queryKey: ["public-market-prices-ref"],
    queryFn: fetchMarketPrices,
    staleTime: 30 * 60 * 1000,
  });

  const refPricesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of marketRefQuery.data?.prices ?? []) {
      map.set(p.product.toLowerCase(), p.price);
    }
    return map;
  }, [marketRefQuery.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listingsQuery.data ?? []).filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.product_name.toLowerCase().includes(q) ||
        (item.variety ?? "").toLowerCase().includes(q) ||
        item.location_label.toLowerCase().includes(q) ||
        item.farmer_display_name.toLowerCase().includes(q)
      );
    });
  }, [listingsQuery.data, search, statusFilter]);

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="SIGIC — Inicio">
              <Logo size="xs" variant="light" />
            </Link>
            <Badge className="hidden sm:inline-flex bg-white/15 text-white border-white/20 text-xs">
              Catálogo Público Directo
            </Badge>
          </div>
          <nav className="flex items-center gap-2">
            <ThemeToggle className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white" />
            <Button asChild size="sm" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 text-xs">
              <Link to="/login">Soy productor / Ingresar</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8 space-y-6">
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="size-3.5" /> Compra sin intermediarios · Trazabilidad verificable
            </span>
            {searchParams.productor && (
              <Button asChild variant="ghost" size="sm" className="h-8 text-xs gap-1">
                <Link to="/vitrina" search={{}}>
                  <ArrowLeft className="size-3.5" /> Ver todos los productores
                </Link>
              </Button>
            )}
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            Vitrina Comercial de Cosechas SIGIC
          </h1>
          <p className="max-w-2xl text-sm sm:text-base text-muted-foreground">
            Explora lotes agrícolas disponibles hoy o en preventa de cosecha. Revisa su certificado de trazabilidad QR y acuerda la compra directamente con el agricultor por WhatsApp.
          </p>
        </section>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar café, papa, plátano, municipio o productor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "ALL", label: "Todas las ofertas" },
              { id: "DISPONIBLE", label: "Entrega inmediata" },
              { id: "PREVENTA", label: "Preventa de cosecha" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === tab.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {listingsQuery.isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Cargando cosechas publicadas…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center border-dashed space-y-3">
            <Store className="size-10 mx-auto text-muted-foreground" />
            <p className="font-semibold text-base">No hay cosechas activas con este criterio</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Los productores de SIGIC publican aquí sus lotes conforme entran en ventana de cosecha o preventa.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const refPrice = refPricesMap.get(item.product_name.toLowerCase());
              return (
                <Card key={item.id} className="p-5 flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-bold text-lg leading-tight">
                          {item.product_name} {item.variety ? `· ${item.variety}` : ""}
                        </h2>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="size-3 text-primary" /> {item.location_label} · {item.farmer_display_name}
                        </p>
                      </div>
                      <Badge
                        className={
                          item.status === "DISPONIBLE"
                            ? "bg-success/15 text-success border-success/30 text-[11px]"
                            : "bg-primary/15 text-primary border-primary/30 text-[11px]"
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-baseline justify-between">
                      <div>
                        <span className="text-xl font-bold text-foreground">
                          {formatCurrencyInt(Number(item.price_per_unit))}
                        </span>
                        <span className="text-xs text-muted-foreground"> / {item.unit}</span>
                        {refPrice && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Ref. mayorista: {formatCurrencyInt(refPrice)}/KG
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {Number(item.available_qty).toLocaleString("es-CO")} {item.unit}
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center justify-end gap-1">
                          <Calendar className="size-3" /> Disp: {item.available_from}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {item.bpa_verified && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                          <Award className="size-3 mr-1" /> BPA / GLOBALG.A.P.
                        </Badge>
                      )}
                      {item.batch_code && (
                        <Link
                          to="/trace/$code"
                          params={{ code: item.batch_code }}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-mono hover:border-primary"
                        >
                          <QrCode className="size-3 text-primary" /> Verificar origen QR
                        </Link>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        Pedido mín: {item.min_order_qty} {item.unit}
                      </span>
                    </div>

                    {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                  </div>

                  <div className="pt-2 border-t border-border/60">
                    {item.whatsapp_phone ? (
                      <Button asChild size="sm" className="w-full gap-1.5 text-xs">
                        <a href={buildWhatsAppUrl(item.whatsapp_phone, item)} target="_blank" rel="noreferrer">
                          <MessageCircle className="size-4" />
                          Comprar / Acordar con el productor
                        </a>
                      </Button>
                    ) : (
                      <p className="text-center text-xs text-muted-foreground py-1">
                        Oferta informativa registrada en cooperativa SIGIC
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SIGIC — Vitrina Abierta de Comercialización Directa y Trazabilidad Agrícola
      </footer>
    </div>
  );
}
