import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getMyRoles, listFarmerSummaries } from "@/lib/queries";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tractor,
  Layers,
  List,
  X,
  ChevronDown,
  ChevronUp,
  FileBarChart2,
  UserCheck,
} from "lucide-react";

const PRODUCER_SCOPE_KEY = "sigic:staff:producer-scope";
const GROUP_BY_FARM_KEY = "sigic:staff:group-by-farm";
const SCOPE_EVENT = "sigic:producer-scope-change";

export function getStoredProducerScope(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(PRODUCER_SCOPE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setGlobalProducerScope(producerId: string) {
  if (typeof window === "undefined") return;
  try {
    if (producerId) {
      window.sessionStorage.setItem(PRODUCER_SCOPE_KEY, producerId);
    } else {
      window.sessionStorage.removeItem(PRODUCER_SCOPE_KEY);
    }
    window.dispatchEvent(new CustomEvent(SCOPE_EVENT, { detail: { producerId } }));
  } catch {
    /* ignore storage restrictions */
  }
}

function getStoredGroupByFarm(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.sessionStorage.getItem(GROUP_BY_FARM_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function useProducerScope() {
  const rolesQuery = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const roles = rolesQuery.data ?? [];
  const isAdmin = roles.includes("admin");
  const isStaff = isAdmin || roles.includes("tecnico");

  const [producerId, setProducerIdState] = useState<string>(() => getStoredProducerScope());
  const [groupByFarm, setGroupByFarmState] = useState<boolean>(() => getStoredGroupByFarm());

  useEffect(() => {
    setProducerIdState(getStoredProducerScope());
    setGroupByFarmState(getStoredGroupByFarm());

    const onScopeChange = (ev: Event) => {
      const custom = ev as CustomEvent<{ producerId?: string }>;
      setProducerIdState(custom.detail?.producerId ?? getStoredProducerScope());
    };
    window.addEventListener(SCOPE_EVENT, onScopeChange);
    return () => window.removeEventListener(SCOPE_EVENT, onScopeChange);
  }, []);

  const setProducerId = useCallback((nextId: string) => {
    setProducerIdState(nextId);
    setGlobalProducerScope(nextId);
  }, []);

  const setGroupByFarm = useCallback((nextVal: boolean) => {
    setGroupByFarmState(nextVal);
    try {
      window.sessionStorage.setItem(GROUP_BY_FARM_KEY, nextVal ? "1" : "0");
    } catch {
      /* noop */
    }
  }, []);

  const farmersQuery = useQuery({
    queryKey: ["admin-farmers"],
    queryFn: listFarmerSummaries,
    enabled: isStaff,
    staleTime: 60_000,
  });

  const activeProducer = isStaff && producerId
    ? (farmersQuery.data ?? []).find((f) => f.id === producerId) ?? null
    : null;

  return {
    isStaff,
    isAdmin,
    producerId: isStaff ? producerId : "",
    setProducerId,
    groupByFarm: isStaff ? groupByFarm : false,
    setGroupByFarm,
    producers: farmersQuery.data ?? [],
    activeProducer,
    isLoadingProducers: farmersQuery.isLoading,
  };
}

export function ProducerScopeBar({
  isStaff,
  producerId,
  onProducerChange,
  groupByFarm,
  onGroupByFarmChange,
  producers,
  allowGroupToggle = true,
  totalRecordsCount,
  recordLabel = "registros",
}: {
  isStaff: boolean;
  producerId: string;
  onProducerChange: (id: string) => void;
  groupByFarm?: boolean;
  onGroupByFarmChange?: (grouped: boolean) => void;
  producers: { id: string; full_name: string; parcels: number; area_m2: number }[];
  allowGroupToggle?: boolean;
  totalRecordsCount?: number;
  recordLabel?: string;
}) {
  if (!isStaff) return null;

  const selectedFarmer = producerId ? producers.find((p) => p.id === producerId) : null;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 sm:px-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Tractor className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Vista por Unidad Productiva / Finca
            </span>
            {selectedFarmer ? (
              <Badge className="bg-primary text-primary-foreground text-[10px]">
                Enfocado: {selectedFarmer.full_name}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-card">
                {producers.length} fincas registradas
              </Badge>
            )}
            {typeof totalRecordsCount === "number" && (
              <span className="text-[11px] text-muted-foreground">
                · {totalRecordsCount} {recordLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {selectedFarmer
              ? `Mostrando exclusivamente datos de la finca de ${selectedFarmer.full_name} (${(selectedFarmer.area_m2 / 10000).toFixed(2)} ha).`
              : "Organiza los registros separados por cada productor/finca o filtra una unidad específica."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Combobox
          value={producerId}
          onChange={onProducerChange}
          options={[
            { value: "", label: "Todas las fincas (Vista organizada)" },
            ...producers.map((f) => ({
              value: f.id,
              label: `${f.full_name} (${f.parcels} lotes · ${(f.area_m2 / 10000).toFixed(1)} ha)`,
            })),
          ]}
          placeholder="Todas las fincas"
          searchPlaceholder="Buscar finca o productor…"
          className="w-full sm:w-72 bg-card"
        />

        {producerId ? (
          <>
            <Button
              asChild
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5 bg-card"
            >
              <Link to="/reports">
                <FileBarChart2 className="size-3.5 text-primary" />
                Expediente
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onProducerChange("")}
              className="h-9 px-2.5 text-xs gap-1"
            >
              <X className="size-3.5" /> Ver todas
            </Button>
          </>
        ) : (
          allowGroupToggle &&
          onGroupByFarmChange && (
            <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => onGroupByFarmChange(true)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  groupByFarm
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="size-3.5" /> Por finca
              </button>
              <button
                type="button"
                onClick={() => onGroupByFarmChange(false)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  !groupByFarm
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="size-3.5" /> Lista plana
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function FarmGroupSection({
  ownerId,
  ownerName,
  subtitle,
  badgeText,
  onFocusProducer,
  defaultOpen = true,
  children,
}: {
  ownerId?: string;
  ownerName: string;
  subtitle?: string;
  badgeText?: string;
  onFocusProducer?: (id: string) => void;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const initial = (ownerName || "F").trim().charAt(0).toUpperCase();

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/35 px-4 py-3 border-b border-border/70">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-3 text-left min-w-0 flex-1"
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary font-bold text-sm">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                Unidad Productiva: {ownerName}
              </h2>
              {badgeText && (
                <Badge variant="secondary" className="text-[11px]">
                  {badgeText}
                </Badge>
              )}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>}
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {ownerId && onFocusProducer && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onFocusProducer(ownerId)}
              className="h-8 text-xs gap-1 bg-card"
            >
              <UserCheck className="size-3.5 text-primary" />
              Enfocar finca
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? `Contraer ${ownerName}` : `Expandir ${ownerName}`}
          >
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </div>

      {open && <div className="p-4">{children}</div>}
    </section>
  );
}
