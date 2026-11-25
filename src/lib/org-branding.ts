import { supabase } from "@/integrations/supabase/client";

export interface OrgBrandingConfig {
  orgName: string;
  orgNit: string;
  orgMunicipality: string;
  orgLogoUrl: string;
}

const BRANDING_CACHE_KEY = "sigic:org:branding:v9";

const EMPTY_BRANDING: OrgBrandingConfig = {
  orgName: "",
  orgNit: "",
  orgMunicipality: "",
  orgLogoUrl: "",
};

export function getCachedOrgBranding(): OrgBrandingConfig {
  if (typeof window === "undefined") return EMPTY_BRANDING;
  try {
    const raw = window.localStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) return EMPTY_BRANDING;
    const parsed = JSON.parse(raw) as Partial<OrgBrandingConfig>;
    return {
      orgName: String(parsed.orgName ?? "").trim(),
      orgNit: String(parsed.orgNit ?? "").trim(),
      orgMunicipality: String(parsed.orgMunicipality ?? "").trim(),
      orgLogoUrl: String(parsed.orgLogoUrl ?? "").trim(),
    };
  } catch {
    return EMPTY_BRANDING;
  }
}

function setCachedOrgBranding(cfg: OrgBrandingConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchOrgBranding(): Promise<OrgBrandingConfig> {
  const cached = getCachedOrgBranding();
  try {
    const { data, error } = await (supabase as any)
      .from("alert_settings")
      .select("org_name, org_nit, org_municipality, org_logo_url")
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return cached;

    const resolved: OrgBrandingConfig = {
      orgName: String(data.org_name ?? cached.orgName ?? "").trim(),
      orgNit: String(data.org_nit ?? cached.orgNit ?? "").trim(),
      orgMunicipality: String(data.org_municipality ?? cached.orgMunicipality ?? "").trim(),
      orgLogoUrl: String(data.org_logo_url ?? cached.orgLogoUrl ?? "").trim(),
    };
    setCachedOrgBranding(resolved);
    return resolved;
  } catch {
    return cached;
  }
}

export async function saveOrgBranding(cfg: OrgBrandingConfig, updatedBy?: string | null): Promise<{ persistedInDb: boolean }> {
  const clean: OrgBrandingConfig = {
    orgName: cfg.orgName.trim().slice(0, 140),
    orgNit: cfg.orgNit.trim().slice(0, 40),
    orgMunicipality: cfg.orgMunicipality.trim().slice(0, 100),
    orgLogoUrl: cfg.orgLogoUrl.trim(),
  };
  setCachedOrgBranding(clean);

  try {
    const { error } = await (supabase as any)
      .from("alert_settings")
      .update({
        org_name: clean.orgName || null,
        org_nit: clean.orgNit || null,
        org_municipality: clean.orgMunicipality || null,
        org_logo_url: clean.orgLogoUrl || null,
        updated_by: updatedBy ?? null,
      })
      .eq("id", true);

    if (error) {
      return { persistedInDb: false };
    }
    return { persistedInDb: true };
  } catch {
    return { persistedInDb: false };
  }
}

/**
 * Comprime cualquier imagen seleccionada desde cámara o galería a un DataURL ligero
 * optimizado para redes rurales (logos con transparencia PNG o fotos JPEG ligeras).
 */
export async function compressImageFileToDataUrl(
  file: File,
  opts: { maxDimension?: number; quality?: number; preservePng?: boolean } = {}
): Promise<string> {
  const maxDim = opts.maxDimension ?? 640;
  const quality = opts.quality ?? 0.74;
  const usePng = Boolean(opts.preservePng && file.type === "image/png");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No fue posible leer el archivo de imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagen no compatible."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = maxDim / Math.max(width, height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo inicializar el procesador gráfico."));
          return;
        }
        if (!usePng) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        const mime = usePng ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(mime, quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
