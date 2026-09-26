import { z } from "zod";

/**
 * Regla centralizada y robusta de validación de número de teléfono.
 * - Obligatorio.
 * - Mínimo 10 dígitos (formato estándar colombiano, ej: 3001234567, o 12 con indicativo +57...).
 * - Solo dígitos, con el signo + permitido únicamente al inicio si se incluye indicativo de país.
 * - Rechazar patrones obviamente inválidos como todos los dígitos iguales (0000000000, 1111111111, etc.).
 * - Reutilizada en registro, edición de perfil y backend.
 */
export const phoneSchema = z
  .string({ required_error: "El número de teléfono es obligatorio" })
  .trim()
  .min(1, "El número de teléfono es obligatorio")
  .superRefine((val, ctx) => {
    // 1. Validar que solo contenga dígitos y opcionalmente un '+' únicamente al inicio
    const validCharsRegex = /^\+?[0-9]+$/;
    if (!validCharsRegex.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El teléfono solo puede contener dígitos numéricos (y '+' únicamente al inicio)",
      });
      return;
    }

    // 2. Extraer los dígitos puros para contar y validar longitud y patrones
    const digitsOnly = val.replace(/\D/g, "");

    // Si tiene indicativo +57 o similar
    if (val.startsWith("+")) {
      if (digitsOnly.length < 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Con indicativo internacional debe tener al menos 12 dígitos (ej: +573001234567)",
        });
        return;
      }
    } else {
      if (digitsOnly.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El teléfono debe tener al menos 10 dígitos (ej: 3001234567)",
        });
        return;
      }
    }

    if (digitsOnly.length > 15) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El número de teléfono no puede exceder 15 dígitos",
      });
      return;
    }

    // 3. Rechazar patrones obviamente inválidos (todos los dígitos iguales, ej: 0000000000, +570000000000, 1111111111)
    const localDigits = val.startsWith("+57") ? digitsOnly.slice(2) : digitsOnly;
    const allSame = localDigits.length > 0 && localDigits.split("").every((d) => d === localDigits[0]);
    if (allSame) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Número de teléfono inválido (no puede tener todos los dígitos iguales)",
      });
      return;
    }
  });

export const optionalPhoneSchema = z.union([
  z.literal(""),
  phoneSchema,
]);

export type PhoneSchema = z.infer<typeof phoneSchema>;
