# Pruebas TDD (red → green → refactor)

**Framework:** Playwright Test (`@playwright/test`), el framework E2E existente. Las pruebas requieren Supabase local aislado; no ejecutar con service role de producción.

| Prueba | HU | Red (expectativa inicial) | Green/Refactor |
|---|---|---|---|
| TDD-01 | HU-01 | Login inválido no debe crear sesión. | Validación de formulario y redirección protegida. |
| TDD-02 | HU-02 | Área no válida no debe crear parcela. | Validación HTML/Zod en formulario. |
| TDD-03 | HU-03 | Ruta protegida no debe abrir sin sesión. | Middleware de autenticación. |
| TDD-04 | HU-02 | Formulario de parcela exige área positiva. | Restricción `min=1` y campo obligatorio. |
| TDD-05 | HU-05 | Calendario no permite fechas pasadas. | Restricción `min` y validación de servidor. |
| TDD-06 | Operación | Dashboard autenticado debe renderizar contenido. | Sesión E2E preparada por `globalSetup`. |

Las garantías de RLS, RPC, triggers, transacciones y roles se validan en `supabase/tests/database/security.sql` con pgTAP. No se duplican en pruebas de navegador con credenciales de administrador.

## Suite ejecutable

Archivo: `e2e/tdd-critical-flows.spec.ts`. La suite contiene seis flujos de disponibilidad, autenticación y navegación. `e2e/global-setup.ts` crea o actualiza el usuario aislado y guarda una sesión autenticada para los casos protegidos.

La ejecución se realiza con:

```bash
npm run test:e2e
```

Los casos de base de datos se mantienen en pgTAP, deben ejecutarse con `supabase db reset` y nunca contra producción. Los escenarios de roles API quedan como siguiente ampliación cuando exista un fixture aislado para agricultor, técnico y administrador.
