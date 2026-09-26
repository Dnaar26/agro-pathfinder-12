import { createServerFn } from "@tanstack/react-start";
import { createClient, type User } from "@supabase/supabase-js";
import { z } from "zod";
import { promises as dnsPromises } from "dns";
import { phoneSchema, optionalPhoneSchema } from "@/lib/schemas/phone";

const TYPO_DOMAINS = new Set([
  "gnil.com", "gmaill.com", "gmai.com", "gamil.com", "gmial.com",
  "hotmial.com", "hotmai.com", "yaho.com", "yahooo.com", "outlok.com",
  "outloo.com", "icwoud.com", "con.com", "gm.com",
]);

/** Verifica que el dominio del correo es válido y tiene registros MX. */
async function validateEmailDomain(email: string): Promise<void> {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) throw new Error("Formato de correo electrónico inválido.");
  
  const domain = parts[1];
  if (!domain || !domain.includes(".")) {
    throw new Error(`El dominio '${domain}' no es válido. Usa un correo real.`);
  }

  // 1. Detección inmediata de dominios con error tipográfico común
  if (TYPO_DOMAINS.has(domain)) {
    throw new Error(`El dominio '${domain}' no existe o está mal escrito. Verifica si quisiste escribir gmail.com, hotmail.com u otro.`);
  }

  // 2. Validación de registros MX vía DNS
  try {
    const records = await dnsPromises.resolveMx(domain);
    if (!records || records.length === 0) {
      throw new Error(`El dominio '${domain}' no tiene servidores de correo válidos. Usa una dirección real.`);
    }
  } catch (err: any) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA" || err.code === "SERVFAIL") {
      throw new Error(`El dominio '${domain}' no existe o no puede recibir correos. Usa un correo real.`);
    }
    if (err.message && err.message.startsWith("El dominio")) throw err;
    // Si hay un error de resolución DNS, rechazar por seguridad
    throw new Error(`No se pudo verificar el dominio '${domain}'. Asegúrate de usar un correo válido.`);
  }
}

export const ACCESS_COOKIE = "sigic_access_token";
export const REFRESH_COOKIE = "sigic_refresh_token";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function authClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    const missing = [
      ...(!supabaseUrl ? ["SUPABASE_URL / VITE_SUPABASE_URL"] : []),
      ...(!publishableKey ? ["SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Configuracion Supabase incompleta: ${missing.join(", ")}`);
  }

  return createClient(
    supabaseUrl,
    publishableKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function requireCookieUser(): Promise<User> {
  const { deleteCookie, getCookie, setCookie } = await import("@tanstack/react-start/server");
  let accessToken = getCookie(ACCESS_COOKIE);
  if (!accessToken) {
    const refreshToken = getCookie(REFRESH_COOKIE);
    if (!refreshToken) throw new Error("No autorizado");
    const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      deleteCookie(ACCESS_COOKIE, cookieOptions);
      deleteCookie(REFRESH_COOKIE, cookieOptions);
      throw new Error("No autorizado");
    }
    setCookie(ACCESS_COOKIE, data.session.access_token, { ...cookieOptions, maxAge: data.session.expires_in ?? 3600 });
    setCookie(REFRESH_COOKIE, data.session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
    accessToken = data.session.access_token;
  }

  const { data, error } = await authClient().auth.getUser(accessToken);
  if (error || !data.user) throw new Error("No autorizado");
  return data.user;
}

const emailSchema = z.string().trim().email().max(180);
const passwordSchema = z.string().min(8).max(72);
const signupPasswordSchema = passwordSchema.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/);

/** Server function que puede llamar el frontend para validar MX antes del registro. */
export const validateDomainMx = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: emailSchema }))
  .handler(async ({ data }) => {
    await validateEmailDomain(data.email.trim().toLowerCase());
    return { valid: true };
  });

export const syncHttpOnlySession = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    accessToken: z.string().min(20),
    refreshToken: z.string().min(20),
    expiresIn: z.number().int().positive().max(60 * 60 * 24).optional(),
  }))
  .handler(async ({ data }) => {
    const { setCookie } = await import("@tanstack/react-start/server");
    const { data: auth, error } = await authClient().auth.getUser(data.accessToken);
    if (error || !auth.user) throw new Error("No autorizado");
    setCookie(ACCESS_COOKIE, data.accessToken, { ...cookieOptions, maxAge: data.expiresIn ?? 3600 });
    setCookie(REFRESH_COOKIE, data.refreshToken, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
    return { user: auth.user };
  });

export const signInWithHttpOnlyCookie = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: emailSchema, password: passwordSchema }))
  .handler(async ({ data }) => {
    const { setCookie } = await import("@tanstack/react-start/server");
    const { data: auth, error } = await authClient().auth.signInWithPassword(data);
    if (error || !auth.session) throw new Error(error?.message ?? "No se pudo iniciar sesion");
    setCookie(ACCESS_COOKIE, auth.session.access_token, { ...cookieOptions, maxAge: auth.session.expires_in ?? 3600 });
    setCookie(REFRESH_COOKIE, auth.session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
    return { user: auth.user };
  });

export const signUpWithHttpOnlyCookie = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    email: emailSchema,
    password: signupPasswordSchema,
    fullName: z.string().trim().min(2).max(120),
    phone: phoneSchema.optional(),
    redirectTo: z.string().url()
  }))
  .handler(async ({ data }) => {
    // Validación de dominio MX antes de intentar el registro
    await validateEmailDomain(data.email);
    const { setCookie } = await import("@tanstack/react-start/server");
    const { data: auth, error } = await authClient().auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: data.redirectTo,
        data: {
          full_name: data.fullName,
          phone: data.phone,
        }
      },
    });
    if (error) throw new Error(error.message);
    if (auth?.user && Array.isArray(auth.user.identities) && auth.user.identities.length === 0) {
      throw new Error("Este correo electrónico ya se encuentra registrado. Inicia sesión con tu contraseña.");
    }
    if (auth.session) {
      setCookie(ACCESS_COOKIE, auth.session.access_token, { ...cookieOptions, maxAge: auth.session.expires_in ?? 3600 });
      setCookie(REFRESH_COOKIE, auth.session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
    }
    return { user: auth.user, needsEmailConfirmation: !auth.session };
  });

export const updateProfileServerFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    fullName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
    phone: optionalPhoneSchema,
  }))
  .handler(async ({ data }) => {
    const user = await requireCookieUser();
    const client = authClient();

    const { error: profileError } = await client
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: data.fullName,
        phone: data.phone || null,
        updated_at: new Date().toISOString(),
      });

    if (profileError) throw new Error(profileError.message);
    return { success: true };
  });

export const signOutHttpOnlyCookie = createServerFn({ method: "POST" }).handler(async () => {
  const { deleteCookie } = await import("@tanstack/react-start/server");
  deleteCookie(ACCESS_COOKIE, cookieOptions);
  deleteCookie(REFRESH_COOKIE, cookieOptions);
  return { ok: true };
});

export const checkAuthUser = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireCookieUser();
  return { user };
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: emailSchema,
      redirectTo: z.string().url().optional(),
    })
  )
  .handler(async ({ data }) => {
    const client = authClient();
    const cleanEmail = data.email.trim().toLowerCase();

    // Validar existencia del usuario en la base de datos
    let exists = false;
    try {
      const { data: hasAccount, error } = await client.rpc("check_email_exists", {
        p_email: cleanEmail,
      });
      if (!error && hasAccount === true) {
        exists = true;
      }
    } catch (e) {
      console.warn("[requestPasswordReset] Error verificando existencia de correo:", e);
    }

    // Solo despacha el restablecimiento de contraseña si el correo existe en la BD
    if (exists) {
      try {
        await client.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: data.redirectTo,
        });
      } catch (e) {
        console.warn("[requestPasswordReset] Error enviando correo de restablecimiento:", e);
      }
    }

    // Responder siempre con mensaje neutral para evitar enumeración de cuentas
    return {
      success: true,
      message: "Si el correo está registrado, recibirás un enlace de recuperación.",
    };
  });
