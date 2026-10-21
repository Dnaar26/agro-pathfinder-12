import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { assertE2ETargetAllowed } from "./safety.mjs";

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim();
  if (cleaned.length >= 2 && cleaned.startsWith('"') && cleaned.endsWith('"')) {
    return cleaned.slice(1, -1);
  }
  if (cleaned.length >= 2 && cleaned.startsWith("'") && cleaned.endsWith("'")) {
    return cleaned.slice(1, -1);
  }
  return cleaned;
}

function requireHttpUrl(value: string | undefined, name: string): string {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) throw new Error(`${name} es obligatorio para la suite E2E`);

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new Error(`${name} debe ser una URL HTTP/HTTPS válida`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} debe usar HTTP o HTTPS`);
  }
  return parsed.toString().replace(/\/$/, "");
}

export default async function globalSetup(config: FullConfig) {
  try {
    process.loadEnvFile?.(".env");
  } catch {
    // CI provides environment variables directly.
  }

  const baseURL = config.projects[0]?.use.baseURL;
  const configuredPassword = cleanEnvValue(process.env.E2E_AUTH_PASSWORD);
  const apiURLs = [...new Set([
    process.env.API_URL,
    process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
  ].filter(Boolean).map((value) => requireHttpUrl(value, "API_URL/SUPABASE_URL/VITE_SUPABASE_URL")))];
  const apiURL = apiURLs[0];
  assertE2ETargetAllowed({
    baseURL: String(baseURL ?? ""),
    apiURLs,
    allowRemote: process.env.E2E_ALLOW_REMOTE === "true",
    explicitEmail: Boolean(cleanEnvValue(process.env.E2E_AUTH_EMAIL)),
  });
  const serviceRoleKey = cleanEnvValue(
    process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const email = cleanEnvValue(process.env.E2E_AUTH_EMAIL) ??
    (serviceRoleKey && apiURL ? "e2e-ci@example.test" : undefined);

  if (!baseURL || !email) {
    throw new Error("E2E_AUTH_EMAIL y la baseURL son obligatorios para la suite autenticada");
  }

  const password = configuredPassword ?? `E2e-${randomBytes(18).toString("base64url")}a1!`;

  if (serviceRoleKey && apiURL) {
    const admin = createClient(apiURL, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    // Si hay error pero es porque el usuario ya existe, lo manejamos
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (!msg.includes("already registered") && !msg.includes("already exists") && !msg.includes("already been registered")) {
        throw new Error(`No se pudo preparar el usuario E2E: ${error.message}`);
      }
      // Usuario ya existe, actualizamos contraseña
      const { data: users } = await admin.auth.admin.listUsers();
      const existing = users.users.find((user) => user.email === email);
      if (existing) {
        await admin.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
        });
      }
    }
  } else if (!configuredPassword) {
    throw new Error("Configura E2E_AUTH_PASSWORD para ejecutar E2E contra un entorno remoto");
  }

  await mkdir(".auth", { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseURL}/auth?mode=login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 30_000 });
  await context.storageState({ path: ".auth/user.json" });
  await browser.close();

  console.log("Global setup completado - sesion E2E guardada");
}
