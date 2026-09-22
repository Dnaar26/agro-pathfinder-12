import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";

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
  const configuredApiURL = process.env.API_URL ?? process.env.SUPABASE_URL;
  const apiURL = configuredApiURL ? requireHttpUrl(configuredApiURL, "API_URL/SUPABASE_URL") : undefined;
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

    if (error && !error.message.toLowerCase().includes("already registered")) {
      throw new Error(`No se pudo preparar el usuario E2E: ${error.message}`);
    }

    if (!data.user && error?.message.toLowerCase().includes("already registered")) {
      const { data: users, error: listError } = await admin.auth.admin.listUsers();
      if (listError) throw new Error(`No se pudo localizar el usuario E2E: ${listError.message}`);
      const existing = users.users.find((user) => user.email === email);
      if (!existing) throw new Error("El usuario E2E indicado no existe después de crearlo");
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (updateError) throw new Error(`No se pudo actualizar el usuario E2E: ${updateError.message}`);
    }
  } else if (!configuredPassword) {
    throw new Error("Configura E2E_AUTH_PASSWORD para ejecutar E2E contra un entorno remoto");
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/auth`);
  await page.fill("input#email", email);
  await page.fill("input#password", password);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await mkdir(".auth", { recursive: true });
  await context.storageState({ path: ".auth/user.json" });
  await browser.close();
}
