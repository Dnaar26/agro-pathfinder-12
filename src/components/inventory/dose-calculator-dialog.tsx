import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator } from "lucide-react";

export function DoseCalculatorDialog() {
  const [areaHa, setAreaHa] = useState("1.5");
  const [dosePerHa, setDosePerHa] = useState("2");
  const [doseUnit, setDoseUnit] = useState<"L" | "KG">("L");
  const [waterPerHa, setWaterPerHa] = useState("200");
  const [tankSizeL, setTankSizeL] = useState("20");

  const calc = useMemo(() => {
    const ha = Math.max(0.01, Number(areaHa) || 0);
    const dose = Math.max(0, Number(dosePerHa) || 0);
    const waterHa = Math.max(10, Number(waterPerHa) || 200);
    const tank = Math.max(5, Number(tankSizeL) || 20);

    const totalProduct = ha * dose;
    const totalWaterL = ha * waterHa;
    const totalTanks = totalWaterL / tank;
    const productPerTank = totalTanks > 0 ? totalProduct / totalTanks : 0;
    const productPerTankSmallUnit = productPerTank * 1000; // ml o gramos por bomba/tanque

    return {
      totalProduct: totalProduct.toFixed(2),
      totalWaterL: Math.round(totalWaterL),
      totalTanks: totalTanks.toFixed(1),
      productPerTank: productPerTank.toFixed(3),
      smallUnitValue: Math.round(productPerTankSmallUnit),
      smallUnitLabel: doseUnit === "L" ? "ml" : "g",
    };
  }, [areaHa, dosePerHa, doseUnit, waterPerHa, tankSizeL]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Calculator className="size-4 text-primary" />
          <span className="hidden sm:inline">Calculadora de mezcla</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-5 text-primary" />
            Calculadora de Dosis y Mezcla por Tanque
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            Calcula exactamente cuánto insumo comprar y cuánto medir por cada bomba de espalda (20 L) o caneca (200 L) sin errores de campo.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Área del lote (ha)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0.01"
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dosis recomendada / ha</Label>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={dosePerHa}
                  onChange={(e) => setDosePerHa(e.target.value)}
                  className="flex-1"
                />
                <Select value={doseUnit} onValueChange={(v) => setDoseUnit(v as "L" | "KG")}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">L/ha</SelectItem>
                    <SelectItem value="KG">kg/ha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Volumen de agua (L/ha)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="10"
                min="20"
                value={waterPerHa}
                onChange={(e) => setWaterPerHa(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Capacidad bomba / tanque</Label>
              <Select value={tankSizeL} onValueChange={setTankSizeL}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16">Bomba 16 L</SelectItem>
                  <SelectItem value="20">Bomba espalda 20 L</SelectItem>
                  <SelectItem value="100">Tanque 100 L</SelectItem>
                  <SelectItem value="200">Caneca 200 L</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Insumo total requerido para el lote:</span>
              <span className="font-bold text-base text-foreground">
                {calc.totalProduct} {doseUnit}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Agua total y número de tanques ({tankSizeL} L):</span>
              <span className="font-semibold text-foreground">
                {calc.totalWaterL} L ({calc.totalTanks} tanques)
              </span>
            </div>
            <div className="border-t border-primary/20 pt-2 flex items-center justify-between">
              <span className="text-xs font-medium text-primary">Medida exacta por cada tanque de {tankSizeL} L:</span>
              <span className="text-base font-bold text-primary">
                {calc.smallUnitValue} {calc.smallUnitLabel}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
