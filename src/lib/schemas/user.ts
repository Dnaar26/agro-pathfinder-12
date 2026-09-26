import { z } from "zod";
import { phoneSchema } from "./phone";
import { emailSchema } from "./email";

/**
 * Regla de validación para Nombre y Apellido:
 * - Obligatorios, no pueden quedar vacíos ni contener solo espacios.
 * - Longitud entre 2 y 50 caracteres.
 * - Solo letras (incluyendo tildes á, é, í, ó, ú, ü, Á, É, Í, Ó, Ú, Ü y ñ, Ñ) y espacios.
 * - Rechazar números o símbolos.
 * - Recortar (trim) espacios al inicio y final.
 */
const nameRegex = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+(?:\s+[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+)*$/;

export const nameFieldSchema = (fieldName: "Nombre" | "Apellido") =>
  z
    .string({ required_error: `El ${fieldName.toLowerCase()} es obligatorio` })
    .trim()
    .min(1, `El ${fieldName.toLowerCase()} es obligatorio`)
    .min(2, `El ${fieldName.toLowerCase()} debe tener al menos 2 caracteres`)
    .max(50, `El ${fieldName.toLowerCase()} no puede exceder 50 caracteres`)
    .refine((val) => nameRegex.test(val), {
      message: `El ${fieldName.toLowerCase()} solo puede contener letras y espacios (sin números ni símbolos)`,
    });

export const firstNameSchema = nameFieldSchema("Nombre");
export const lastNameSchema = nameFieldSchema("Apellido");

/**
 * Lista de contraseñas débiles y demasiado comunes.
 */
export const COMMON_PASSWORDS = new Set([
  "123456", "12345678", "123456789", "password", "contraseña", "qwerty",
  "admin123", "secret", "welcome", "iloveyou", "111111", "000000",
  "password123", "contrasena", "abc123", "12345678aA!", "Password123!",
]);

/**
 * Validador de contraseña:
 * - Mínimo 8 caracteres.
 * - Al menos una mayúscula, una minúscula y un número.
 * - Al menos un carácter especial (!@#$%^&* etc.).
 * - Rechazar contraseñas comunes.
 * - No debe contener nombre, apellido ni usuario del correo.
 */
export function validatePasswordSecurity(
  pass: string,
  context?: { firstName?: string; lastName?: string; email?: string }
): { valid: boolean; error?: string } {
  if (!pass || pass.length < 8) {
    return { valid: false, error: "La contraseña debe tener al menos 8 caracteres" };
  }
  if (!/[A-Z]/.test(pass)) {
    return { valid: false, error: "La contraseña debe incluir al menos una letra mayúscula" };
  }
  if (!/[a-z]/.test(pass)) {
    return { valid: false, error: "La contraseña debe incluir al menos una letra minúscula" };
  }
  if (!/[0-9]/.test(pass)) {
    return { valid: false, error: "La contraseña debe incluir al menos un número" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pass)) {
    return { valid: false, error: "La contraseña debe incluir al menos un carácter especial (!@#$%^&* etc.)" };
  }

  // Rechazar contraseñas comunes
  const lower = pass.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return { valid: false, error: "Esta contraseña es demasiado común y fácil de adivinar. Elige una más segura" };
  }

  // No debe contener nombre, apellido o parte local del correo
  if (context) {
    const fName = (context.firstName || "").trim().toLowerCase();
    const lName = (context.lastName || "").trim().toLowerCase();
    const emailPrefix = (context.email || "").split("@")[0].trim().toLowerCase();

    if (fName.length >= 3 && lower.includes(fName)) {
      return { valid: false, error: "La contraseña no debe contener tu nombre" };
    }
    if (lName.length >= 3 && lower.includes(lName)) {
      return { valid: false, error: "La contraseña no debe contener tu apellido" };
    }
    if (emailPrefix.length >= 3 && lower.includes(emailPrefix)) {
      return { valid: false, error: "La contraseña no debe contener tu usuario de correo" };
    }
  }

  return { valid: true };
}

export const passwordBaseSchema = z
  .string({ required_error: "La contraseña es obligatoria" })
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede exceder 72 caracteres")
  .superRefine((val, ctx) => {
    const res = validatePasswordSecurity(val);
    if (!res.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || "Contraseña insegura",
      });
    }
  });

/**
 * Schema completo de registro (validado en backend y frontend).
 */
export const signupSchema = z
  .object({
    firstName: firstNameSchema,
    lastName: lastNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordBaseSchema,
  })
  .superRefine((data, ctx) => {
    const passCheck = validatePasswordSecurity(data.password, {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
    });
    if (!passCheck.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: passCheck.error || "Contraseña inválida",
      });
    }
  });
