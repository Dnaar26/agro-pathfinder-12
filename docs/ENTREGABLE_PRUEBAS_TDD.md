# Pruebas TDD (red → green → refactor)

**Framework:** Playwright Test (`@playwright/test`), el framework E2E existente. Las pruebas requieren Supabase local aislado; no ejecutar con service role de producción.

| Prueba | HU | Red (expectativa inicial) | Green/Refactor |
|---|---|---|---|
| TDD-01 | HU-01 | Login inválido no debe crear sesión. | Validación de formulario y redirección protegida. |
| TDD-02 | HU-02 | Área <= 0 no debe crear parcela. | Esquema Zod y RLS. |
| TDD-03 | HU-03 | Borrar parcela no puede dejar cultivo huérfano. | RPC transaccional + cascadas + refresco Query. |
| TDD-04 | HU-04 | Fecha futura no debe quedar SEMBRADO. | Trigger `set_crop_planting_state`. |
| TDD-05 | HU-05 | Cron no debe iniciar una siembra sin confirmación. | Alerta automática + confirmación explícita. |
| TDD-06 | HU-06 | Stock bajo debe alertar una única vez por día. | Generador idempotente y umbral. |
| TDD-07 | HU-07 | Agricultor no puede insertar aviso manual. | RLS `alerts no direct insert`. |
| TDD-08 | HU-08 | Técnico no puede avisar agricultor no asignado. | RPC valida asignación. |
| TDD-09 | HU-09 | No admin no puede editar umbral. | RLS de `alert_settings`. |

## Código de pruebas propuesto
Archivo: `e2e/tdd-critical-flows.spec.ts`. Los IDs de prueba se deben preparar en un entorno local por `globalSetup`/fixtures, nunca contra datos de producción.

```ts
import { expect, test } from "@playwright/test";

test("TDD-01 / HU-01: login inválido", async ({ page }) => {
  await page.goto("/auth");
  await page.fill("#email", "invalido");
  await page.fill("#password", "123456");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(/Correo inv/i)).toBeVisible();
});

test("TDD-04 / HU-04: fecha futura queda planeada", async ({ page }) => {
  // Fixture: agricultor autenticado, parcela y catálogo disponibles.
  await page.goto("/cultivos");
  await page.getByRole("button", { name: /Nuevo cultivo/i }).click();
  // seleccionar fixture y una fecha futura
  // expect(estado de la nueva fila).toHaveText("PLANEADO");
});

test("TDD-03 / HU-03: cascada de parcela", async ({ request }) => {
  // Fixture crea parcela/cultivo; llamar delete_parcel_cascade autenticado.
  // expect(parcela).toBeNull(); expect(cultivos).toHaveLength(0);
});

test("TDD-08 / HU-08: técnico no asignado es rechazado", async ({ request }) => {
  // Usar JWT de técnico y receptor sin relación.
  // expect(error.message).toContain("Sólo puede notificar");
});
```

Los casos TDD-02/03/04/05/06/07/08/09 deben implementarse como pruebas API/RPC con fixtures de roles y limpiar datos por UUID. Tras cada Green, refactorizar helpers de sesión/fixtures y conservar las aserciones de regresión.
