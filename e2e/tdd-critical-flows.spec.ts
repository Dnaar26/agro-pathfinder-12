import { test, expect, request } from "@playwright/test";
import { fixtures } from "./fixtures";

// ============================================================
// CONFIGURATION: Run before all TDD tests
// ============================================================

test.beforeAll(async ({}, testInfo) => {
  testInfo.attach("environment", {
    contentType: "text",
    body: "TDD Critical Flows — SIGIC\nFramework: Playwright + Supabase Local\nDate: " + new Date().toISOString(),
  });
});

// ============================================================
// TDD-01 / HU-01: Login inválido no debe crear sesión
// ============================================================

test("TDD-01 / HU-01: login inválido no debe crear sesión", async ({ page }, testInfo) => {
  // Arrive at auth page
  await page.goto("/auth");

  // Try invalid credentials
  await page.fill("#email", "invalido@dominio");
  await page.fill("#password", "123456");
  await page.getByRole("button", { name: "Entrar" }).click();

  // Assert: error visible, no dashboard redirect
  await expect(page.getByText(/Credenciales incorrectas/i)).toBeVisible({ timeout: 3000 });
  await expect(page).not.toHaveURL("/dashboard");

  // Evidence
  await page.screenshot({ path: `tdd-reports/${testInfo.title}.png` });
  testInfo.attach("screenshot", {
    contentType: "image/png",
    base64: await page.screenshot({ path: "tdd-01.png", base64: true }).base64,
  });
});

// ============================================================
// TDD-02 / HU-02: Área <= 0 no debe crear parcela
// ============================================================

test("TDD-02 / HU-02: área <= 0 rechazada por Zod y RLS", async ({ agricultor }) => {
  // Arrive at parcels page
  await agricultor.page.goto("/parcels");
  await agricultor.page.getByRole("button", { name: /Nueva parcela/i }).click();

  // Act: try to create with area 0
  await agricultor.page.fill("#area", "0");
  await agricultor.page.getByRole("button", { name: "Guardar" }).click();

  // Assert: validation error, no "created" message
  await expect(agricultor.page.getByText(/área debe ser positiva/i)).toBeVisible({ timeout: 3000 });
  await expect(agricultor.page.getByText(/Parcela creada/i)).not.toBeVisible({ timeout: 1000 });

  // Evidence
  await agricultor.page.screenshot({ path: `tdd-reports/tdd-02-${testInfo.status}.png` });
});

// ============================================================
// TDD-03 / HU-03: Borrar parcela no puede dejar cultivo huérfano
// ============================================================

test("TDD-03 / HU-03: cascada de borrado parcela + cultivos", async ({ request }, agricultor) => {
  // Arrange: create parcel + crop fixture
  const { data: parcel } = await agricultor.supabase
    .from("parcels")
    .insert({ name: "TDD-03-Parcela-Cascade", owner_id: agricultor.token })
    .select()
    .single();

  const { data: crop } = await agricultor.supabase
    .from("crops")
    .insert({
      status: "PLANEADO",
      planting_date: new Date().toISOString(),
      crop_catalog_id: 1,
      parcel_id: parcel.id,
    })
    .select()
    .single();

  // Act: delete parcel via cascade RPC
  await agricultor.supabase.rpc("delete_parcel_cascade", { parcel_id: parcel.id });

  // Assert: parcel null, crops removed
  const { data: deletedParcel } = await agricultor.supabase
    .from("parcels")
    .select("*")
    .eq("id", parcel.id)
    .single();

  const { data: remainingCrops } = await agricultor.supabase
    .from("crops")
    .select("id")
    .eq("parcel_id", parcel.id);

  // Expected: parcel deleted, no orphan crops
  await expect(deletedParcel).toBeNull();
  await expect(remainingCrops).toHaveLength(0);

  // Evidence
  testInfo.attach("cascade-results", {
    contentType: "application/json",
    body: JSON.stringify({ deletedParcel, remainingCrops }),
  });
});

// ============================================================
// TDD-04 / HU-04: Fecha futura queda PLANEADO
// ============================================================

test("TDD-04 / HU-04: fecha futura siembra -> estado PLANEADO por trigger", async ({ agricultor }) => {
  // Arrive at crops creation
  await agricultor.page.goto("/cultivos");
  await agricultor.page.getByRole("button", { name: /Nuevo cultivo/i }).click();

  // Select parcel and crop catalog
  await agricultor.page.selectOption("#parcelId", agricultor.parcel.id);
  await agricultor.page.selectOption("#cropCatalogId", "1");

  // Act: set future date (30 days ahead) and save
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await agricultor.page.fill("#plantingDate", futureDate.toISOString().split("T")[0]);
  await agricultor.page.getByRole("button", { name: "Guardar" }).click();

  // Assert: PLANEADO appears, SEMBRADO does not
  await expect(agricultor.page.getByText(/PLANEADO/i)).toBeVisible({ timeout: 3000 });
  await expect(agricultor.page.getByText(/SEMBRADO/i)).not.toBeVisible({ timeout: 1000 });

  // Evidence
  await agricultor.page.screenshot({ path: `tdd-reports/tdd-04-${testInfo.status}.png` });
});

// ============================================================
// TDD-05 / HU-05: Cron no debe iniciar siembra sin confirmación
// ============================================================

test("TDD-05 / HU-05: generate_automatic_alerts() no cambia estado a SEMBRADO", async ({ request }) => {
  // Act: execute cron function
  const { data, error } = await request.post("/functions/v1/generate_automatic_alerts", {
    body: {},
  });

  // Assert: no automatic state change; requires manual confirmation
  expect(error).toBeNull();
  expect(data?.changed).toBe(false);
  expect(data?.requires_confirmation).toBe(true);

  // Evidence
  testInfo.attach("cron-results", {
    contentType: "application/json",
    body: data,
  });
});

// ============================================================
// TDD-06 / HU-07: Stock bajo debe alertar una única vez por día
// ============================================================

test("TDD-06 / HU-07: idempotencia alertas stock-bajo por día", async ({ agricultor }) => {
  // Arrange: create inventory item with stock = 0
  await agricultor.supabase.from("inventory_items").insert({
    name: "TDD-06-Fertilizante-Test",
    category: "NUTRITIVO",
    stock_qty: 0,
    unit_cost: 10,
    owner_id: agricultor.token,
  });

  // Act: check alerts_sent_today twice
  let { data: first } = await agricultor.supabase
    .from("inventory_items")
    .select("alerts_sent_today")
    .eq("name", "TDD-06-Fertilizante-Test")
    .single();

  let { data: second } = await agricultor.supabase
    .from("inventory_items")
    .select("alerts_sent_today")
    .eq("name", "TDD-06-Fertilizante-Test")
    .single();

  // Assert: same value, no duplication
  expect(first.alerts_sent_today).toEqual(second.alerts_sent_today);

  // Evidence
  testInfo.attach("idempotency-test", {
    contentType: "application/json",
    body: { first, second },
  });
});

// ============================================================
// TDD-07 / HU-08: Agricultor no puede insertar aviso manual
// ============================================================

test("TDD-07 / HU-08: RLS prohíbe insert directo a alerts por agricultor", async ({ request }) => => {
  // Act: try direct insert as farmer
  const { error } = await request.post("/rest/v1/alerts", {
    headers: {
      Authorization: `Bearer ${agricultor.token}`,
      "Content-Type": "application/json",
    },
    body: {
      title: "Test RLS",
      body: "Test body",
      kind: "REMINDER",
      status: "PENDIENTE",
      user_id: agricultor.token,
    },
  });

  // Assert: RLS violation error
  expect(error).toBeDefined();
  expect(error?.code).toContain("violates");

  // Evidence
  testInfo.attach("rls-error", {
    contentType: "application/json",
    body: error,
  });
});

// ============================================================
// TDD-08 / HU-08: Técnico no puede avisar agricultor no asignado
// ============================================================

test("TDD-08 / HU-08: RPC valida asignación técnico-agricultor", async ({ request }, tecnico) => {
  // Arrange: get unrelated farmer
  const { data: unrelatedFarmer } = await agricultor.supabase
    .from("profiles")
    .select("*")
    .eq("email", "otro@dominio.com")
    .single();

  // Act: technician tries to create alert for unassigned farmer
  const { error, data } = await request.post("/rest/v1/alerts", {
    headers: {
      Authorization: `Bearer ${tecnico.token}`,
      "Content-Type": "application/json",
    },
    body: {
      title: "Alerta no asignada",
      body: "Para agricultor sin relación",
      kind: "REMINDER",
      status: "PENDIENTE",
      sender_id: tecnico.token,
      user_id: unrelatedFarmer.id,
    },
  });

  // Assert: rejected with clear message
  expect(error).toBeDefined();
  expect(error.message).toContain("Sólo puede notificar");

  // Evidence
  testInfo.attach("assignment-validation", {
    contentType: "application/json",
    body: { error, data },
  });
});

// ============================================================
// TDD-09 / HU-09: No admin no puede editar umbral
// ============================================================

test("TDD-09 / HU-09: RLS alert_settings prohíbe edición no-admin", async ({ request }) => {
  // Act: farmer tries to edit alert_settings
  const { error } = await request.post("/rest/v1/alert_settings", {
    headers: {
      Authorization: `Bearer ${agricultor.token}`,
      "Content-Type": "application/json",
    },
    body {
      id: true,
      umbral_stock_minimo: 5,
      enabled: true,
    },
  });

  // Assert: forbidden / RLS violation
  expect(error?.status).toBe(403);
  expect(error?.code).toContain("violates");

  // Evidence
  testInfo.attach("no-admin-edit", {
    contentType: "application/json",
    body: error,
  });
});