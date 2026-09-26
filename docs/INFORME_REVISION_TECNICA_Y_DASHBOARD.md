# Informe de revisión técnica — 26-09-2026

## Alcance y método
Revisión estática de frontend React/TanStack Start, consultas Supabase, migraciones SQL/RLS, configuración Render y pruebas versionadas. No se hicieron cambios en este informe ni se consultaron datos de producción; por ello no puede confirmar si hoy existen eventos futuros en la instancia.

## Incidencia: Dashboard > «Próximas actividades»

### Diagnóstico confirmado
| Elemento | Archivo / función | Comportamiento |
|---|---|---|
| Componente | `src/routes/_authenticated/dashboard.tsx`, `Dashboard`, línea 77 y 412 | Ejecuta `getUpcomingActivities(7, farmerParam)` y muestra `performed_at`. |
| Consulta usada | `src/lib/queries.ts`, `getUpcomingActivities`, líneas 336–352 | Consulta `public.activities` por `performed_at` entre ahora y +7 días. |
| Fuente real del calendario | `src/routes/_authenticated/calendar.tsx`, `CalendarPage`, líneas 56–59 | Consulta `public.calendar_events` mediante `listEvents`. |
| Columna del evento | `src/lib/queries.ts`, `listEvents`, líneas 84–93 | Filtra `calendar_events.starts_at`. |

`activities` es una bitácora de labores realizadas y usa `performed_at`; el formulario del calendario crea futuros en `calendar_events.starts_at`. Por eso la tarjeta no lee los eventos del calendario. No es un problema de zona horaria ni de React Query: el query se ejecuta y el componente muestra «Sin actividades...» cuando recibe el arreglo vacío. La query actual tampoco incorpora siembras programadas ni alertas.

### Corrección propuesta
Reemplazar `getUpcomingActivities` por un agregador explícito de agenda. Debe normalizar eventos, siembras planeadas y alertas en una sola forma de UI.

```ts
// src/lib/queries.ts
export type UpcomingItem = {
  id: string; kind: string; startsAt: string; title: string;
  source: "CALENDAR" | "PLANTING" | "ALERT"; crop?: unknown;
};

export async function getUpcomingActivities(days = 7, ownerId?: string): Promise<UpcomingItem[]> {
  const from = new Date();
  const to = new Date(from.getTime() + days * 86_400_000);
  const cropIds = await getCropIdsForOwner(ownerId);
  const eventQuery = supabase.from("calendar_events").select("id,title,starts_at,crop_id,crops(crop_catalog(name),parcels(name))")
    .gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString()).order("starts_at");
  const plantingQuery = supabase.from("crops").select("id,planting_date,crop_catalog(name),parcels(name)")
    .eq("status", "PLANEADO").gte("planting_date", from.toISOString().slice(0, 10)).lt("planting_date", to.toISOString().slice(0, 10));
  const alertsQuery = supabase.from("alerts").select("id,title,scheduled_at,kind,crop_id,crops(crop_catalog(name),parcels(name))")
    .eq("status", "PENDIENTE").gte("scheduled_at", from.toISOString()).lt("scheduled_at", to.toISOString());
  if (ownerId && cropIds.length === 0) return [];
  const [events, plantings, alerts] = await Promise.all([eventQuery, plantingQuery, alertsQuery]);
  for (const result of [events, plantings, alerts]) if (result.error) throw result.error;
  return [
    ...(events.data ?? []).map(e => ({ id: e.id, kind: "EVENTO", title: e.title, startsAt: e.starts_at, source: "CALENDAR" as const, crop: e.crops })),
    ...(plantings.data ?? []).map(c => ({ id: `planting-${c.id}`, kind: "SIEMBRA", title: `Siembra: ${(c as any).crop_catalog?.name ?? "Cultivo"}`, startsAt: `${c.planting_date}T12:00:00Z`, source: "PLANTING" as const, crop: (c as any).crop_catalog })),
    ...(alerts.data ?? []).map(a => ({ id: `alert-${a.id}`, kind: a.kind, title: a.title, startsAt: a.scheduled_at, source: "ALERT" as const, crop: a.crops })),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 5);
}
```

En `dashboard.tsx`, cambiar `a.performed_at` por `a.startsAt`, y adaptar el acceso del cultivo normalizado. Para filtrar eventos de otro agricultor, `calendar_events` necesita enlazarse por `crop_id` o almacenar `owner_id`; los eventos sin cultivo no pueden atribuirse a un agricultor seleccionado. La solución robusta es una RPC SQL con `UNION ALL` y validación de asignación RLS.

**Pruebas necesarias:** evento `starts_at` dentro/fuera de 7 días, siembra `PLANEADO`, alerta pendiente, cruce de zona horaria y técnico con agricultor asignado/no asignado.

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
| Crítica | Agenda vacía | `getUpcomingActivities` usa `activities`, no `calendar_events`. | Aplicar agregador/RPC descrito arriba y pruebas E2E. |
| Crítica | Técnico puede operar eventos globales | `20260920003000...sql` política `events owner` permite a cualquier técnico `FOR ALL` en `calendar_events`; la migración de asignaciones no la reemplaza. | Sustituir política por relación del `crop_id`/propietario asignado; bloquear eventos sin cultivo para técnicos o añadir `owner_id`. |
| Alta | Confirmación de siembra puede eludirse | `crops.$id.tsx` ofrece selector con `SEMBRADO`; RLS permite update y trigger no exige `planting_confirmed_at`. | Crear RPC `confirm_crop_planting`; impedir en trigger/RLS transición `PLANEADO→SEMBRADO` sin confirmación. Restringir selector de estados iniciales. |
| Alta | Evento e inventario no son atómicos | `calendar.tsx` inserta/edita evento y luego llama RPC de inventario sin comprobar `{ error }`. | RPC transaccional que inserte evento y movimiento; revertir/mostrar error si falla. |
| Alta | Borrar evento no repone insumo | `deleteEvent` borra solo `calendar_events`; no existe vínculo a movimiento. | Añadir `calendar_event_id` a `inventory_movements` y RPC de eliminación compensatoria, o prohibir borrar tras consumo. |
| Media | Errores silenciados | Calendar (`inventoryItems`, `cropEvents`, `activityEvents`), dashboard (`farmers`, estadísticas) y varios helpers ignoran `error` y devuelven `[]`. | Lanzar error, mostrar estado de fallo y registrar con servicio de monitoreo. |
| Media | Tipado débil | 134 usos de `as any`; tipos Supabase no describen todas las tablas. | Regenerar tipos de Supabase tras migraciones y reemplazar `any` por DTOs/relaciones tipadas. |
| Media | Filtros de técnico inconsistentes | Dashboard e inventario consultan perfiles globales en cliente; dependen de RLS para filtrar, no de RPC semántica. | Reutilizar `list_manual_alert_recipients`/nuevas RPC para agricultores asignados. |
| Media | Rendimiento | Consultas de dashboard cargan perfiles, parcelas, cultivos y actividades completas y agregan en navegador. | Vistas/RPC agregadas, paginación y índices `(starts_at)`, `(user_id, starts_at)`, `(crop_id, performed_at)`, `(parcel_id, status)`. Verificar con `EXPLAIN ANALYZE`. |
| Media | Fechas de calendario | `gridEnd` se calcula a medianoche y se filtra con `lte`; puede excluir eventos de la última fecha según zona horaria. | Usar intervalo semiabierto `[gridStart, addDays(gridEnd, 1))` y `lt`. |
| Baja | Configuración duplicada | Existen `bun.lock` y `package-lock.json`; Render usa Bun, local/documentación usa npm. | Elegir un gestor, fijar versión y usar instalación inmutable (`bun install --frozen-lockfile` o `npm ci`). |

## Estado de calidad y pruebas
La compilación de producción pasó previamente. Hay 8 pruebas Playwright de autenticación/listado de parcelas; no cubren calendario, cascada, RLS ni cron. La ejecución E2E local quedó bloqueada porque Docker Desktop no estaba disponible; no se ejecutó contra Supabase Cloud para no crear/modificar datos de producción.

## Plan recomendado
1. Corregir agenda y RLS de `calendar_events` antes de ampliar funcionalidades.
2. Hacer atómico evento+movimiento y blindar confirmación de siembra.
3. Añadir pruebas de integración Supabase con tres roles y fixtures aislados.
4. Generar tipos, eliminar `any` crítico y mover agregaciones a SQL/RPC.
5. Medir consultas y crear índices confirmados por `EXPLAIN ANALYZE`.
