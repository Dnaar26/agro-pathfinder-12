/**
 * Client-safe exports from auth module.
 * This file can be safely imported by client components.
 * Server functions are NOT exported from here.
 */

// Types
export type { User } from "@supabase/supabase-js";

// Validation schemas (re-exported for client use)
export { emailSchema, TYPO_DOMAINS } from "@/lib/schemas/email";
export { phoneSchema, optionalPhoneSchema } from "@/lib/schemas/phone";
export { firstNameSchema, lastNameSchema, passwordBaseSchema, validatePasswordSecurity } from "@/lib/schemas/user";

// Constants
export const ACCESS_COOKIE = "sigic_access_token";
export const REFRESH_COOKIE = "sigic_refresh_token";

// Client-side utilities
export function getAccessTokenFromCookie(): string | undefined {
  // Client-side cookie reading (if needed)
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(^| )sigic_access_token=([^;]+)"));
  return match ? match[2] : undefined;
}

export function getRefreshTokenFromCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(^| )sigic_refresh_token=([^;]+)"));
  return match ? match[2] : undefined;
}