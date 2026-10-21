const toneStyles = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info/10 text-info border-info/30",
  success: "bg-success/10 text-success border-success/30",
  primary: "bg-primary-soft text-primary border-primary/25",
  warning: "bg-warning/15 text-warning-text border-warning/35",
  earth: "bg-earth/10 text-earth border-earth/30",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
} as const;

type Tone = keyof typeof toneStyles;

const CROP_STATUS_TONE: Record<string, Tone> = {
  PLANEADO: "neutral",
  SEMBRADO: "info",
  CRECIMIENTO: "success",
  MANTENIMIENTO: "primary",
  COSECHA: "warning",
  POSTCOSECHA: "earth",
  FINALIZADO: "neutral",
};

const SEVERITY_TONE: Record<string, Tone> = {
  BAJA: "neutral",
  MEDIA: "info",
  ALTA: "warning",
  CRITICA: "danger",
};

export const CROP_STATUS_LABEL: Record<string, string> = {
  PLANEADO: "Planeado",
  SEMBRADO: "Sembrado",
  CRECIMIENTO: "Crecimiento",
  MANTENIMIENTO: "Mantenimiento",
  COSECHA: "Cosecha",
  POSTCOSECHA: "Poscosecha",
  FINALIZADO: "Finalizado",
};

export const CROP_STATUS_OPTIONS: [string, string][] = Object.entries(CROP_STATUS_LABEL);

const SEVERITY_LABEL: Record<string, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

export const cropStatusClass = (status: string) => toneStyles[CROP_STATUS_TONE[status] ?? "neutral"];
export const cropStatusLabel = (status: string) => CROP_STATUS_LABEL[status] ?? status;
export const severityClass = (severity: string) => toneStyles[SEVERITY_TONE[severity] ?? "neutral"];
export const severityLabel = (severity: string) => SEVERITY_LABEL[severity] ?? severity;
