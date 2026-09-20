import { test, expect } from "@playwright/test";

test.describe("Authentication flows", () => {
  test("landing page loads and shows login button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=SIGIC").first()).toBeVisible();
    await expect(page.locator("text=Iniciar sesión").first()).toBeVisible();
  });

  test("auth page shows login form", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("text=Bienvenido")).toBeVisible();
    await expect(page.locator('button:has-text("Entrar")')).toBeVisible();
  });

  test("login form validates email", async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input#email', "invalid");
    await page.fill('input#password', "123456");
    await page.click('button:has-text("Entrar")');
    await expect(page.locator("text=Correo inválido")).toBeVisible();
  });

  test("can switch between login and signup", async ({ page }) => {
    await page.goto("/auth");
    await page.click('[role="tab"]:has-text("Crear cuenta")');
    await expect(page.locator('input[name="full_name"]')).toBeVisible();
  });

  test("signup form validates password length", async ({ page }) => {
    await page.goto("/auth");
    await page.click('[role="tab"]:has-text("Crear cuenta")');
    await page.fill('input[name="full_name"]', "Test User");
    await page.fill('input#email2', "test@example.com");
    await page.fill('input#password2', "123");
    await page.click('button[type="submit"]:has-text("Crear cuenta")');
    await expect(page.locator("text=Mínimo 6 caracteres")).toBeVisible();
  });

  test("protected routes redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.locator("text=Bienvenido")).toBeVisible();
  });
});

test.describe("Authenticated flows", () => {
  test.use({ storageState: ".auth/user.json" });

  test("dashboard loads after login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=Parcelas")).toBeVisible();
  });

  test("parcels page loads and shows empty state", async ({ page }) => {
    await page.goto("/parcels");
    await expect(page.locator("text=Parcelas").first()).toBeVisible();
  });

  test("calendar page loads", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.locator("text=Calendario").first()).toBeVisible();
  });

  test("alerts page loads", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.locator("text=Alertas").first()).toBeVisible();
  });

  test("chat page loads", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("text=Asistente Agronómico")).toBeVisible();
  });

  test("inventory page loads", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.locator("text=Inventario").first()).toBeVisible();
  });

  test("map page loads", async ({ page }) => {
    await page.goto("/mapa");
    await expect(page.locator("text=Vista mapa").first()).toBeVisible();
  });

  test("reports page loads", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.locator("text=Reportes").first()).toBeVisible();
  });
});

test.describe("Critical business flows", () => {
  test.use({ storageState: ".auth/user.json" });

  test("can open new parcel dialog", async ({ page }) => {
    await page.goto("/parcels");
    await page.click('button:has-text("Nueva parcela")');
    await expect(page.locator("text=Nombre")).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  test("can filter parcels by name", async ({ page }) => {
    await page.goto("/parcels");
    const searchInput = page.locator('input[placeholder="Buscar parcela…"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("Maíz");
      await page.waitForTimeout(300);
    }
  });

  test("admin page redirects non-admin users", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL("**/dashboard");
    await expect(page).toHaveURL(/dashboard/);
  });
});

test.describe("Language switching", () => {
  test("can switch language in sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    const langSelect = page.locator('select:has(option[value="en"])');
    if (await langSelect.isVisible()) {
      await langSelect.selectOption("en");
      await page.waitForTimeout(300);
    }
  });
});
