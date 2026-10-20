/**
 * Server-only cookie utilities for authentication.
 * This file MUST only be imported by server-side code (Server Functions).
 * DO NOT import this directly in client components.
 */
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

export const ACCESS_COOKIE = "sigic_access_token";
export const REFRESH_COOKIE = "sigic_refresh_token";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function getAccessToken(): string | undefined {
  return getCookie(ACCESS_COOKIE);
}

export function getRefreshToken(): string | undefined {
  return getCookie(REFRESH_COOKIE);
}

export function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  expiresIn?: number
): void {
  setCookie(ACCESS_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: expiresIn ?? 3600,
  });
  setCookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function deleteAuthCookies(): void {
  deleteCookie(ACCESS_COOKIE, cookieOptions);
  deleteCookie(REFRESH_COOKIE, cookieOptions);
}

export function refreshAuthCookies(
  accessToken: string,
  refreshToken: string,
  expiresIn?: number
): void {
  setCookie(ACCESS_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: expiresIn ?? 3600,
  });
  setCookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}