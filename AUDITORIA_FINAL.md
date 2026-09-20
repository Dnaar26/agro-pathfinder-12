# AUDITORÍA INTEGRAL — SIGIC v1.0

**Fecha:** 2026-06-08  
**Proyecto:** Sistema Inteligente de Gestión y Seguimiento de Cultivos  
**Alcance:** Full-stack: TanStack Start + React 19 + Supabase (Docker) + PostgreSQL 17  
**Auditor:** Arquitectura de Software Senior, QA Lead, Especialista DevOps, Consultor Agrícola  
**Análisis:** ~180 archivos (15 migraciones SQL, 20 rutas, 68 componentes, 17 servicios/lib, config)

---

## 1. RESUMEN EJECUTIVO

SIGIC es un sistema funcional con **cobertura de dominio impresionante** — cubre el ciclo de vida agrícola completo (parcelas → cultivos → actividades → cosechas → costos → plagas → inventario → trazabilidad → reportes → alertas). La arquitectura es moderna (TanStack Start + React 19 + Supabase), el diseño visual es profesional, y la base de datos tiene RLS correctamente implementada en todas las tablas.

**Sin embargo, el sistema tiene 6 vulnerabilidades CRÍTICAS que impiden su despliegue a producción**, encabezadas por secretos de producción expuestos en el repositorio y endpoints administrativos sin ninguna protección de autenticidad.

| Dimensión | Puntaje | Estado |
|-----------|---------|--------|
| **Arquitectura** | 7.5/10 | Sólida pero con debt técnico en migraciones |
| **Funcionalidad** | 8.0/10 | Cobertura de dominio excelente, faltan features menores |
| **Seguridad** | 3.5/10 | **SUSPENSO** — 6 críticos, 8 altos |
| **UX** | 7.5/10 | Profesional, pulir detalles |
| **Rendimiento** | 5.5/10 | Sin paginación, N+1 queries, sin lazy loading real |
| **Escalabilidad** | 4.5/10 | No escala >100 agricultores sin paginación |
| **Calidad General** | 6.0/10 | No apto para producción sin correcciones |

---

## 2. HALLAZGOS CRÍTICOS

### C1. SECRETOS DE PRODUCCIÓN EXPUESTOS EN GIT
**Archivo:** `.env` (trackeado por git)  
**Riesgo:** CRÍTICO  
**Detalle:** `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY` y `SUPABASE_PUBLISHABLE_KEY` están commitadas en el repositorio. La service_role key otorga **acceso total a la base de datos**, bypass RLS, permite crear/eliminar usuarios y leer todos los datos.  
**Impacto:** Cualquiera con acceso al repo puede tomar control total del sistema.

### C2. ENDPOINTS ADMIN SIN AUTENTICACIÓN SERVER-SIDE
**Archivo:** `src/lib/services/seed-data.server.ts`  
**Riesgo:** CRÍTICO  
**Detalle:** Las funciones `clearAllUsers()`, `deleteUser()`, `seedTestData()` son `createServerFn({ method: "POST" })` **sin ningún middleware de autenticación**. Usan el cliente `supabaseAdmin` (service_role) que bypassa RLS. El middleware `requireSupabaseAuth` existe en el código pero **nunca se importa ni usa**.  
**Impacto:** Cualquier usuario autenticado (o potencialmente cualquier persona capaz de llamar server functions) puede eliminar todos los usuarios, crear usuarios arbitrarios, y manipular cualquier tabla.

### C3. SERVER-SIDE JWT VERIFICATION AUSENTE
**Archivo:** `src/integrations/supabase/auth-middleware.ts` (muerto)  
**Riesgo:** CRÍTICO  
**Detalle:** Existe un middleware `requireSupabaseAuth` que verifica JWTs server-side, pero **ninguna server function lo implementa**. El middleware global registrado (`attachSupabaseAuth`) solo adjunta el token al request del cliente — no lo valida del lado del servidor.  
**Impacto:** Todas las server functions son llamables sin autenticación válida.

### C4. MIGRACIÓN CON ÍNDICES SOBRE COLUMNAS INEXISTENTES
**Archivo:** `supabase/migrations/20260607000008_fk_indexes.sql`  
**Riesgo:** CRÍTICO  
**Detalle:** Dos índices intentan crearse sobre columnas que no existen:
- `idx_crops_crop_catalog_id ON public.crops(crop_catalog_id)` — la columna real es `catalog_id`
- `idx_audit_log_entity_id ON public.audit_log(entity_id)` — la columna real es `record_id`  
**Impacto:** La migración falla al ejecutarse, dejando el esquema en estado inconsistente.

### C5. TABLA `pest_incidents` SIN GRANTS
**Archivo:** `supabase/migrations/20260607000002_pest_incidents.sql`  
**Riesgo:** CRÍTICO  
**Detalle:** La tabla `pest_incidents` tiene RLS policies correctas pero **ningún GRANT** para `authenticated`. Sin GRANT, las policies nunca se ejecutan — la tabla es completamente invisible para los usuarios autenticados.  
**Impacto:** Los módulos de plagas (crops.$id.tsx, pest_incidents CRUD) no funcionan. `listPestIncidents()` devuelve 0 resultados siempre.

### C6. ACTUALIZACIONES DIRECTAS A `inventory_items` SIN CONTROL
**Archivo:** `supabase/migrations/20260607000000_new_features.sql`  
**Riesgo:** CRÍTICO  
**Detalle:** `inventory_items.stock_qty` no tiene CHECK (>= 0). El RPC `apply_inventory_movement()` usa `GREATEST(0, ...)` para evitar negativos, pero INSERT/UPDATE directos bypassan esta protección. Además, `updated_at` no tiene trigger — solo se actualiza manualmente en el RPC.  
**Impacto:** Stock puede volverse negativo; `updated_at` queda desactualizado.

---

## 3. HALLAZGOS IMPORTANTES

### B1. SIN PAGINACIÓN EN NINGUNA LISTA
**Archivos:** Todas las queries en `src/lib/queries.ts`  
**Riesgo:** ALTO  
**Detalle:** Ninguna función de listado usa `.range()`, `.limit()` u offset. `listAllActivitiesForReport()` tiene un `limit(5000)` hardcodeado. Con 15 agricultores y ~1000 actividades ya se nota. Con 100+ agricultores (>10,000 registros), el navegador se congelará.  
**Impacto:** Degradación progresiva del rendimiento.

### B2. CLIENT-SIDE ROLE GATING SIN RESPALDO SERVER-SIDE
**Archivos:** `role-gate.tsx`, `admin.tsx`, `audit.tsx`  
**Riesgo:** ALTO  
**Detalle:** `RoleGate` y `beforeLoad` en admin.tsx hacen la verificación de roles **exclusivamente en el cliente**. La base de datos confía en RLS, pero las server functions (seed, delete) no verifican roles. No hay endpoint que valide server-side "¿puede este usuario hacer esto?" antes de ejecutar.  
**Impacto:** Escalamiento de privilegios potencial.

### B3. AUDIT LOG SOLO EN 2 DE 14 TABLAS MUTABLES
**Archivo:** Migraciones SQL  
**Riesgo:** ALTO  
**Detalle:** Solo `parcels` y `user_roles` tienen triggers de auditoría. `crops`, `activities`, `inventory_items`, `crop_costs`, `crop_harvests`, `batches`, `pest_incidents`, `calendar_events`, `alerts`, `inventory_movements` **no tienen auditoría**.  
**Impacto:** Sin trazabilidad forense de cambios. No se puede determinar quién eliminó un cultivo o modificó un costo.

### B4. SINCS RATE LIMITING EN LOGIN/REGISTER
**Riesgo:** ALTO  
**Detalle:** No hay rate limiting en login, register, password reset, ni en ninguna server function. Supabase Auth tiene rate limiting configurable pero no está activado.  
**Impacto:** Ataques de fuerza bruta al login, DoS a server functions.

### B5. SIN EMAIL VERIFICATION OBLIGATORIA
**Archivo:** `src/routes/auth.tsx`  
**Riesgo:** ALTO  
**Detalle:** `signUp()` tiene `email_confirm: true` pero no se verifica server-side que el email esté confirmado. Cualquiera puede registrarse con emails temporales.  
**Impacto:** Cuantas fake, abuso del sistema.

### B6. JWT EN LOCALSTORAGE (VULNERABLE A XSS)
**Riesgo:** ALTO  
**Detalle:** Supabase por defecto almacena el JWT en `localStorage`. Cualquier XSS en cualquier componente expone el token permanentemente. La alternativa segura (`@supabase/ssr` con httpOnly cookies) no está implementada.  
**Impacto:** Robo de sesión vía XSS.

### B7. SIN PAGINACIÓN EN REPORTES (COSTOS + COSECHAS)
**Archivo:** `src/routes/_authenticated/reports.tsx`  
**Riesgo:** MEDIO-ALTO  
**Detalle:** Los reportes cargan **todos** los costos y cosechas sin límite. Con 981 costos y 61 cosechas en los datos de prueba ya se nota lentitud en gráficos Recharts.  
**Impacto:** Timeouts en agricultores con muchos datos históricos.

### B8. COMPONENTE `AuditLog` NO VERIFICABLE
**Archivo:** `src/components/audit/audit-log.tsx`  
**Riesgo:** ALTO  
**Detalle:** El componente que renderiza el audit log no apareció en el escaneo de queries (no hay `listAuditLog` en queries.ts). Posiblemente usa queries inline sin typing ni paginación.  
**Impacto:** Funcionalidad de auditoría potencialmente rota.

---

## 4. HALLAZGOS MENORES

### C1. DUPLICACIÓN DE ÍNDICES EN M14
**Detalle:** `idx_parcels_owner_id` duplica `idx_parcels_owner` (M1), `idx_crops_parcel_id` duplica `idx_crops_parcel`, `idx_activities_crop_id` duplica `idx_activities_crop`.  
**Impacto:** Desperdicio de espacio en disco, sin impacto funcional.

### C2. `pest_incidents` SIN PREFIJO `public.`
**Detalle:** Creada como `CREATE TABLE pest_incidents` (sin `public.`). Funciona por `search_path` pero es inconsistente con el resto del esquema.  
**Impacto:** Ninguno inmediato, pero frágil si cambia `search_path`.

### C3. `crop_costs.kind` ES TEXT, NO ENUM
**Detalle:** A diferencia de `activities.kind` (usa `activity_kind` enum), `crop_costs.kind` es `TEXT` sin CHECK. Permite valores inválidos como "GASOLINA" o cualquier string.  
**Impacto:** Datos inconsistentes en reportes de costos.

### C4. FALTA CHECK `estimated_harvest_date > planting_date` EN CROPS
**Detalle:** No hay constraint que evite fechas de cosecha anteriores a la siembra.  
**Impacto:** Datos imposibles en el sistema.

### C5. SIDEBAR CON 11 NAVEGACIONES — SATURACIÓN VISUAL
**Detalle:** El AppShell tiene 11 items de navegación sin agrupar. Para un agricultor (que solo necesita 5-6 funcionalidades), la barra es abrumadora.  
**Impacto:** Fricción UX. Agricultores se pierden entre opciones irrelevantes.

### C6. 7 FK COLUMNS SIN ÍNDICES EXPLÍCITOS
**Detalle:** `calendar_events.crop_id`, `alerts.crop_id`, `inventory_movements.item_id`, `ndvi_cache.parcel_id`, `weather_cache.parcel_id`, `push_subscriptions.user_id`, `scheduled_reports.user_id`.  
**Impacto:** Degradación progresiva de JOINs al crecer la DB.

### C7. REPORTES 5000-LÍMITE HARCODEADO
**Detalle:** En `listAllActivitiesForReport()`, el `limit(5000)` es arbitrario. Agricultores con muchos años de datos podrían excederlo silenciosamente.  
**Impacto:** Reportes incompletos sin advertencia.

### C8. EXPORTACIÓN CSV SIN BOM UTF-8
**Detalle:** Los CSVs se generan sin BOM (`\uFEFF`), causando que Excel muestre caracteres UTF-8 (acentos, ñ) corruptos.  
**Impacto:** Datos agrícolas colombianos (con acentos, Caña de Azúcar, etc.) se ven mal en Excel.

### C9. SIN PREFETCH O CARGA DIFERIDA REAL
**Detalle:** `Suspense` solo se usa en `chat.tsx`, `inventory.tsx`, `mapa.tsx`. El dashboard carga 10 queries en paralelo sin streaming ni lazy loading de componentes pesados.  
**Impacto:** Primer paint lento en conexiones rurales.

### C10. PHOTO SIGNED URLs EXPIRAN EN 1 HORA
**Detalle:** Las URLs firmadas de Supabase Storage para fotos de evidencia tienen expiración de 1 hora. Si un usuario deja la página abierta, las fotos dejan de cargar.  
**Impacto:** Galería de fotos con broken links después de 1 hora.

---

## 5. RIESGOS

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|-------------|---------|------------|
| R1 | **Fuga de service_role key** | ALTA (ya expuesta en git) | CRÍTICO (DB comprometida) | Rotar key, purgar git history, .gitignore |
| R2 | **Llamado no autorizado a seed/delete** | ALTA (sin auth en server fns) | CRÍTICO (pérdida total datos) | Middleware de auth en server functions |
| R3 | **Fuga de datos agrícolas** | MEDIA (RLS bien implementado) | ALTA (datos sensibles de agricultores) | Auditoría de RLS + tests |
| R4 | **Denegación de servicio** | MEDIA (sin rate limiting) | ALTA (sistema caído) | Rate limiting en Supabase + middleware |
| R5 | **Pérdida de trazabilidad** | ALTA (sin audit en la mayoría de tablas) | MEDIA (no se puede auditar cambios) | Agregar triggers de auditoría |
| R6 | **Corrupción de stock** | MEDIA (sin CHECK constraints) | MEDIA (inventario negativo) | Agregar CHECK + triggers |
| R7 | **Inconsistencia de datos agrícolas** | BAJA-MEDIA | MEDIA | Agregar CHECK constraints faltantes |
| R8 | **Timeouts en zonas rurales** | ALTA (sin paginación) | MEDIA (app no usable) | Paginación en queries + lazy loading |

---

## 6. MEJORAS RECOMENDADAS

### 6.1 INFRAESTRUCTURA Y SEGURIDAD

1. **Rotar todas las keys** — `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`. Agregar `.env` a `.gitignore`. Limpiar git history con `git-filter-repo`.
2. **Implementar `requireSupabaseAuth`** — Aplicar como middleware global a todas las server functions. Verificar JWT + rol admin en operaciones sensibles.
3. **Rate limiting** — Configurar en Supabase Auth (login/register). Implementar middleware de rate limiting en server functions.
4. **Migrar a httpOnly cookies** — Usar `@supabase/ssr` para eliminar dependencia de localStorage.
5. **CSP Headers** — Configurar Content-Security-Policy en la respuesta HTML.

### 6.2 BASE DE DATOS

6. **Fix migración M14** — Corregir nombres de columnas en índices: `catalog_id` (no `crop_catalog_id`), `record_id` (no `entity_id`).
7. **GRANT en `pest_incidents`** — Agregar `GRANT ALL ON public.pest_incidents TO authenticated;`
8. **Audit triggers** — Agregar `log_audit()` a: crops, activities, inventory_items, crop_costs, crop_harvests, batches, pest_incidents, calendar_events, alerts.
9. **CHECK constraints faltantes:**
   - `inventory_items.stock_qty >= 0`
   - `crops.estimated_harvest_date > planting_date`
   - `crop_harvests.harvested_qty > 0`
   - `inventory_movements.qty <> 0`
   - `crop_costs.kind IN ('INSUMOS', 'MANO_OBRA', 'MAQUINARIA', 'TRANSPORTE', 'OTROS')`
10. **Trigger `updated_at` para `inventory_items`**
11. **Índices FK faltantes** (7 columnas listadas en C6)

### 6.3 FUNCIONALES

12. **Paginación en todas las listas** — Implementar cursor-based pagination con `pageSize` configurable.
13. **Dashboard optimizado** — Agrupar queries, usar `Promise.allSettled` con fallbacks individuales, lazy load componentes pesados (Recharts, Leaflet).
14. **Modo offline real** — La sincronización actual solo replaya mutaciones al reconectar. Implementar:
    - Service Worker con cache-first strategy
    - Cola de mutaciones con retry exponencial
    - Sincronización bidireccional (no solo replay)
    - Indicador visual de "cambios pendientes de sincronizar"
15. **Búsqueda global con debounce** — La búsqueda `Ctrl+K` actualmente dispara queries en cada keystroke sin debounce.
16. **BOM UTF-8 en CSV** — Agregar `\uFEFF` al inicio de archivos CSV exportados.

### 6.4 UX/UI

17. **Simplificar navegación para agricultores** — Ocultar items irrelevantes (admin, audit, reports complejos) o agrupar en "Más herramientas".
18. **Feedback visual en operaciones lentas** — Barras de progreso en uploads de fotos, spinners en mutaciones.
19. **Refresh de signed URLs** — Implementar renovación periódica de URLs de fotos.
20. **Modo oscuro consistente** — Verificar que Leaflet, Recharts y todas las tablas respeten el theme.

### 6.5 DATOS AGRÍCOLAS

21. **Validación de fechas** — No permitir siembras futuras, cosechas antes de siembra, costos antes de la siembra del cultivo.
22. **Unidades consistentes** — `crop_costs.unit` debería usar el enum `unit_type`.
23. **Cascade completo** — Verificar que `activities.responsible_id` tenga ON DELETE CASCADE (ya se agregó).

---

## 7. QUICK WINS (Pueden implementarse en < 2 horas)

| # | Tarea | Esfuerzo | Impacto |
|---|-------|----------|---------|
| 1 | Agregar `.env` a `.gitignore` | 2 min | CRÍTICO |
| 2 | Agregar `GRANT ALL ON public.pest_incidents TO authenticated` | 2 min | CRÍTICO |
| 3 | Fix nombres columnas en M14 (`catalog_id`, `record_id`) | 5 min | CRÍTICO |
| 4 | `BOM UTF-8` en export CSV | 5 min | ALTO |
| 5 | Debounce en búsqueda global | 10 min | ALTO |
| 6 | Paginación básica (limit + offset) en listas principales | 30 min | ALTO |
| 7 | Ocultar items admin en sidebar para agricultores | 10 min | MEDIO |
| 8 | Loading states en operaciones lentas | 30 min | MEDIO |

---

## 8. ROADMAP DE MEJORAS

### FASE 1 — PRODUCTION-GATE (1-2 días)
```
□ Rotar todas las keys secretas
□ .gitignore + purge git history
□ Middleware requireSupabaseAuth en server functions
□ GRANT pest_incidents
□ Fix índices M14
□ Rate limiting en auth
```

### FASE 2 — SEGURIDAD (3-5 días)
```
□ Migrar a httpOnly cookies (@supabase/ssr)
□ Email verification enforcement
□ CSP + security headers
□ Check constraints en DB
□ Audit triggers en tablas faltantes
□ Server-side role verification en endpoints admin
```

### FASE 3 — RENDIMIENTO (1 semana)
```
□ Paginación cursor-based en todas las listas
□ Lazy loading real (React.lazy + Suspense) en rutas pesadas
□ Dashboard queries optimizadas (paralelas, cacheadas)
□ Service Worker cache-first strategy
□ Debounce en búsquedas
```

### FASE 4 — UX (1 semana)
```
□ Navegación contextual por rol
□ Modo offline robusto (sincronización bidireccional)
□ Refresh de signed URLs
□ BOM UTF-8 exportaciones
□ Loading skeletons consistentes
□ Modo oscuro verificado en todos los componentes
```

### FASE 5 — ESCALABILIDAD (2 semanas)
```
□ Virtual scrolling en listas grandes (react-window)
□ Sharding de reports por año/mes
□ Compresión de fotos en upload (client-side)
□ Caché de respuestas Supabase (React Query staleTime)
□ Indexación completa de todas las FK
□ Tests de carga con k6 (>1000 farmers, >100k registros)
```

---

## 9. CHECKLIST DE PRESENTACIÓN

### Para jurados universitarios:
- [ ] Arquitectura: Explicar TanStack Start como SSR progresivo + Supabase como BaaS
- [ ] Seguridad: Mostrar RLS policies como modelo de seguridad a nivel DB (aunque falten piezas)
- [ ] Cobertura: 22 cultivos colombianos, 15 agricultores con datos completos (1,007 actividades, 981 costos, etc.)
- [ ] Valor social: Agricultores pequeños con herramientas de agricultura de precisión (NDVI, alertas climáticas)
- [ ] Trazabilidad: QR público sin autenticación

### Para ingenieros senior:
- [ ] Base de datos bien diseñada (RLS en todas las tablas, enums, FKs, índices)
- [ ] Schema evolutivo claro (15 migraciones)
- [ ] Offline-first con IndexedDB
- [ ] **PREPARAR RESPUESTA ANTICIPADA** para: "¿Por qué están las service keys en el repo?" (rotar antes de presentar)
- [ ] **PREPARAR RESPUESTA ANTICIPADA** para: "¿Cómo evitan que un técnico elimine datos?" (mostrar RLS DELETE policies + fix M13)

### Para inversionistas / gobierno:
- [ ] **NO presentar la versión actual** sin aplicar Fase 1 y 2 del roadmap
- [ ] Costo total del sistema: $0 en licencias (open source + Supabase local). Costo operativo: ~$20/mes (hosting + API)
- [ ] Potencial de escalabilidad nacional: arquitectura cloud-ready (TanStack Start + Nitro deploy a Cloudflare)
- [ ] Demo funcional con datos realistas colombianos (precios DANE, 22 cultivos, coordenadas Colombia)

### Demo funcional (orden recomendado):
1. Login como admin (`admin@sgic.local` / `Admin123!`) — mostrar /admin
2. Login como técnico (`andrea.jimenez@tec.sgic`) — mostrar dashboard multi-farmer
3. Login como agricultor (`carlos.mamani@test.sgic`) — mostrar experiencia propia
4. Crear actividad + cosecha + costo
5. Mostrar reportes (PDF, Excel, gráficos)
6. Mostrar mapa con parcelas + NDVI
7. Escanear QR de trazabilidad
8. Mostrar alertas climáticas predictivas + AI insights
9. Mostrar modo offline (desconectar, mostrar cola de sincronización)

---

## 10. VEREDICTO FINAL

### Calificaciones:

| Dimensión | Puntaje | Justificación |
|-----------|---------|---------------|
| **Arquitectura** | **7.5/10** | TanStack Start + Supabase es acertado. Migraciones bien estructuradas. El patrón RLS es correcto. Sin embargo: migración M14 rota, seed-data.server sin auth, offline-sync subdesarrollado. |
| **Funcionalidad** | **8.0/10** | Cobertura de dominio excepcional: parcelas, cultivos, actividades, costos, cosechas, plagas, inventario, NDVI, alertas, trazabilidad, reportes, AI. Faltan: notificaciones push reales, integración real SAT (NDVI automático), programación de reportes (backend). |
| **Seguridad** | **3.5/10** | **SUSPENSO.** 6 críticos + 8 altos + 5 medios. El RLS está bien implementado, pero los secretos expuestos, endpoints sin auth, JWT en localStorage y falta de rate limiting anulan cualquier fortaleza. |
| **UX** | **7.5/10** | Diseño profesional con shadcn/ui. Navegación clara. Responsive funcional. Fricciones: sidebar saturada, sin onboarding, sin tooltips contextuales, sin búsqueda global eficiente, sin feedback en operaciones lentas. |
| **Rendimiento** | **5.5/10** | Sin paginación en ninguna lista. Dashboard carga 10 queries seriales. Componentes pesados (Recharts, Leaflet) sin lazy loading efectivo. Sin virtual scrolling. La app funcionará mal con >100 agricultores. |
| **Escalabilidad** | **4.5/10** | La arquitectura (TanStack Start + Cloudflare + Supabase) escala horizontalmente. Pero la capa de datos no: sin paginación, sin índices completos, sin sharding, sin particionamiento. El límite práctico es ~100 farmers sin intervención. |
| **Calidad General** | **6.0/10** | Es un MVP+ funcional con excelente cobertura de dominio y un equipo técnico que claramente sabe lo que hace. Las debilidades son de madurez y blindaje, no de concepto. Con 2 semanas de trabajo enfocado en seguridad + rendimiento, alcanza 8.0+. |

### Veredicto de Preparación para Producción:

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ❌ NO APTO PARA PRODUCCIÓN                             ║
║                                                          ║
║   Se requieren correcciones críticas antes de            ║
║   cualquier despliegue público.                           ║
║                                                          ║
║   Estado actual: PROTOTIPO FUNCIONAL                      ║
║   Objetivo próximo: MVP VALIDADO                          ║
║                                                          ║
║   Tiempo estimado a producción: 3-4 semanas               ║
║   (1 sem seguridad + 1 sem rendimiento + 1-2 sem UX/QA)  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

### Próximos pasos inmediatos (mañana):

1. Rotar `SUPABASE_SERVICE_ROLE_KEY` en Supabase Dashboard
2. Agregar `.env` a `.gitignore`
3. Aplicar `requireSupabaseAuth` middleware a `deleteUser`, `clearAllUsers`, `seedTestData`
4. Aplicar migración fix (`GRANT pest_incidents` + fix índices M14)
5. Re-test: `npm run build` debe pasar sin errores

---

*Documento generado como parte de auditoría integral. 180+ archivos analizados, 15 migraciones SQL revisadas, 20 rutas inspeccionadas, 68 componentes evaluados.*
