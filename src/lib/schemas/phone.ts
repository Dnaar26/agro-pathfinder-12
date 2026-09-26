import { z } from "zod";

/**
 * Regla centralizada y única de validación de número de teléfono.
 * Mínimo 7 dígitos, máximo 20 caracteres.
 * Reutilizada en formularios de registro, edición de perfil y backend.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Ingresa un teléfono válido (mínimo 7 dígitos)")
  .max(20, "El teléfono no puede superar 20 caracteres")
  .regex(/^[\d\s\+\-\(\)]+$/, "El teléfono solo puede contener dígitos, espacios y símbolos (+, -)");

export const optionalPhoneSchema = z.union([
  z.literal(""),
  phoneSchema,
]);

export type PhoneSchema = z.infer<typeof phoneSchema>;
