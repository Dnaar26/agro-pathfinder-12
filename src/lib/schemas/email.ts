import { z } from "zod";

export const TYPO_DOMAINS: Record<string, string> = {
  "gnil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaul.com": "gmail.com",
  "gemail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmial.co": "hotmail.com",
  "hormail.com": "hotmail.com",
  "hotamail.com": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yaho.es": "yahoo.es",
  "yaho.co": "yahoo.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlock.com": "outlook.com",
  "icwoud.com": "icloud.com",
  "con.com": "com",
};

/**
 * Valida de forma síncrona la estructura y dominios mal escritos o falsos conocidos.
 */
export function validateEmailClientSync(emailStr: string): { valid: boolean; error?: string } {
  const clean = emailStr.trim().toLowerCase();
  const parts = clean.split("@");
  if (parts.length !== 2) {
    return { valid: false, error: "Formato de correo electrónico inválido" };
  }
  const [local, domain] = parts;
  if (!local || local.length < 1) {
    return { valid: false, error: "Ingresa el nombre de usuario antes del @" };
  }
  if (!domain || !domain.includes(".")) {
    return { valid: false, error: `El dominio '${domain}' no es válido. Usa un correo real.` };
  }
  const tld = domain.split(".").pop();
  if (!tld || tld.length < 2) {
    return { valid: false, error: `La extensión del dominio '.${tld}' no es válida.` };
  }

  // Detección de errores tipográficos en dominios comunes (ej: gnil.com)
  if (TYPO_DOMAINS[domain]) {
    const suggested = TYPO_DOMAINS[domain];
    return {
      valid: false,
      error: `El dominio '${domain}' no existe o está mal escrito. ¿Quisiste escribir ${suggested}?`,
    };
  }

  return { valid: true };
}

export const emailSchema = z
  .string()
  .trim()
  .email("Correo electrónico inválido")
  .max(180)
  .superRefine((val, ctx) => {
    const res = validateEmailClientSync(val);
    if (!res.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || "El dominio del correo no es válido",
      });
    }
  });
