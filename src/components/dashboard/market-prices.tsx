import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMarketPrices, type MarketPrice } from "@/lib/services/market-prices";
import { Search, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";

export function MarketPrices() {
  const [search, setSearch] = useState("");

  const prices = useQuery({
    queryKey: ["market-prices"],
    queryFn: () => fetchMarketPrices(),
    refetchInterval: 1000 * 60 * 60,
  });

  const filteredPrices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const data = prices.data ?? [];
    if (!q) return data.slice(0, 6);
    return data.filter((p) => p.product.toLowerCase().includes(q));
  }, [prices.data, search]);

  const formatCOP = (val: number) =>
    "$ " + val.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-1.5">
          <TrendingUp className="size-4 text-primary" />
          Precios de Mercado (SIPSA)
        </h4>
        <button
          onClick={() => prices.refetch()}
          disabled={prices.isFetching}
          className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
          title="Actualizar precios"
        >
          <RefreshCw className={`size-3.5 ${prices.isFetching ? "animate-spin text-primary" : ""}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto (ej: Papa, Café)..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      <div className="divide-y divide-border rounded-lg border border-border text-xs bg-card">
        {filteredPrices.map((p) => (
          <div key={p.product} className="flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors">
            <div>
              <p className="font-medium text-foreground">{p.product}</p>
              <p className="text-[10px] text-muted-foreground">{p.market}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-foreground">
                {formatCOP(p.price)}/{p.unit}
              </p>
              <div className={`flex items-center justify-end gap-0.5 text-[10px] ${p.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                {p.change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                <span>{p.change >= 0 ? `+${p.change}%` : `${p.change}%`}</span>
              </div>
            </div>
          </div>
        ))}
        {prices.isLoading && (
          <div className="p-3 text-center text-muted-foreground text-xs animate-pulse">Cargando precios de abastos...</div>
        )}
        {!prices.isLoading && filteredPrices.length === 0 && (
          <div className="p-3 text-center text-muted-foreground text-xs">Sin resultados para "{search}"</div>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <span>Fuente: SIPSA - DANE / Abastos</span>
        <span>Act: Hoy</span>
      </div>
    </div>
  );
}

