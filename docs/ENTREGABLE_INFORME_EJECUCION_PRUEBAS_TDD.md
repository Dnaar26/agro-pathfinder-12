# Informe de ejecución de pruebas TDD

**Fecha:** 26-09-2026 · **Entorno solicitado:** local aislado.  
**Estado:** no ejecutable en esta estación: Docker Desktop/Supabase local no está iniciado (`dockerDesktopLinuxEngine` no disponible). Para evitar crear usuarios/datos E2E con la service role de Supabase Cloud, la suite no se ejecutó contra producción.

## Resultado real de esta ejecución
| Métrica | Resultado |
|---|---:|
| Pruebas Playwright ejecutadas | 0 |
| Pasadas | 0 |
| Fallidas | 0 |
| Omitidas | 0 |
| Cobertura | No disponible; Playwright actual no instrumenta cobertura. |

**Descubrimiento de suite:** `npx playwright test --config e2e/playwright.config.ts --list` encontró **8 pruebas** en `e2e/auth.spec.ts`. Este comando no las ejecuta ni accede a la base de datos.

| ID | HU | Resultado | Evidencia / causa raíz |
|---|---|---|---|
| Infraestructura | Todas | Bloqueada | `failed to connect to the docker API ... dockerDesktopLinuxEngine` al ejecutar `npx supabase status`. |

## Validación estática realizada
| Verificación | Resultado | Evidencia |
|---|---|---|
| Build de producción | Pasó | `npm run build` completó antes de generar estos entregables. |
| ESLint de mapa | Sin errores | 2 advertencias no bloqueantes (`exhaustive-deps`, `react-refresh`). |
| Migraciones Supabase | Aplicadas | `supabase db push` aplicó hasta `20260925030000_schedule_automatic_alerts.sql`. |

## Para ejecutar y actualizar este informe
1. Inicie Docker Desktop.
2. Ejecute `npx supabase start && npx supabase db reset`.
3. Copie credenciales locales a `.env` y defina `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` o service role local.
4. Ejecute `npm run test:e2e`.
5. Registre el resumen, `playwright-report/` y cobertura si se añade instrumentación V8/Istanbul.

## Conclusión
Las correcciones de siembra programada, confirmación explícita, borrado en cascada, roles de notificación y cron están desplegadas en base de datos. Falta ejecución E2E aislada con fixtures por rol para declararlas validadas formalmente.
