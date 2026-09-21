import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, AlertTriangle, Search, Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function InventoryPanel({ farmerId: propFarmerId }: { farmerId?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [movOpen, setMovOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
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
    return (items.data ?? []).filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [items.data, query]);

  useEffect(() => { setPage(1); }, [query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page]);

  const createItem = useMutation({
    mutationFn: async (input: { name: string; unit: string; stock_qty: number; min_stock: number; unit_cost: number }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("No session");
      const { error } = await supabase.from("inventory_items").insert({ ...input, owner_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); setOpen(false); toast.success("Item created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async (input: { id: string; name: string; unit: string; min_stock: number; unit_cost: number }) => {
      const { error } = await supabase.from("inventory_items").update(input).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); setEditOpen(false); setEditingItem(null); toast.success("Item actualizado"); },
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

  const lowStockItems = (items.data ?? []).filter((i) => i.stock_qty <= i.min_stock);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Package className="size-4 text-primary" />
          {t("inventory.title")} ({items.data?.length ?? 0})
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" /> {t("inventory.add_item")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("inventory.add_item")}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createItem.mutate({ name: fd.get("name") as string, unit: fd.get("unit") as string, stock_qty: Number(fd.get("stock_qty")), min_stock: Number(fd.get("min_stock")), unit_cost: Number(fd.get("unit_cost")) }); }} className="space-y-3">
              <div className="space-y-2"><Label>{t("inventory.item_name")}</Label><Input name="name" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>{t("inventory.unit")}</Label>
                  <Select name="unit" defaultValue="KG"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="KG">KG</SelectItem><SelectItem value="L">L</SelectItem><SelectItem value="UN">UN</SelectItem><SelectItem value="SACO">SACO</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2"><Label>{t("inventory.stock")}</Label><Input name="stock_qty" type="number" inputMode="decimal" defaultValue="0" step="any" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>{t("inventory.min_stock")}</Label><Input name="min_stock" type="number" inputMode="decimal" defaultValue="0" step="any" /></div>
                <div className="space-y-2"><Label>{t("inventory.unit_cost")}</Label><Input name="unit_cost" type="number" inputMode="decimal" defaultValue="0" step="any" /></div>
              </div>
              <DialogFooter><Button type="submit">{t("common.create")}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en inventario…" className="pl-8" />
      </div>

      {lowStockItems.length > 0 && (
        <div className="space-y-1">
          {lowStockItems.map((i) => (
            <Badge key={i.id} variant="destructive" className="w-full justify-start gap-1 text-xs">
              <AlertTriangle className="size-3" />
              {t("inventory.low_stock_alert", { name: i.name, stock: i.stock_qty, unit: i.unit })}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paginated.map((item) => (
          <Card key={item.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{item.name}</h3>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">{item.unit}</Badge>
                <button onClick={() => { setEditingItem(item); setEditOpen(true); }} className="text-muted-foreground hover:text-foreground" title="Editar"><Edit3 className="size-3.5" /></button>
                <button onClick={() => { if (confirm(`¿Eliminar "${item.name}"?`)) deleteItem.mutate(item.id); }} className="text-muted-foreground hover:text-destructive" title="Eliminar"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">{Number(item.stock_qty).toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">/ mín {Number(item.min_stock).toFixed(1)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Costo unit: $ {Number(item.unit_cost).toFixed(2)}</p>
            <Dialog open={movOpen === item.id} onOpenChange={(v) => setMovOpen(v ? item.id : null)}>
              <DialogTrigger asChild><Button variant="outline" size="sm" className="w-full">{t("inventory.movement")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{item.name} — {t("inventory.movement")}</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); addMovement.mutate({ item_id: item.id, kind: fd.get("kind") as string, qty: Number(fd.get("qty")), notes: (fd.get("notes") as string) || undefined }); }} className="space-y-3">
                  <Select name="kind" defaultValue="ENTRADA"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ENTRADA">{t("inventory.entry")}</SelectItem><SelectItem value="SALIDA">{t("inventory.exit")}</SelectItem><SelectItem value="AJUSTE">{t("inventory.adjust")}</SelectItem></SelectContent></Select>
                  <Input name="qty" type="number" inputMode="decimal" step="any" placeholder="Cantidad" required />
                  <Input name="notes" placeholder="Notas" />
                  <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Card>
        ))}
      </div>

      {filtered.length > pageSize && <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar {editingItem?.name}</DialogTitle></DialogHeader>
          {editingItem && (
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); updateItem.mutate({ id: editingItem.id, name: fd.get("name") as string, unit: fd.get("unit") as string, min_stock: Number(fd.get("min_stock")), unit_cost: Number(fd.get("unit_cost")) }); }} className="space-y-3">
              <div className="space-y-2"><Label>Nombre</Label><Input name="name" defaultValue={editingItem.name} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Unidad</Label>
                  <Select name="unit" defaultValue={editingItem.unit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="KG">KG</SelectItem><SelectItem value="L">L</SelectItem><SelectItem value="UN">UN</SelectItem><SelectItem value="SACO">SACO</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2"><Label>Stock mínimo</Label><Input name="min_stock" type="number" inputMode="decimal" step="any" defaultValue={editingItem.min_stock} /></div>
              </div>
              <div className="space-y-2"><Label>Costo unitario</Label><Input name="unit_cost" type="number" inputMode="decimal" step="any" defaultValue={editingItem.unit_cost} /></div>
              <DialogFooter><Button type="submit" disabled={updateItem.isPending}>Guardar cambios</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
