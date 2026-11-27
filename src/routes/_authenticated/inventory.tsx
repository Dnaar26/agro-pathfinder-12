import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { InventoryPanel } from "@/components/inventory/inventory-panel";
import { DoseCalculatorDialog } from "@/components/inventory/dose-calculator-dialog";
import { BulkInventoryCsvDialog } from "@/components/inventory/bulk-inventory-csv-dialog";
import { ProducerScopeBar, useProducerScope } from "@/components/admin/producer-scope-bar";

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
  const { isStaff, isAdmin, producerId, setProducerId, groupByFarm, setGroupByFarm, producers, activeProducer } = useProducerScope();
  const isReadOnlyTech = isStaff && !isAdmin;

  const clearUrlFilters = () => {
    navigate({ to: "/inventory", search: {}, replace: true });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("inventory.title")}</h1>
          <p className="text-sm text-muted-foreground">
            Registra y controla insumos agrícolas con filtrado inteligente, Kardex y calculadora de mezcla.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isReadOnlyTech && (
            <BulkInventoryCsvDialog
              targetOwnerId={producerId || undefined}
              targetOwnerName={activeProducer?.full_name}
              isAdmin={isAdmin}
              buttonLabel="Importar CSV"
            />
          )}
          <DoseCalculatorDialog />
        </div>
      </header>

      <ProducerScopeBar
        isStaff={isStaff}
        producerId={producerId}
        onProducerChange={setProducerId}
        groupByFarm={groupByFarm}
        onGroupByFarmChange={setGroupByFarm}
        producers={producers}
        recordLabel="bodegas"
      />

      <Suspense fallback={<div className="h-[300px] rounded-xl bg-muted animate-pulse" />}>
        <InventoryPanel
          farmerId={producerId || undefined}
          groupedByOwner={Boolean(isStaff && !producerId && groupByFarm)}
          onFocusProducer={setProducerId}
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
