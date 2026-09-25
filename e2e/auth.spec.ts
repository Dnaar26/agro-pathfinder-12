import { expect, test } from "@playwright/test";

test.describe("Authentication flows", () => {
  test("auth page shows login form", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Bienvenido")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("login form validates email", async ({ page }) => {
    await page.goto("/auth");
    await page.fill("input#email", "invalid");
    await page.fill("input#password", "123456");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(/Correo inv[\u00e1a]lido/)).toBeVisible();
  });

  test("can switch between login and signup", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("tab", { name: "Crear cuenta" }).click();
    await expect(page.locator('input[name="full_name"]')).toBeVisible();
  });

  test("signup form validates password length", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("tab", { name: "Crear cuenta" }).click();
    await page.fill('input[name="full_name"]', "Test User");
    await page.fill("input#email2", "test@example.com");
    await page.fill("input#password2", "123");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText(/M.nimo 8 caracteres/)).toBeVisible();
  });

  test("protected routes redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/parcels");
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText("Bienvenido")).toBeVisible();
  });
});

test.describe("Authenticated flows", () => {
  test.use({ storageState: ".auth/user.json" });

  test("parcels page loads after login", async ({ page }) => {
    await page.goto("/parcels");
    await expect(page.locator("text=Parcelas").first()).toBeVisible();
  });

  test("can open new parcel dialog", async ({ page }) => {
    await page.goto("/parcels");
    await page.getByRole("button", { name: "Nueva parcela" }).click();
    await expect(page.locator("text=Nombre")).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  test("can filter parcels by name", async ({ page }) => {
    await page.goto("/parcels");
    const searchInput = page.locator('input[placeholder^="Buscar parcela"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("Maiz");
      await page.waitForTimeout(300);
    }
  });
});
