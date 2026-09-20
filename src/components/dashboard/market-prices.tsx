import { useQuery } from "@tanstack/react-query";
import { fetchMarketPrices, type MarketPrice } from "@/lib/services/market-prices";

export function MarketPrices() {
  const prices = useQuery({
    queryKey: ["market-prices"],
    queryFn: () => fetchMarketPrices(),
    refetchInterval: 1000 * 60 * 60,
  });

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">Precios de Mercado</h4>
      <div className="divide-y divide-border rounded-lg border border-border text-xs">
        {(prices.data ?? []).slice(0, 5).map((p) => (
          <div key={p.product} className="flex items-center justify-between px-3 py-1.5">
            <span>{p.product}</span>
            <span className={p.change >= 0 ? "text-green-600" : "text-red-500"}>
              $ {p.price.toFixed(0)}/{p.unit}
            </span>
          </div>
        ))}
        {!prices.data?.length && (
          <div className="p-3 text-muted-foreground">Cargando precios...</div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Fuente: DANE / Central de Abastos</p>
    </div>
  );
}
