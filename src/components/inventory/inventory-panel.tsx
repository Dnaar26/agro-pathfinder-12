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
import { Package, Plus, AlertTriangle, Search, Edit3, Trash2, TrendingDown, TrendingUp, BarChart3, List, Grid3X3, Filter, DollarSign, Layers, Shield } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const formatCOP = (n: number) => '$ ' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

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
  const formRef = useRef<HTMLFormElement>(null);
  const [unit, setUnit] = useState("KG");
  const [category, setCategory] = useState("Otro");
  const [editUnit, setEditUnit] = useState("KG");
  const [editCategory, setEditCategory] = useState("Otro");
  const [movKind, setMovKind] = useState("ENTRADA");

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
      const isStaff = (roles ?? []).some((r) => ["tecnico", "admin"].includes(r.role));
      let q = supabase.from("inventory_items").select("*");
      if (propFarmerId) q = q.eq("owner_id", propFarmerId);
      else if (!isStaff) q = q.eq("owner_id", u.user.id);
      const { data } = await q.order("name");
      return data ?? [];
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
      const { error } = await supabase.from("inventory_items").insert({ ...input, owner_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["inventory"] }); 
      setOpen(false); 
      setUnit("KG");
      setCategory("Otro");
      formRef.current?.reset();
      toast.success("Item created"); 
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async (input: { id: string; name: string; category: string; unit: string; min_stock: number; unit_cost: number }) => {
      const { error } = await supabase.from("inventory_items").update(input).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["inventory"] }); 
      setEditOpen(false); 
      setEditingItem(null); 
      toast.success("Item actualizado"); 
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
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-1" /> {t("inventory.add_item")}
                </Button>
              </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("inventory.add_item")}</DialogTitle>
              </DialogHeader>
              <form
                ref={formRef}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createItem.mutate({
                    name: fd.get("name") as string,
                    category,
                    unit,
                    stock_qty: Number(fd.get("stock_qty")),
                    min_stock: Number(fd.get("min_stock")),
                    unit_cost: Number(fd.get("unit_cost")),
                  });
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>{t("inventory.item_name")}</Label>
                  <Input name="name" required />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                    <Label>{t("inventory.stock")}</Label>
                    <Input name="stock_qty" type="number" inputMode="decimal" defaultValue="0" step="any" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("inventory.min_stock")}</Label>
                    <Input name="min_stock" type="number" inputMode="decimal" defaultValue="0" step="any" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Costo Unitario (COP)</Label>
                  <Input name="unit_cost" type="number" inputMode="decimal" defaultValue="0" step="any" />
                </div>

                <DialogFooter>
                  <Button type="submit">{t("common.create")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
