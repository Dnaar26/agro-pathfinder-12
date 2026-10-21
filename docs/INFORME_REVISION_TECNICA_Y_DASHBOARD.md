# Informe de revisión técnica — 21-10-2026

## Alcance y método
Revisión estática de frontend React/TanStack Start, consultas Supabase, migraciones SQL/RLS, configuración Render y pruebas versionadas. La corrección descrita aquí quedó versionada, pero la migración debe ejecutarse primero en staging y después en producción mediante el flujo protegido de Supabase. No se consultaron ni modificaron datos de producción desde esta revisión.

## Incidencia: Dashboard > «Próximas actividades»

### Diagnóstico confirmado
| Elemento | Archivo / función | Comportamiento |
|---|---|---|
| Componente | `src/routes/_authenticated/dashboard.tsx`, `Dashboard` | Ejecuta `getUpcomingActivities(7, farmerParam)` y muestra `startsAt`. |
| Consulta usada | `src/lib/queries.ts`, `getUpcomingActivities` | Consulta `public.calendar_events` por `starts_at` entre ahora y +7 días, ordenada por fecha. |
| Fuente real del calendario | `src/routes/_authenticated/calendar.tsx`, `CalendarPage`, líneas 56–59 | Consulta `public.calendar_events` mediante `listEvents`. |
| Columna del evento | `src/lib/queries.ts`, `listEvents`, líneas 84–93 | Filtra `calendar_events.starts_at`. |

La causa original era que el dashboard consultaba una bitácora de labores realizadas (`activities.performed_at`) mientras el formulario del calendario crea futuros en `calendar_events.starts_at`. La consulta ahora usa la fuente correcta, limita el intervalo a los próximos siete días y contempla eventos sin cultivo. También mantiene como pendientes los registros históricos con `done = NULL` hasta que la migración los normalice.

### Corrección aplicada
`getUpcomingActivities` consulta `calendar_events` y genera la forma que espera el dashboard (`startsAt`). El filtro PostgREST combina en el servidor fecha, estado pendiente y visibilidad por agricultor/cultivo. Además, Calendario invalida la caché `upcoming` después de crear, editar, completar o eliminar un evento.

La migración `20261021110000_calendar_events_dashboard_visibility.sql` normaliza `done`, establece `false` como valor predeterminado y agrega un índice parcial para la agenda. Debe aplicarse por el procedimiento documentado de staging/producción antes de declarar completa la corrección de datos históricos.

**Pruebas añadidas:** el caso `TDD-07` crea un evento futuro sin cultivo y comprueba que aparece en el dashboard. Sigue siendo necesario ejecutar la suite en un entorno Supabase aislado para cubrir RLS y roles.

## Lo que funciona correctamente
- **Autenticación y rutas protegidas:** Supabase Auth y ruta `_authenticated`; Playwright tiene pruebas de login, validación y redirección.
- **Parcelas:** Zod valida campos; eliminación usa RPC `delete_parcel_cascade`, confirma el UUID y React Query invalida parcelas/cultivos. La migración normaliza FKs a cascada.
- **Estados iniciales de siembra:** trigger `set_crop_planting_state` calcula `PLANEADO` para fecha futura y `SEMBRADO` para hoy/pasado.
- **Inicio confirmado:** cron y `generate_automatic_alerts()` crean recordatorio sin adelantar automáticamente el estado; el detalle confirma inicio.
- **Notificaciones:** `create_manual_alert` valida destinatario en SQL; agricultor no inserta manuales; manual conserva `sender_id`, automática lo deja nulo.
- **Inventario:** movimientos usan RPC `apply_inventory_movement`; UI valida stock antes de salida.
- **Operación:** Render usa auto-deploy, secretos con `sync:false`; `.env` está ignorado. Las migraciones se aplicaron en Supabase hasta `20260925030000`.

## Riesgos y correcciones priorizadas

| Prioridad | Riesgo | Evidencia | Corrección recomendada |
|---|---|---|---|
| Resuelto | Agenda vacía | `getUpcomingActivities` usaba `activities`, no `calendar_events`. | Consulta corregida, caché invalidada, migración y `TDD-07` añadidos. |
| Crítica | Técnico puede operar eventos globales | `20260920003000...sql` política `events owner` permite a cualquier técnico `FOR ALL` en `calendar_events`; la migración de asignaciones no la reemplaza. | Sustituir política por relación del `crop_id`/propietario asignado; bloquear eventos sin cultivo para técnicos o añadir `owner_id`. |
| Alta | Confirmación de siembra puede eludirse | `crops.$id.tsx` ofrece selector con `SEMBRADO`; RLS permite update y trigger no exige `planting_confirmed_at`. | Crear RPC `confirm_crop_planting`; impedir en trigger/RLS transición `PLANEADO→SEMBRADO` sin confirmación. Restringir selector de estados iniciales. |
| Alta | Evento e inventario no son atómicos | `calendar.tsx` inserta/edita evento y luego llama RPC de inventario sin comprobar `{ error }`. | RPC transaccional que inserte evento y movimiento; revertir/mostrar error si falla. |
| Alta | Borrar evento no repone insumo | `deleteEvent` borra solo `calendar_events`; no existe vínculo a movimiento. | Añadir `calendar_event_id` a `inventory_movements` y RPC de eliminación compensatoria, o prohibir borrar tras consumo. |
| Media | Errores silenciados | Calendar (`inventoryItems`, `cropEvents`, `activityEvents`), dashboard (`farmers`, estadísticas) y varios helpers ignoran `error` y devuelven `[]`. | Lanzar error, mostrar estado de fallo y registrar con servicio de monitoreo. |
| Media | Tipado débil | 134 usos de `as any`; tipos Supabase no describen todas las tablas. | Regenerar tipos de Supabase tras migraciones y reemplazar `any` por DTOs/relaciones tipadas. |
| Media | Filtros de técnico inconsistentes | Dashboard e inventario consultan perfiles globales en cliente; dependen de RLS para filtrar, no de RPC semántica. | Reutilizar `list_manual_alert_recipients`/nuevas RPC para agricultores asignados. |
| Media | Rendimiento | Consultas de dashboard cargan perfiles, parcelas, cultivos y actividades completas y agregan en navegador. | Vistas/RPC agregadas, paginación y índices `(starts_at)`, `(user_id, starts_at)`, `(crop_id, performed_at)`, `(parcel_id, status)`. Verificar con `EXPLAIN ANALYZE`. |
| Media | Fechas de calendario | `gridEnd` se calcula a medianoche y se filtra con `lte`; puede excluir eventos de la última fecha según zona horaria. | Usar intervalo semiabierto `[gridStart, addDays(gridEnd, 1))` y `lt`. |
| Resuelto | Configuración de dependencias | El proyecto usa npm como gestor único de producción. `package-lock.json` es la fuente reproducible; se eliminó el lockfile obsoleto de Bun que podía instalar versiones incompatibles de TanStack en Render. | Mantener `npm ci --include=dev --ignore-scripts` en el build y no volver a añadir un segundo lockfile. |

## Estado de calidad y pruebas
La validación limpia de esta revisión pasó `npm run typecheck`, `npm run build`, `npm run lint` y el descubrimiento de 15 pruebas Playwright. El lint conserva 10 avisos no bloqueantes de Fast Refresh. La ejecución E2E local completa sigue bloqueada porque Docker Desktop/Supabase local no está disponible; no se ejecutó contra Supabase Cloud para no crear/modificar datos de producción.

## Plan recomendado
1. Aplicar la migración de agenda en staging, ejecutar TDD-07 con Supabase aislado y promoverla a producción mediante el workflow protegido.
2. Hacer atómico evento+movimiento y blindar confirmación de siembra.
3. Añadir pruebas de integración Supabase con tres roles y fixtures aislados.
4. Generar tipos, eliminar `any` crítico y mover agregaciones a SQL/RPC.
5. Medir consultas y crear índices confirmados por `EXPLAIN ANALYZE`.
