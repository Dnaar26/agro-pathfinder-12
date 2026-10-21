# Informe de ejecución de pruebas TDD

**Fecha:** 21-10-2026 · **Entorno solicitado:** local aislado.
**Estado:** no ejecutable en esta estación: Docker Desktop/Supabase local no está iniciado (`dockerDesktopLinuxEngine` no disponible). Para evitar crear usuarios/datos E2E con la service role de Supabase Cloud, la suite no se ejecutó contra producción.

## Resultado real de esta ejecución
| Métrica | Resultado |
|---|---:|
| Pruebas Playwright ejecutadas | 0 |
| Pasadas | 0 |
| Fallidas | 0 |
| Omitidas | 0 |
| Cobertura | No disponible; Playwright actual no instrumenta cobertura. |

**Descubrimiento de suite:** `npx playwright test --config e2e/playwright.config.ts --list` encontró **15 pruebas** en `e2e/auth.spec.ts` y `e2e/tdd-critical-flows.spec.ts`, incluida TDD-07 para verificar que un evento futuro creado en Calendario aparezca en el dashboard. Este comando valida que los archivos cargan y no accede a la base de datos.

| ID | HU | Resultado | Evidencia / causa raíz |
|---|---|---|---|
| Infraestructura | Todas | Bloqueada | `failed to connect to the docker API ... dockerDesktopLinuxEngine` al ejecutar `npx supabase status`. |

## Validación estática realizada
| Verificación | Resultado | Evidencia |
|---|---|---|
| Build de producción | Pasó | `npm run build` completó en árbol limpio en la revisión del 21-10-2026. |
| ESLint | Sin errores | `npm run lint` pasó; quedan 10 advertencias no bloqueantes de Fast Refresh en componentes UI existentes. |
| Migraciones Supabase | Pendiente en este entorno | El CLI detectó que Docker/Supabase local no estaba disponible; no se ejecutó `db reset`, `supabase test db` ni `db push` remoto. |
| Smoke Render | Falló | El primer GET público a `/healthz` respondió HTTP 503; las verificaciones posteriores de `/healthz` y `/readyz` expiraron. Revisar el servicio y sus logs en Render antes de considerar producción saludable. |

## Para ejecutar y actualizar este informe
1. Inicie Docker Desktop.
2. Ejecute `npx supabase start && npx supabase db reset`.
3. Copie credenciales locales a `.env` y defina `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` o service role local.
4. Ejecute `npm run test:e2e`.
5. Registre el resumen, `playwright-report/` y cobertura si se añade instrumentación V8/Istanbul.

## Conclusión
La suite E2E ahora es descubrible y ejecutable, y separa los flujos de navegador de las garantías de base de datos. Falta ejecutar ambas suites con Docker/Supabase local para declarar la validación funcional completa; no se usaron datos de producción durante esta revisión.
