import { createServerFn } from "@tanstack/react-start";
import { createClient, type User } from "@supabase/supabase-js";
import { z } from "zod";

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
  .inputValidator(z.object({ email: emailSchema, password: signupPasswordSchema, fullName: z.string().trim().min(2).max(120), redirectTo: z.string().url() }))
  .handler(async ({ data }) => {
    const { setCookie } = await import("@tanstack/react-start/server");
    const { data: auth, error } = await authClient().auth.signUp({
      email: data.email,
      password: data.password,
      options: { emailRedirectTo: data.redirectTo, data: { full_name: data.fullName } },
    });
    if (error) throw new Error(error.message);
    if (auth.session) {
      setCookie(ACCESS_COOKIE, auth.session.access_token, { ...cookieOptions, maxAge: auth.session.expires_in ?? 3600 });
      setCookie(REFRESH_COOKIE, auth.session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
    }
    return { user: auth.user, needsEmailConfirmation: !auth.session };
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
