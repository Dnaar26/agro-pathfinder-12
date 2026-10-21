import { expect, test } from "@playwright/test";

test.describe("TDD: disponibilidad y autenticacion", () => {
  test("TDD-01: health y readiness exponen correlacion de solicitud", async ({ request }) => {
    const health = await request.get("/healthz");
    expect(health.status()).toBe(200);
    expect(health.headers()["x-request-id"]).toMatch(/^[A-Za-z0-9._:-]+$/);

    const readiness = await request.get("/readyz");
    expect([200, 503]).toContain(readiness.status());
    expect(readiness.headers()["content-type"]).toContain("application/json");
    expect(readiness.headers()["x-request-id"]).toMatch(/^[A-Za-z0-9._:-]+$/);
  });

  test("TDD-02: login invalido no crea sesion", async ({ page }) => {
    await page.goto("/auth");
    await page.fill("#email", "invalido@dominio.test");
    await page.fill("#password", "ClaveInvalida123!");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText(/Correo o contraseña incorrectos|Correo inválido/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test("TDD-03: rutas protegidas redirigen a autenticacion", async ({ page }) => {
    await page.goto("/parcels");
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText("Bienvenido")).toBeVisible();
  });
});

test.describe("TDD: flujos autenticados de navegador", () => {
  test.use({ storageState: ".auth/user.json" });

  test("TDD-04: la pantalla de parcelas expone validacion de area", async ({ page }) => {
    await page.goto("/parcels");
    await page.getByRole("button", { name: "Nueva parcela" }).click();

    const area = page.locator("#area_m2");
    await expect(area).toHaveAttribute("min", "1");
    await expect(area).toHaveAttribute("required", "");
    await expect(page.getByRole("button", { name: "Crear" })).toBeVisible();
  });

  test("TDD-05: calendario bloquea fechas anteriores desde el formulario", async ({ page }) => {
    await page.goto("/calendar");
    await page.getByRole("button", { name: "Evento" }).click();

    const startsAt = page.locator("#starts_at");
    await expect(startsAt).toHaveAttribute("min", /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    await startsAt.fill("2020-01-01T09:00");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("TDD-06: dashboard autenticado carga su contenido principal", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("#contenido")).toBeVisible();
    await expect(page.getByText(/Resumen|Dashboard|Inicio/i).first()).toBeVisible();
  });
});
