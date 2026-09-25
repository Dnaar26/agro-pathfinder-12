import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Package, Plus, AlertTriangle, Search, Edit3, Trash2, TrendingDown, TrendingUp, BarChart3, List, Grid3X3, Filter, DollarSign, Layers, Shield, Sparkles, CheckCircle2, Loader2, Wrench, Sprout } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { inferCategory } from "@/lib/queries";

const formatCOP = (n: number) => '$ ' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

const INVENTORY_PRESETS = [
  { name: "Fertilizante NPK 20-20-20", category: "Fertilizante", unit: "KG", minStock: 25, cost: 85000, icon: "🌿" },
  { name: "Urea Agrícola 46%", category: "Fertilizante", unit: "KG", minStock: 50, cost: 78000, icon: "🌾" },
  { name: "Insecticida Cipermetrina", category: "Plaguicida", unit: "L", minStock: 5, cost: 48000, icon: "🛡️" },
  { name: "Fungicida Cúprico", category: "Plaguicida", unit: "KG", minStock: 10, cost: 38000, icon: "🍄" },
  { name: "Semillas Certificadas", category: "Semilla", unit: "KG", minStock: 15, cost: 32000, icon: "🌱" },
  { name: "Bomba de Mochila 20L", category: "Herramienta", unit: "UN", minStock: 2, cost: 185000, icon: "🎒" },
  { name: "Manguera de Goteo 100m", category: "Herramienta", unit: "UN", minStock: 2, cost: 120000, icon: "💧" },
];

export function InventoryPanel({ farmerId: propFarmerId }: { farmerId?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [movOpen, setMovOpen] = useState<string | null>(null);
  
  // Detectar si el usuario es técnico (solo lectura)
  const rolesQuery = useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return (data ?? []).map((r: any) => r.role);
    },
  });
  const isTecnico = (rolesQuery.data ?? []).includes("tecnico") && !(rolesQuery.data ?? []).includes("admin");
  const isReadOnly = isTecnico;

  // Controlled fields for form
  const [itemName, setItemName] = useState("");
  const [stockQty, setStockQty] = useState<string>("0");
  const [minStock, setMinStock] = useState<string>("5");
  const [unitCost, setUnitCost] = useState<string>("0");
  const [unit, setUnit] = useState("KG");
  const [category, setCategory] = useState("Fertilizante");
  const [editUnit, setEditUnit] = useState("KG");
  const [editCategory, setEditCategory] = useState("Otro");
  const [movKind, setMovKind] = useState("ENTRADA");

  const resetAddForm = () => {
    setItemName("");
    setStockQty("0");
    setMinStock("5");
    setUnitCost("0");
    setUnit("KG");
    setCategory("Fertilizante");
  };

  const applyPreset = (p: typeof INVENTORY_PRESETS[0]) => {
    setItemName(p.name);
    setCategory(p.category);
    setUnit(p.unit);
    setMinStock(String(p.minStock));
    setUnitCost(String(p.cost));
    if (stockQty === "0") setStockQty(String(p.minStock * 2));
  };

  // Filters & Views
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const pageSize = 18;

  const items = useQuery({
    queryKey: ["inventory", propFarmerId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("No session");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const isStaff = (roles ?? []).some((r: any) => ["tecnico", "admin"].includes(r.role));
      let q = (supabase as any).from("inventory_items").select("*");
      if (propFarmerId) q = q.eq("owner_id", propFarmerId);
      else if (!isStaff) q = q.eq("owner_id", u.user.id);
      const { data, error } = await q.order("name");
      if (error) throw error;
      const raw = (data ?? []) as any[];
      return raw.map((i) => ({
        ...i,
        category: i.category || inferCategory(i.name),
      }));
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items.data ?? []).filter((i) => {
      const matchesSearch = !q || i.name.toLowerCase().includes(q);
      const matchesCategory = filterCategory === "ALL" || i.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items.data, query, filterCategory]);

  useEffect(() => { setPage(1); }, [query, filterCategory]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page]);

  const createItem = useMutation({
    mutationFn: async (input: { name: string; category: string; unit: string; stock_qty: number; min_stock: number; unit_cost: number }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("No session");
      const payload: any = { ...input, owner_id: u.user.id };

      const sb = supabase as any;
      const { error } = await sb.from("inventory_items").insert(payload);
      if (error) {
        // Fallback seguro si la columna 'category' aún no existe en PostgreSQL
        if (error.message?.includes("category") || error.details?.includes("category") || error.code === "PGRST204") {
          const { category: _c, ...safePayload } = payload;
          const { error: retryError } = await sb.from("inventory_items").insert(safePayload);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["inventory"] }); 
      qc.invalidateQueries({ queryKey: ["my-inventory-report"] });
      qc.invalidateQueries({ queryKey: ["global-inventory"] });
      setOpen(false); 
      resetAddForm();
      toast.success("Insumo agregado con éxito"); 
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async (input: { id: string; name: string; category: string; unit: string; min_stock: number; unit_cost: number }) => {
      const sb = supabase as any;
      const { error } = await sb.from("inventory_items").update(input).eq("id", input.id);
      if (error) {
        if (error.message?.includes("category") || error.details?.includes("category") || error.code === "PGRST204") {
          const { category: _c, ...safeInput } = input;
          const { error: retryError } = await sb.from("inventory_items").update(safeInput).eq("id", input.id);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["inventory"] }); 
      qc.invalidateQueries({ queryKey: ["my-inventory-report"] });
      qc.invalidateQueries({ queryKey: ["global-inventory"] });
      setEditOpen(false); 
      setEditingItem(null); 
      toast.success("Insumo actualizado"); 
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Item eliminado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMovement = useMutation({
    mutationFn: async (input: { item_id: string; kind: string; qty: number; notes?: string }) => {
      const { error } = await supabase.rpc("apply_inventory_movement", {
        p_item_id: input.item_id,
        p_kind: input.kind,
        p_qty: input.qty,
        p_notes: input.notes || null,
        p_delta: input.kind === "SALIDA" ? -input.qty : input.qty,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); setMovOpen(null); toast.success("Movimiento registrado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditingItem(item);
    setEditUnit(item.unit || "KG");
    setEditCategory(item.category || "Otro");
    setEditOpen(true);
  };

  const lowStockItems = (items.data ?? []).filter((i) => i.stock_qty <= i.min_stock);
  const totalValue = (items.data ?? []).reduce((acc, i) => acc + (i.stock_qty * (i.unit_cost || 0)), 0);

  const getStockStatus = (qty: number, min: number) => {
    if (qty <= 0 || (min > 0 && qty <= min * 0.2)) return "critical";
    if (qty <= min) return "low";
    return "ok";
  };

  const getStockProgress = (qty: number, min: number) => {
    if (min === 0) return qty > 0 ? 100 : 0;
    const p = (qty / (min * 2)) * 100;
    return Math.min(p, 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "bg-red-500";
      case "low": return "bg-yellow-500";
      default: return "bg-green-500";
    }
  };

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm">
          <Shield className="size-4 shrink-0" />
          <span>Modo visualización — Como técnico puedes ver el inventario pero no modificarlo.</span>
        </div>
      )}
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ítems</CardTitle>
            <Layers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.data?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Inventario</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCOP(totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertTriangle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2 w-full max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 size-4" />
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las categorías</SelectItem>
              <SelectItem value="Fertilizante">Fertilizante</SelectItem>
              <SelectItem value="Pesticida">Pesticida</SelectItem>
              <SelectItem value="Semilla">Semilla</SelectItem>
              <SelectItem value="Herramienta">Herramienta</SelectItem>
              <SelectItem value="Combustible">Combustible</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center border rounded-md p-1 bg-muted/50">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("list")}
            >
              <List className="size-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="size-4" />
            </Button>
          </div>

          {!isReadOnly && (
            <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetAddForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 shadow-xs bg-primary hover:bg-primary/90">
                  <Plus className="size-4" /> {t("inventory.add_item")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px] p-6 max-h-[92vh] overflow-y-auto">
                <DialogHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Package className="size-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold text-foreground">
                        Agregar Insumo al Inventario
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Registra productos, semillas o herramientas con control de existencias y costos.
                      </p>
                    </div>
                  </div>
                </DialogHeader>

                {/* Atajos Rápidos */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="size-3 text-amber-500" /> Insumos Frecuentes (Autocompletar en 1 clic)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {INVENTORY_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className="text-xs py-1 px-2.5 rounded-lg border border-border/80 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all flex items-center gap-1.5"
                      >
                        <span>{p.icon}</span>
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <form
                  ref={formRef}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!itemName.trim()) {
                      toast.error("El nombre del insumo es obligatorio");
                      return;
                    }
                    createItem.mutate({
                      name: itemName.trim(),
                      category,
                      unit,
                      stock_qty: Number(stockQty) || 0,
                      min_stock: Number(minStock) || 0,
                      unit_cost: Number(unitCost) || 0,
                    });
                  }}
                  className="space-y-4 pt-2"
                >
                  {/* Nombre */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Nombre del Insumo *</span>
                      <span className="text-[10px] text-muted-foreground">Ej: Fertilizante 15-15-15, Semillas de Papa</span>
                    </Label>
                    <Input
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="Nombre comercial o genérico del insumo..."
                      required
                      className="text-sm"
                    />
                  </div>

                  {/* Categoría y Unidad */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Categoría</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fertilizante">🌿 Fertilizante</SelectItem>
                          <SelectItem value="Plaguicida">🛡️ Plaguicida / Fitosanitario</SelectItem>
                          <SelectItem value="Semilla">🌱 Semilla o Plántula</SelectItem>
                          <SelectItem value="Herramienta">🔧 Herramienta / Equipo</SelectItem>
                          <SelectItem value="Combustible">⛽ Combustible</SelectItem>
                          <SelectItem value="Otro">📦 Otro Insumo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Unidad de Medida</Label>
                      <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KG">Kilogramos (KG)</SelectItem>
                          <SelectItem value="L">Litros (L)</SelectItem>
                          <SelectItem value="UN">Unidades (UN)</SelectItem>
                          <SelectItem value="SACO">Bultos / Sacos (SACO)</SelectItem>
                          <SelectItem value="GL">Galones (GL)</SelectItem>
                          <SelectItem value="TON">Toneladas (TON)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Stock y Stock Mínimo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Stock Inicial Disponible</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={stockQty}
                          onChange={(e) => setStockQty(e.target.value)}
                          step="any"
                          min="0"
                          className="pr-12 text-sm"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none font-medium">
                          {unit}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center justify-between">
                        <span>Stock Mínimo (Alerta)</span>
                        <span className="text-[10px] text-muted-foreground">Aviso de reposición</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={minStock}
                          onChange={(e) => setMinStock(e.target.value)}
                          step="any"
                          min="0"
                          className="pr-12 text-sm"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none font-medium">
                          {unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Costo Unitario */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Costo Unitario de Adquisición (COP)</span>
                      <span className="text-[10px] text-muted-foreground">Valor por cada {unit}</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground pointer-events-none font-semibold">
                        $
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={unitCost}
                        onChange={(e) => setUnitCost(e.target.value)}
                        step="any"
                        min="0"
                        className="pl-7 text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Tarjeta de Resumen en Vivo */}
                  <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Valor Total Inicial de este Insumo:</span>
                      <span className="font-bold text-emerald-600 text-sm">
                        {formatCOP((Number(stockQty) || 0) * (Number(unitCost) || 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">Estado inicial de inventario:</span>
                      {(Number(stockQty) || 0) <= (Number(minStock) || 0) ? (
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <AlertTriangle className="size-3" /> Iniciará con alerta de stock bajo
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Nivel de existencias óptimo
                        </span>
                      )}
                    </div>
                  </div>

                  <DialogFooter className="pt-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setOpen(false); resetAddForm(); }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createItem.isPending}
                      className="gap-1.5"
                    >
                      {createItem.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Guardando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" /> Guardar en Inventario
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

        </div>
      </div>

      {/* Content */}
      {viewMode === "list" ? (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Stock / Mín</TableHead>
                <TableHead>Costo Unitario</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay elementos
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((item) => {
                  const status = getStockStatus(item.stock_qty, item.min_stock);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {status !== "ok" && <AlertTriangle className={`size-4 ${status === "critical" ? "text-destructive" : "text-yellow-500"}`} />}
                          {item.name}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{item.category || "Otro"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={status !== "ok" ? "font-bold text-destructive" : ""}>
                            {item.stock_qty} {item.unit}
                          </span>
                          <span className="text-xs text-muted-foreground">/ {item.min_stock}</span>
                        </div>
                        <div className="w-24 mt-1">
                           <Progress value={getStockProgress(item.stock_qty, item.min_stock)} className={`h-1.5 ${getStatusColor(status)}`} />
                        </div>
                      </TableCell>
                      <TableCell>{formatCOP(item.unit_cost || 0)}</TableCell>
                      <TableCell className="font-semibold">{formatCOP((item.unit_cost || 0) * item.stock_qty)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!isReadOnly ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => { setMovKind("ENTRADA"); setMovOpen(item.id); }}>
                                <TrendingUp className="size-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setMovKind("SALIDA"); setMovOpen(item.id); }}>
                                <TrendingDown className="size-4 text-red-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                <Edit3 className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { if(confirm("¿Eliminar?")) deleteItem.mutate(item.id); }}>
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground text-center py-1 border border-dashed border-border rounded-md px-2">Solo visualización</div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginated.map((item) => {
            const status = getStockStatus(item.stock_qty, item.min_stock);
            const totalItemValue = (item.unit_cost || 0) * item.stock_qty;
            
            return (
              <Card key={item.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base font-semibold line-clamp-1">{item.name}</CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{item.category || "Otro"}</Badge>
                      </div>
                    </div>
                    {status !== "ok" && (
                      <AlertTriangle className={`size-5 shrink-0 ${status === "critical" ? "text-destructive" : "text-yellow-500"}`} />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Stock</span>
                        <span className="font-medium">
                          <span className={status !== "ok" ? "text-destructive font-bold" : ""}>{item.stock_qty}</span> 
                          <span className="text-muted-foreground ml-1">/ {item.min_stock} {item.unit}</span>
                        </span>
                      </div>
                      <Progress value={getStockProgress(item.stock_qty, item.min_stock)} className={`h-2 ${getStatusColor(status)}`} />
                    </div>
                    
                    <div className="bg-muted/30 p-2 rounded-md grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Costo unitario</div>
                        <div className="font-medium">{formatCOP(item.unit_cost || 0)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Valor total</div>
                        <div className="font-bold text-primary">{formatCOP(totalItemValue)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1 mt-4 pt-4 border-t">
                    {!isReadOnly ? (
                      <>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-8 px-2 text-green-600 border-green-200 hover:bg-green-50" onClick={() => { setMovKind("ENTRADA"); setMovOpen(item.id); }}>
                            <TrendingUp className="size-3 mr-1" /> Ent
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setMovKind("SALIDA"); setMovOpen(item.id); }}>
                            <TrendingDown className="size-3 mr-1" /> Sal
                          </Button>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                            <Edit3 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => { if(confirm("¿Eliminar?")) deleteItem.mutate(item.id); }}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground text-center w-full py-1 border border-dashed border-border rounded-md">Solo visualización</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editingItem?.name}</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateItem.mutate({
                  id: editingItem.id,
                  name: fd.get("name") as string,
                  category: editCategory,
                  unit: editUnit,
                  min_stock: Number(fd.get("min_stock")),
                  unit_cost: Number(fd.get("unit_cost")),
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>{t("inventory.item_name")}</Label>
                <Input name="name" defaultValue={editingItem.name} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fertilizante">Fertilizante</SelectItem>
                      <SelectItem value="Pesticida">Pesticida</SelectItem>
                      <SelectItem value="Semilla">Semilla</SelectItem>
                      <SelectItem value="Herramienta">Herramienta</SelectItem>
                      <SelectItem value="Combustible">Combustible</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("inventory.unit")}</Label>
                  <Select value={editUnit} onValueChange={setEditUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG">KG</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="UN">UN</SelectItem>
                      <SelectItem value="SACO">SACO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("inventory.min_stock")}</Label>
                  <Input name="min_stock" type="number" inputMode="decimal" defaultValue={editingItem.min_stock} step="any" />
                </div>
                <div className="space-y-2">
                  <Label>Costo Unitario (COP)</Label>
                  <Input name="unit_cost" type="number" inputMode="decimal" defaultValue={editingItem.unit_cost} step="any" />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit">{t("common.save")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={!!movOpen} onOpenChange={(o) => { if (!o) setMovOpen(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
          </DialogHeader>
          {movOpen && (
            (() => {
              const item = items.data?.find((i) => i.id === movOpen);
              if (!item) return null;
              return (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    addMovement.mutate({
                      item_id: item.id,
                      kind: movKind,
                      qty: Number(fd.get("qty")),
                      notes: fd.get("notes") as string,
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="p-3 bg-muted rounded-md space-y-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground flex justify-between">
                      <span>Stock actual:</span>
                      <span className="font-semibold text-foreground">{item.stock_qty} {item.unit}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de movimiento</Label>
                    <Select value={movKind} onValueChange={setMovKind}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ENTRADA">ENTRADA (Ingreso a stock)</SelectItem>
                        <SelectItem value="SALIDA">SALIDA (Consumo/Retiro)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input 
                      name="qty" 
                      type="number" 
                      inputMode="decimal" 
                      min="0.01" 
                      step="any" 
                      required 
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const futureStockEl = document.getElementById('future-stock');
                        if (futureStockEl) {
                          const newQty = movKind === 'SALIDA' ? item.stock_qty - val : item.stock_qty + val;
                          futureStockEl.textContent = newQty.toFixed(2);
                          if (newQty < 0) futureStockEl.classList.add('text-destructive');
                          else futureStockEl.classList.remove('text-destructive');
                        }
                      }}
                    />
                    <div className="text-xs text-muted-foreground mt-1 text-right">
                      Stock final estimado: <span id="future-stock" className="font-bold">{item.stock_qty}</span> {item.unit}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notas (Opcional)</Label>
                    <Input name="notes" placeholder="Motivo del movimiento..." />
                  </div>

                  <DialogFooter>
                    <Button type="submit">Guardar Movimiento</Button>
                  </DialogFooter>
                </form>
              );
            })()
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
