export const CURRENCY_SYMBOL = "$";
export const CURRENCY_CODE = "COP";

const decimalFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return Number.isFinite(amount) ? `$ ${decimalFormatter.format(amount)}` : "—";
}

export function formatCurrencyInt(amount: number): string {
  return Number.isFinite(amount) ? `$ ${integerFormatter.format(Math.round(amount))}` : "—";
}
