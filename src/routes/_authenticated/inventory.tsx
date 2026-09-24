import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/queries";
import { Combobox } from "@/components/ui/combobox";
import { User } from "lucide-react";

import { InventoryPanel } from "@/components/inventory/inventory-panel";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventario — SIGIC" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const { t } = useTranslation();
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("inventory.title")}</h1>
          <p className="text-sm text-muted-foreground">Registra y controla tus insumos agrícolas con stock mínimo y alertas de reposición.</p>
        </div>
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
      </header>
      <Suspense fallback={<div className="h-[300px] rounded-xl bg-muted animate-pulse" />}>
        <InventoryPanel farmerId={farmerId || undefined} />
      </Suspense>
    </div>
  );
}
