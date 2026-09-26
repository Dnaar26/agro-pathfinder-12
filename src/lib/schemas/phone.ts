import { z } from "zod";

/**
 * Regla centralizada de validación de número de teléfono.
 * Mínimo 7 dígitos, máximo 20 caracteres.
 * Reutilizable en formularios de registro y edición de perfil.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "El teléfono debe tener al menos 7 dígitos")
  .max(20, "El teléfono no puede superar 20 caracteres")
  .regex(/^[\d\s\+\-\(\)]+$/, "El teléfono solo puede contener dígitos, espacios, +, -, ( y )");

/**
 * Para edición de perfil, si es opcional o si se ingresa debe cumplir con phoneSchema
 */
export const optionalPhoneSchema = z.union([
  z.literal(""),
  phoneSchema,
]);

export type PhoneSchema = z.infer<typeof phoneSchema>;
