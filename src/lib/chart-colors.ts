/** Theme-aware palette shared by report charts and activity summaries. */
export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"] as const;

export const KIND_COLORS: Record<string, string> = {
  RIEGO: CHART_COLORS[5],
  FERTILIZACION: CHART_COLORS[0],
  MONITOREO: CHART_COLORS[2],
  COSECHA: CHART_COLORS[3],
  PODA: CHART_COLORS[6],
  APLICACION: CHART_COLORS[4],
  SIEMBRA: CHART_COLORS[1],
};
