import { test, expect } from "@playwright/test";

test.use({ storageState: ".auth/user.json" });

const SSE_CHUNKS = [
  `data: ${JSON.stringify({ token: "**Diagnóstico Directo:** Se observa deficiencia incipiente de nitrógeno en el lote evaluado.\n\n" })}\n\n`,
  `data: ${JSON.stringify({ token: "1. Fraccionar la fertilización edáfica en dos aplicaciones con suelo húmedo.\n2. Verificar coronas limpias.\n\n" })}\n\n`,
  `data: ${JSON.stringify({ token: "| Insumo / Labor | Dosis / ha | Frecuencia / Momento | Observación |\n| :--- | :--- | :--- | :--- |\n| Urea 46% | 75 kg/ha | Día 1 (06:30 AM) | Incorporar a 5 cm |\n\n" })}\n\n`,
  `data: ${JSON.stringify({ token: "> ⚠️ **Precaución:** Usar guantes de nitrilo y evitar vientos mayores a 12 km/h.\n<img src=\"x\" onerror=\"window.__xssTriggered=true\" /><script>window.__xssTriggered=true;</script>" })}\n\n`,
  `data: ${JSON.stringify({ done: true })}\n\n`,
].join("");

test.describe("Pantalla única /chat - Streaming SSE, Responsive Móvil, Seguridad XSS y Accesibilidad WCAG", () => {
  test("Consume Streaming SSE en tiempo real en móvil (390x844), renderiza tabla GFM, protege contra XSS y cumple área táctil >= 44px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/chat");

    const chatScreen = page.getByTestId("chat-screen");
    await expect(chatScreen).toBeVisible();

    const input = page.getByTestId("chat-input");
    const sendBtn = page.getByTestId("chat-send-button");

    // 1. Verificar área táctil mínima de 44x44px para trabajo en campo
    const btnBox = await sendBtn.boundingBox();
    expect(btnBox).not.toBeNull();
    expect(btnBox!.height).toBeGreaterThanOrEqual(44);
    expect(btnBox!.width).toBeGreaterThanOrEqual(44);

    // 2. Simular flujo SSE en /api/chat/stream para prueba determinística E2E
    await page.route("**/api/chat/stream", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
        },
        body: SSE_CHUNKS,
      });
    });

    await input.fill("Genera plan de fertilización con tabla para mi lote");
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 3. Verificar tabla Markdown renderizada y bloque de precaución tras finalizar el stream
    const tableWrapper = page.getByTestId("chat-markdown-table").first();
    await expect(tableWrapper).toBeVisible();
    await expect(tableWrapper).toContainText("Urea 46%");
    await expect(page.getByTestId("chat-warning-callout").first()).toBeVisible();
    await expect(page.getByTestId("chat-quick-actions").first()).toContainText(/Agendar.*Urea/i);

    // 4. Verificar ausencia de scroll horizontal roto en viewport móvil
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBeFalsy();

    // 5. Confirmar que ningún payload HTML/XSS se ejecutó en el navegador
    const xssTriggered = await page.evaluate(
      () => (window as unknown as { __xssTriggered?: boolean }).__xssTriggered === true,
    );
    expect(xssTriggered).toBe(false);
  });

  test("Auditoría de Accesibilidad WCAG 2.1 AA y Semántica ARIA en /chat (Desktop 1440x900)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chat");
    await expect(page.getByTestId("chat-screen")).toBeVisible();

    const a11yViolations = await page.evaluate(() => {
      const issues: string[] = [];

      if (!document.querySelector("main#contenido")) issues.push("Falta landmark <main id='contenido'>");
      if (!document.querySelector("h1")) issues.push("Falta encabezado principal <h1>");

      const log = document.querySelector('[data-testid="chat-messages-log"]');
      if (!log) {
        issues.push("Falta contenedor de mensajes del chat");
      } else {
        if (log.getAttribute("role") !== "log") issues.push("El contenedor de mensajes debe tener role='log'");
        if (log.getAttribute("aria-live") !== "polite") issues.push("El contenedor debe tener aria-live='polite'");
      }

      const root = document.querySelector('[data-testid="chat-screen"]');
      if (root) {
        const controls = root.querySelectorAll("button, input, textarea, [role='combobox']");
        controls.forEach((el) => {
          const text = (el.textContent || "").trim();
          const ariaLabel = el.getAttribute("aria-label") || "";
          const ariaLabelledBy = el.getAttribute("aria-labelledby") || "";
          const placeholder = el.getAttribute("placeholder") || "";
          if (!text && !ariaLabel && !ariaLabelledBy && !placeholder) {
            issues.push(`Control sin etiqueta accesible: ${el.tagName}`);
          }
        });
      }

      return issues;
    });

    expect(a11yViolations).toEqual([]);
  });
});
