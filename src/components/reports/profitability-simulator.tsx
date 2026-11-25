import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, TrendingUp, Scale } from "lucide-react";
import { formatCurrencyInt } from "@/lib/currency";

interface ProfitabilitySimulatorProps {
  defaultAreaHa?: number;
  defaultCostPerHa?: number;
}

export function ProfitabilitySimulator({
  defaultAreaHa = 2,
  defaultCostPerHa = 3500000,
}: ProfitabilitySimulatorProps) {
  const [areaHa, setAreaHa] = useState(String(Math.max(0.5, Number(defaultAreaHa.toFixed(1)) || 2)));
  const [yieldKgHa, setYieldKgHa] = useState("4500");
  const [pricePerKg, setPricePerKg] = useState("2400");
  const [costPerHa, setCostPerHa] = useState(String(Math.max(200000, Math.round(defaultCostPerHa) || 3500000)));

  const metrics = useMemo(() => {
    const ha = Math.max(0.1, Number(areaHa) || 1);
    const yld = Math.max(1, Number(yieldKgHa) || 1);
    const price = Math.max(1, Number(pricePerKg) || 1);
    const costHa = Math.max(0, Number(costPerHa) || 0);

    const totalCost = ha * costHa;
    const totalHarvestKg = ha * yld;
    const totalRevenue = totalHarvestKg * price;
    const netProfit = totalRevenue - totalCost;
    const roiPct = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    // Punto de equilibrio: cuántos kg/ha necesito cosechar para no perder dinero y cuál es el precio mínimo de venta
    const breakEvenKgPerHa = price > 0 ? costHa / price : 0;
    const breakEvenPricePerKg = yld > 0 ? costHa / yld : 0;

    return {
      totalCost,
      totalRevenue,
      netProfit,
      roiPct,
      breakEvenKgPerHa: Math.ceil(breakEvenKgPerHa),
      breakEvenPricePerKg: Math.ceil(breakEvenPricePerKg),
    };
  }, [areaHa, yieldKgHa, pricePerKg, costPerHa]);

  return (
    <Card className="p-5 space-y-4 border-primary/20 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="size-4 text-primary" />
            Simulador Interactivo de Punto de Equilibrio y Rentabilidad
          </h3>
          <p className="text-xs text-muted-foreground">
            Modela escenarios de precios de mercado, rendimiento esperado y costos antes de sembrar o vender tu cosecha.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Área sembrada (ha)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            value={areaHa}
            onChange={(e) => setAreaHa(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rendimiento est. (kg/ha)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="100"
            min="1"
            value={yieldKgHa}
            onChange={(e) => setYieldKgHa(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Precio venta ($ COP/kg)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="50"
            min="1"
            value={pricePerKg}
            onChange={(e) => setPricePerKg(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Costo producción ($ COP/ha)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="100000"
            min="0"
            value={costPerHa}
            onChange={(e) => setCostPerHa(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Scale className="size-3 text-primary" /> Punto equilibrio (kg/ha)
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums">
            {metrics.breakEvenKgPerHa.toLocaleString("es-CO")} kg/ha
          </p>
          <p className="text-[10px] text-muted-foreground">Cosecha mínima para cubrir costos</p>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-[11px] text-muted-foreground">Precio mínimo equilibrio</p>
          <p className="mt-1 text-lg font-bold tabular-nums">
            {formatCurrencyInt(metrics.breakEvenPricePerKg)} / kg
          </p>
          <p className="text-[10px] text-muted-foreground">Costo unitario por kilo producido</p>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-[11px] text-muted-foreground">Utilidad neta proyectada</p>
          <p
            className={`mt-1 text-lg font-bold tabular-nums ${
              metrics.netProfit >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {metrics.netProfit >= 0 ? "+" : ""}
            {formatCurrencyInt(metrics.netProfit)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Ingreso: {formatCurrencyInt(metrics.totalRevenue)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <TrendingUp className="size-3 text-primary" /> Retorno (ROI)
          </p>
          <p
            className={`mt-1 text-lg font-bold tabular-nums ${
              metrics.roiPct >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {metrics.roiPct >= 0 ? "+" : ""}
            {metrics.roiPct.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            Costo total: {formatCurrencyInt(metrics.totalCost)}
          </p>
        </div>
      </div>
    </Card>
  );
}
