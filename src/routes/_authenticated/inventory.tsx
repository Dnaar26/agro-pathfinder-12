import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/queries";
import { Combobox } from "@/components/ui/combobox";
import { User } from "lucide-react";

import { InventoryPanel } from "@/components/inventory/inventory-panel";
import { DoseCalculatorDialog } from "@/components/inventory/dose-calculator-dialog";

export type InventorySearchParams = {
  q?: string;
  category?: string;
  lowStock?: boolean;
  openAdd?: boolean;
  addName?: string;
  addCategory?: string;
  addUnit?: string;
};

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventario — SIGIC" }] }),
  validateSearch: (search: Record<string, unknown>): InventorySearchParams => {
    const q = typeof search.q === "string" && search.q.trim() ? search.q.trim().slice(0, 80) : undefined;
    const category =
      typeof search.category === "string" && search.category.trim()
        ? search.category.trim().slice(0, 40)
        : undefined;
    const lowStock =
      search.lowStock === true || search.lowStock === "true" || search.lowStock === "1" || undefined;
    const openAdd =
      search.openAdd === true || search.openAdd === "true" || search.openAdd === "1" || undefined;
    const addName =
      typeof search.addName === "string" && search.addName.trim()
        ? search.addName.trim().slice(0, 90)
        : undefined;
    const addCategory =
      typeof search.addCategory === "string" && search.addCategory.trim()
        ? search.addCategory.trim().slice(0, 40)
        : undefined;
    const addUnit =
      typeof search.addUnit === "string" && search.addUnit.trim()
        ? search.addUnit.trim().slice(0, 15)
        : undefined;

    return { q, category, lowStock, openAdd, addName, addCategory, addUnit };
  },
  component: InventoryPage,
});

function InventoryPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const roles = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const [farmerId, setFarmerId] = useState("");
  const isStaff = (roles.data ?? []).some((r) => ["tecnico", "admin"].includes(r));
  const farmers = useQuery({
    queryKey: ["farmers-list"],
    queryFn: async () => {
      const { data: roleData } = await supabase.from("user_roles").select("user_id").eq("role", "agricultor");
      const ids = (roleData ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids).order("full_name");
      return data ?? [];
    },
    enabled: isStaff,
  });

  const clearUrlFilters = () => {
    navigate({ to: "/inventory", search: {}, replace: true });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("inventory.title")}</h1>
          <p className="text-sm text-muted-foreground">
            Registra y controla tus insumos agrícolas con filtrado inteligente, Kardex y calculadora de mezcla.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DoseCalculatorDialog />
          {isStaff && (
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              <Combobox
                value={farmerId}
                onChange={setFarmerId}
                options={[
                  { value: "", label: "Todos los agricultores" },
                  ...(farmers.data ?? []).map((f: any) => ({ value: f.id, label: f.full_name })),
                ]}
                placeholder="Todos los agricultores"
                searchPlaceholder="Buscar agricultor…"
                className="w-56"
              />
            </div>
          )}
        </div>
      </header>
      <Suspense fallback={<div className="h-[300px] rounded-xl bg-muted animate-pulse" />}>
        <InventoryPanel
          farmerId={farmerId || undefined}
          initialQuery={search.q}
          initialCategory={search.category}
          initialLowStock={search.lowStock}
          suggestedAdd={
            search.addName || search.openAdd
              ? {
                  openImmediately: Boolean(search.openAdd),
                  name: search.addName ?? search.q ?? "",
                  category: search.addCategory,
                  unit: search.addUnit,
                }
              : undefined
          }
          onClearExternalFilter={clearUrlFilters}
        />
      </Suspense>
    </div>
  );
}
