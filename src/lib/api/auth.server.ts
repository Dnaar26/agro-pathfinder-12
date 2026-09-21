import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
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
  return createClient(
    process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function requireCookieUser(): Promise<User> {
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

export const signInWithHttpOnlyCookie = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: emailSchema, password: passwordSchema }))
  .handler(async ({ data }) => {
    const { data: auth, error } = await authClient().auth.signInWithPassword(data);
    if (error || !auth.session) throw new Error(error?.message ?? "No se pudo iniciar sesion");
    setCookie(ACCESS_COOKIE, auth.session.access_token, { ...cookieOptions, maxAge: auth.session.expires_in ?? 3600 });
    setCookie(REFRESH_COOKIE, auth.session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
    return { user: auth.user };
  });

export const signUpWithHttpOnlyCookie = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: emailSchema, password: passwordSchema, fullName: z.string().trim().min(2).max(120), redirectTo: z.string().url() }))
  .handler(async ({ data }) => {
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
  deleteCookie(ACCESS_COOKIE, cookieOptions);
  deleteCookie(REFRESH_COOKIE, cookieOptions);
  return { ok: true };
});

export const checkAuthUser = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireCookieUser();
  return { user };
});
