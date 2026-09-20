export const CURRENCY_SYMBOL = "$";
export const CURRENCY_CODE = "COP";

export function formatCurrency(amount: number): string {
  return `$ ${amount.toFixed(2)}`;
}

export function formatCurrencyInt(amount: number): string {
  return `$ ${Math.round(amount).toLocaleString("es-CO")}`;
}
