import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, listAllCrops } from "@/lib/queries";
import { fetchMarketPrices } from "@/lib/services/market-prices";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Store,
  Plus,
  Search,
  Award,
  QrCode,
  MessageCircle,
  Calendar,
  MapPin,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrencyInt } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mercado")({
  head: () => ({ meta: [{ title: "Vitrina Comercial y Preventa — SIGIC" }] }),
  component: CropMarketplacePage,
});

function buildWhatsAppUrl(phone: string, listing: any): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `57${digits}` : digits;
  const text = encodeURIComponent(
    `Hola ${listing.farmer_display_name}, vi tu oferta en SIGIC de ${listing.product_name} (${listing.available_qty} ${listing.unit} a ${formatCurrencyInt(Number(listing.price_per_unit))}/${listing.unit}). ¿Sigue disponible?`
  );
  return `https://wa.me/${normalized}?text=${text}`;
}

function CropMarketplacePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PREVENTA" | "DISPONIBLE">("ALL");

  const [selectedCropId, setSelectedCropId] = useState("__none__");
  const [productName, setProductName] = useState("");
  const [variety, setVariety] = useState("");
  const [availableQty, setAvailableQty] = useState("500");
  const [unit, setUnit] = useState("KG");
  const [minOrderQty, setMinOrderQty] = useState("50");
  const [pricePerUnit, setPricePerUnit] = useState("2500");
  const [availableFrom, setAvailableFrom] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [locationLabel, setLocationLabel] = useState("Cundinamarca, Colombia");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [listingStatus, setListingStatus] = useState<"PREVENTA" | "DISPONIBLE">("PREVENTA");
  const [notes, setNotes] = useState("");

  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getMyProfile });
  const cropsQuery = useQuery({ queryKey: ["crops"], queryFn: listAllCrops });
  const marketRefQuery = useQuery({
    queryKey: ["market-prices-ref"],
    queryFn: fetchMarketPrices,
    staleTime: 30 * 60 * 1000,
  });

  const sessionUserQuery = useQuery({
    queryKey: ["market-current-uid"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user?.id ?? null;
    },
  });

  const listingsQuery = useQuery({
    queryKey: ["harvest-listings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("harvest_listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (String(error.code) === "42P01" || String(error.code) === "PGRST205") {
          return { migrationPending: true, rows: [] as any[] };
        }
        throw error;
      }
      return { migrationPending: false, rows: (data ?? []) as any[] };
    },
  });

  const handlePrefillFromCrop = async (cropIdVal: string) => {
    setSelectedCropId(cropIdVal);
    if (cropIdVal === "__none__") return;
    const found = (cropsQuery.data ?? []).find((c: any) => c.id === cropIdVal);
    if (found) {
      setProductName((found as any).crop_catalog?.name ?? "");
      if (found.estimated_harvest_date) {
        setAvailableFrom(found.estimated_harvest_date);
      }
      if (profileQuery.data?.phone && !whatsappPhone) {
        setWhatsappPhone(profileQuery.data.phone);
      }
    }
  };

  const createListing = useMutation({
    mutationFn: async () => {
      if (!productName.trim()) throw new Error("Indica el producto a ofertar");
      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user ?? (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Sesión expirada");

      let batchCode: string | null = null;
      let batchId: string | null = null;
      let bpaVerified = false;

      if (selectedCropId !== "__none__") {
        const { data: latestBatch } = await supabase
          .from("batches")
          .select("id, batch_code, globalgap_cert")
          .eq("crop_id", selectedCropId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestBatch) {
          batchId = latestBatch.id;
          batchCode = latestBatch.batch_code;
          bpaVerified = Boolean(latestBatch.globalgap_cert);
        }
      }

      const { error } = await (supabase as any).from("harvest_listings").insert({
        owner_id: user.id,
        crop_id: selectedCropId !== "__none__" ? selectedCropId : null,
        batch_id: batchId,
        farmer_display_name: profileQuery.data?.full_name || "Productor SIGIC",
        product_name: productName.trim(),
        variety: variety.trim() || null,
        available_qty: Number(availableQty),
        unit,
        min_order_qty: Number(minOrderQty) || 1,
        price_per_unit: Number(pricePerUnit),
        available_from: availableFrom,
        location_label: locationLabel.trim() || "Colombia",
        whatsapp_phone: (whatsappPhone || profileQuery.data?.phone || "").trim() || null,
        bpa_verified: bpaVerified,
        batch_code: batchCode,
        status: listingStatus,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oferta de cosecha publicada en la Vitrina Comercial");
      qc.invalidateQueries({ queryKey: ["harvest-listings"] });
      setOpen(false);
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markSold = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("harvest_listings")
        .update({ status: "VENDIDO" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lote marcado como vendido");
      qc.invalidateQueries({ queryKey: ["harvest-listings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteListing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("harvest_listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Publicación retirada");
      qc.invalidateQueries({ queryKey: ["harvest-listings"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
    return (listingsQuery.data?.rows ?? []).filter((item: any) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (item.status === "VENDIDO" && statusFilter !== "ALL") return false;
      if (!q) return true;
      return (
        String(item.product_name || "").toLowerCase().includes(q) ||
        String(item.location_label || "").toLowerCase().includes(q) ||
        String(item.farmer_display_name || "").toLowerCase().includes(q)
      );
    });
  }, [listingsQuery.data?.rows, search, statusFilter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Store className="size-7 text-primary" />
            Vitrina Comercial y Preventa de Cosechas
          </h1>
          <p className="text-sm text-muted-foreground">
            Publica cosechas próximas o disponibles con trazabilidad QR y recibe pedidos directos sin intermediarios.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="size-4" /> Publicar cosecha
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Publicar Oferta o Preventa Agrícola</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createListing.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Autocompletar desde uno de tus cultivos (opcional)</Label>
                <Select value={selectedCropId} onValueChange={handlePrefillFromCrop}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir cultivo registrado…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingreso manual</SelectItem>
                    {(cropsQuery.data ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.crop_catalog?.name ?? "Cultivo"} — {c.parcels?.name ?? "Parcela"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Producto *</Label>
                  <Input placeholder="Ej: Café Pergamino / Papa" value={productName} onChange={(e) => setProductName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Variedad / Calidad</Label>
                  <Input placeholder="Ej: Castillo / Suprema Primera" value={variety} onChange={(e) => setVariety(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">Volumen disp.</Label>
                  <Input type="number" inputMode="decimal" min="1" value={availableQty} onChange={(e) => setAvailableQty(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unidad</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG">KG</SelectItem>
                      <SelectItem value="TON">TON</SelectItem>
                      <SelectItem value="BULTO_50KG">Bulto 50kg</SelectItem>
                      <SelectItem value="CAJA">Caja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Precio ($ COP/{unit})</Label>
                  <Input type="number" inputMode="decimal" min="1" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Modalidad</Label>
                  <Select value={listingStatus} onValueChange={(v) => setListingStatus(v as "PREVENTA" | "DISPONIBLE")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREVENTA">Preventa (Próxima cosecha)</SelectItem>
                      <SelectItem value="DISPONIBLE">Entrega inmediata</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Disponible desde</Label>
                  <Input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Municipio / Región</Label>
                  <Input value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">WhatsApp comercial</Label>
                  <Input
                    type="tel"
                    placeholder="Ej: 3001234567"
                    value={whatsappPhone || profileQuery.data?.phone || ""}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Condiciones de entrega / Pedido mínimo ({minOrderQty} {unit})</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Recogida en finca o puesto en cabecera municipal…" />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createListing.isPending}>
                  Publicar en vitrina
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cultivo, municipio o productor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { id: "ALL", label: "Todas" },
            { id: "DISPONIBLE", label: "Entrega inmediata" },
            { id: "PREVENTA", label: "En preventa" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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

      {listingsQuery.data?.migrationPending && (
        <Card className="p-4 border-warning/40 bg-warning/10 text-xs flex items-start gap-2.5">
          <AlertTriangle className="size-4 shrink-0 text-warning-text mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Migración de base de datos v5 pendiente</p>
            <p className="text-muted-foreground">
              Ejecuta <code className="rounded bg-background px-1.5 py-0.5">npx supabase db push</code> para activar <code className="rounded bg-background px-1.5 py-0.5">public.harvest_listings</code>.
            </p>
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="p-10 text-center border-dashed space-y-2">
          <Store className="size-10 mx-auto text-muted-foreground" />
          <p className="font-semibold">No hay lotes publicados con este filtro</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Publica tu próxima cosecha para conectar directamente con compradores regionales y mostrar tu certificado QR.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item: any) => {
            const isMine = sessionUserQuery.data && item.owner_id === sessionUserQuery.data;
            const refPrice = refPricesMap.get(String(item.product_name || "").toLowerCase());

            return (
              <Card key={item.id} className="p-5 flex flex-col justify-between space-y-4">
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
                          : item.status === "VENDIDO"
                            ? "bg-muted text-muted-foreground text-[11px]"
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
                        <Calendar className="size-3" /> {item.available_from}
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
                        <QrCode className="size-3 text-primary" /> Ver trazabilidad
                      </Link>
                    )}
                  </div>

                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                  {item.whatsapp_phone && item.status !== "VENDIDO" ? (
                    <Button asChild size="sm" className="flex-1 gap-1.5 text-xs">
                      <a href={buildWhatsAppUrl(item.whatsapp_phone, item)} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-4" />
                        Acordar por WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin teléfono público</span>
                  )}

                  {isMine && item.status !== "VENDIDO" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => markSold.mutate(item.id)}
                    >
                      Marcar vendido
                    </Button>
                  )}

                  {isMine && (
                    <button
                      type="button"
                      onClick={() => deleteListing.mutate(item.id)}
                      aria-label="Eliminar publicación"
                      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
