## FASE 4: SEGURIDAD (OWASP TOP 10)

### Evaluación
| # | Categoría OWASP | Riesgo en SGIC | Severidad |
|---|----------------|----------------|-----------|
| A01 | Broken Access Control | Técnico puede DELETE (bug RLS FOR ALL) | CRÍTICO |
| A02 | Cryptographic Failures | JWT en localStorage + API key Groq en localStorage | CRÍTICO |
| A03 | Injection | SQL potencial via RPC con 'as any' | ALTO |
| A04 | Insecure Design | Roles solo en cliente, sin server-side check | ALTO |
| A05 | Security Misconfiguration | Service role key expuesta (VITE_) | CRÍTICO |
| A07 | IDOR | Técnico accede a datos de cualquier agricultor | ALTO |
| A09 | Logging Failures | Audit_log solo en 2 tablas | ALTO |

### Vulnerabilidades Específicas
| # | Hallazgo | Archivo | Severidad |
|---|----------|---------|-----------|
| V1 | Groq API key en .env commiteado | .env | CRÍTICA |
| V2 | Service Role Key con prefijo VITE_ (expuesta al cliente) | .env | CRÍTICA |
| V3 | API key de Groq en localStorage (XSS) | ai-chat.tsx:74 | CRÍTICA |
| V4 | Técnico puede DELETE parcelas (RLS bug FOR ALL) | Migraciones | CRÍTICA |
| V5 | XSS en popups de Leaflet | parcel-map.tsx:81,86 | ALTA |
| V6 | Sin password recovery | Auth | ALTA |
| V7 | Sin rate limiting en login | Auth (config Supabase) | ALTA |
| V8 | Sin verificación de email | Auth | ALTA |
| V9 | Autorización de roles solo en cliente | admin.tsx, audit.tsx | ALTA |
| V10 | JWT en localStorage (vulnerable a XSS) | client.ts | ALTA |
| V11 | Sin validación MIME real en subida de fotos | crops.\.tsx | MEDIA |
| V12 | Sin CSRF protection | Global | MEDIA |
| V13 | 'as any' en RPC calls evita type-checking | inventory-panel.tsx, queries.ts | MEDIA |

### Recomendaciones de Seguridad Inmediatas
1. Rotar Groq API key y Supabase service role key
2. Eliminar .env del repo (agregar a .gitignore)
3. Migrar API key de Groq a server-side (createServerFn proxy)
4. Eliminar VITE_SUPABASE_SERVICE_ROLE_KEY
5. Separar políticas RLS FOR ALL en operaciones individuales (DELETE solo admin)
6. Sanitizar nombres en popups de Leaflet (innerText vs innerHTML)
7. Implementar password recovery (supabase.auth.resetPasswordForEmail())
8. Migrar sesión a httpOnly cookies (@supabase/ssr)
9. Configurar rate limiting en Supabase Auth

---

## FASE 5: EXPERIENCIA DE USUARIO

### Problemas de UX Identificados
| # | Problema | Archivos | Severidad |
|---|----------|----------|-----------|
| UX1 | Sin skeleton loaders — solo texto 'Cargando...' | TODAS las rutas | ALTA |
| UX2 | Sin estados de error por componente | Dashboard, weather, NDVI, alerts | ALTA |
| UX3 | confirm() nativo en acciones destructivas | parcels, crops, calendar | ALTA |
| UX4 | Sin badge de notificaciones en sidebar | app-shell.tsx | MEDIA |
| UX5 | Sin indicador de datos desactualizados | Global | MEDIA |
| UX6 | Labels sin htmlFor en formularios | parcels, crops, inventory | MEDIA |
| UX7 | Sin aria-labels en botones de acción | app-shell, parcels, inventory | MEDIA |
| UX8 | Sidebar no es off-canvas en móvil | app-shell.tsx | MEDIA |
| UX9 | Sin traducciones en textos de UI | dashboard, alerts, calendar | MEDIA |
| UX10 | Sin onboarding para nuevos usuarios | Global | BAJA |

### Recomendaciones de UX
1. Skeleton loaders en TODAS las vistas (componente Skeleton ya existe)
2. Error states con isError + botón Reintentar
3. AlertDialog de shadcn/ui en vez de confirm()
4. Badge de alertas pendientes en sidebar
5. Indicador "Última actualización" con dataUpdatedAt
6. htmlFor en labels, aria-label en botones
7. Sheet de shadcn/ui para navegación móvil
8. Completar i18n (mover textos a archivos de traducción)
9. Wizard de onboarding de 3 pasos

---

## FASE 6: ESCALABILIDAD

| Escala | Cuello de Botella | Solución |
|--------|-------------------|----------|
| 100 usuarios | Sin problemas | — |
| 1.000 usuarios | Dashboard: 10 queries simultáneas | Consolidar en 1 endpoint |
| 10.000 usuarios | 100,000 req/día a Supabase | Rate limiting, caché Redis |
| 100.000 usuarios | Listas sin paginación (DOM explosion) | Virtualización + paginación |
| 1M+ usuarios | Supabase local Docker no escala | Migrar a Supabase cloud o RDS |

### Cuellos de Botella
| # | Problema | Lugar | Solución |
|---|----------|-------|----------|
| E1 | Dashboard: 10 queries en paralelo | dashboard.tsx | Consolidar en 1 server function |
| E2 | max_rows=1000 en config | supabase/config.toml | Aumentar a 10000 |
| E3 | Sin paginación en consultas | queries.ts | range() + useInfiniteQuery |
| E4 | Sin índices en FK columns (14) | Migraciones | Agregar índices |
| E5 | refetchOnMount:true por defecto | React Query | staleTime: 5min global |
| E6 | Librerías pesadas sincronas | imports | lazy() / dynamic import() |
| E7 | Sin virtualización de listas | cultivos, parcels | @tanstack/react-virtual |
| E8 | Sin rate limiting | Supabase config | Plan enterprise |

---

## FASE 7: TESTING

### Estrategia Propuesta
| Tipo | Herramienta | Prioridad |
|------|-------------|-----------|
| Unit tests | Vitest | ALTA |
| Component tests | Testing Library + Vitest | ALTA |
| Integration/E2E | Playwright | ALTA |
| Security | OWASP ZAP | MEDIA |
| Performance | k6 | MEDIA |
| Accessibility | axe-core + Playwright | MEDIA |

### Casos de Prueba Prioritarios
| ID | Módulo | Caso | Resultado Esperado |
|----|--------|------|-------------------|
| TC-001 | Auth | Login válido | Redirige a dashboard |
| TC-002 | Auth | Login inválido | Mensaje de error |
| TC-003 | Auth | Login como técnico | Ve dropdown agricultores |
| TC-004 | Auth | Login como agricultor | NO ve dropdown |
| TC-005 | Dashboard | Filtro por agricultor | Charts y cards se actualizan |
| TC-006 | Dashboard | Export PDF filtrado | PDF descarga con datos |
| TC-007 | Dashboard | Ficha técnica | Modal con datos |
| TC-008 | Alertas | Crear alerta como técnico para otro | Aparece en destino |
| TC-009 | Alertas | Crear alerta como agricultor | Solo a sí mismo |
| TC-010 | Parcelas | Crear con polígono | Polígono guardado |
| TC-011 | Cultivos | Agregar plaga | Plaga visible en pestaña |
| TC-012 | Calendario | Ver eventos del mes | Actividades + cultivos + eventos |
| TC-013 | QR | Escanear QR de lote | Navega a trazabilidad |
| TC-014 | Inventario | Filtrar por agricultor (staff) | Solo items del agricultor |
| TC-015 | Fotos | Subir evidencia | Foto en galería |

### Casos de Seguridad
| ID | Prueba | Método |
|----|--------|--------|
| TS-001 | DELETE como técnico | Verificar RLS bloquea |
| TS-002 | XSS en nombre parcela | <script>alert(1)</script> no debe ejecutarse |
| TS-003 | SQL injection en RPC | Inyectar SQL en parámetros |
| TS-004 | Fuerza bruta login | 10 intentos → bloqueo |
| TS-005 | Subida archivo malicioso | .exe, .html deben ser rechazados |

---

## FASE 8: MATRIZ DE FUNCIONALIDADES

| ID | Funcionalidad | Actor | Prioridad | Estado |
|----|--------------|-------|-----------|--------|
| F001 | Login/Logout | Todos | P0 | ✅ |
| F002 | Recuperación de contraseña | Todos | P0 | ❌ |
| F003 | Verificación de email | Todos | P0 | ❌ |
| F004 | Rate limiting en login | Todos | P0 | ❌ |
| F005 | Dashboard KPIs | Todos | P0 | ✅ |
| F006 | Filtro agricultor (staff) | Técnico+Admin | P0 | ✅ |
| F007 | Gráfico rendimiento | Todos | P0 | ✅ |
| F008 | P&L costos/ingresos | Todos | P0 | ✅ |
| F009 | Exportar PDF | Staff | P0 | ✅ |
| F010 | CRUD parcelas | Agricultor+Admin | P0 | ✅ |
| F011 | CRUD cultivos | Todos | P0 | ✅ |
| F012 | CRUD actividades | Todos | P0 | ✅ |
| F013 | CRUD costos | Todos | P0 | ✅ |
| F014 | CRUD cosechas | Todos | P0 | ✅ |
| F015 | Gestión plagas | Técnico+Admin | P0 | ✅ |
| F016 | Galería fotos | Todos | P0 | ✅ |
| F017 | Calendario agrícola | Todos | P0 | ✅ |
| F018 | Alertas y notificaciones | Todos | P0 | ✅ |
| F019 | Inventario insumos | Agricultor+Admin | P0 | ✅ |
| F020 | Trazabilidad QR | Todos | P0 | ✅ |
| F021 | Mapa parcelas | Todos | P0 | ✅ |
| F022 | Clima multi-parcela | Staff | P0 | ✅ |
| F023 | Chat IA agrícola | Todos | P1 | ✅ |
| F024 | Skeleton loaders | Todos | P1 | ❌ |
| F025 | Estados de error | Todos | P1 | ❌ |
| F026 | AlertDialog confirmaciones | Todos | P1 | ❌ |
| F027 | Badge notificaciones | Todos | P1 | ❌ |
| F028 | Onboarding primer uso | Todos | P1 | ❌ |
| F029 | Análisis de suelo | Técnico+Admin | P1 | ❌ |
| F030 | Historial climático | Todos | P1 | ❌ |
| F031 | Gestión usuarios (suspender) | Admin | P1 | ❌ |
| F032 | Roles: Operario, Visor | Admin | P1 | ❌ |
| F033 | Eventos recurrentes | Todos | P2 | ❌ |
| F034 | Recordatorios push | Todos | P2 | ❌ |
| F035 | Reportes programados | Staff | P2 | ❌ |
| F036 | PWA / Offline-first | Todos | P2 | ❌ |
| F037 | 2FA / MFA | Staff | P3 | ❌ |
| F038 | Dashboard predictivo IA | Staff | P4 | ❌ |
| F039 | Recomendaciones inteligentes | Todos | P4 | ❌ |
| F040 | Detección temprana plagas (IA) | Staff | P4 | ❌ |
| F041 | Predicción de cosecha | Todos | P4 | ❌ |

---

## FASE 9: ROADMAP MVP vs EMPRESARIAL

### MVP (P0 - Lanzamiento inmediato tras bugs críticos)
Requiere: 0 bugs críticos, 0 bugs altos, E2E pasando

Funcionalidades existentes + fixes:
- Rotar credenciales (Groq, Supabase)
- Separar RLS FOR ALL (DELETE solo admin)
- Implementar password recovery
- Rate limiting en login
- Skeleton loaders básicos
- AlertDialog en acciones destructivas

### Versión 2.0 (P1 - Siguiente sprint)
- Análisis de suelo (soil_analysis)
- Historial climático (weather_history)
- Registro de irrigación (irrigation_events)
- Labor records (labor_records)
- Badge de notificaciones en sidebar
- Estados de error visibles
- Off-canvas navigation mobile
- i18n completo
- Onboarding wizard
- Gestión de usuarios (suspender/eliminar)
- Roles: Operario, Visor

### Versión Empresarial (P2-P3)
- PWA / Offline-first completo
- Eventos recurrentes en calendario
- Recordatorios push
- Reportes programados automáticos
- Reporte de trazabilidad lote→campo
- Financial transactions
- Contracts management
- Equipos y maquinaria
- 2FA / MFA
- Integración Google Calendar
- Exportar reporte como imagen

### Versión con IA (P4)
- Dashboard predictivo (pronóstico cosecha)
- Recomendaciones inteligentes de riego/fertilización
- Detección temprana de plagas (imágenes)
- Predicción de rendimiento por parcela
- Chat IA avanzado con contexto agrícola completo
- Optimización de rotación de cultivos
- Alertas climáticas predictivas

---

## PLAN DE ACCIÓN INMEDIATO (30 DÍAS)

### Semana 1: Bugs críticos de seguridad
1. Rotar Groq API key y service role key
2. Eliminar .env del repo + .gitignore
3. Migrar Groq API key a server-side
4. Separar políticas RLS FOR ALL (DELETE admin-only)

### Semana 2: Bugs funcionales
5. Implementar password recovery
6. Configurar rate limiting Supabase Auth
7. Reemplazar confirm() con AlertDialog
8. Agregar skeleton loaders

### Semana 3: UX y estabilidad
9. Agregar estados de error (isError)
10. Badge de notificaciones
11. i18n de textos pendientes
12. Sanitizar XSS en popups Leaflet

### Semana 4: Testing y despliegue
13. Escribir tests E2E (Playwright)
14. Migrar a @supabase/ssr (cookies httpOnly)
15. Configurar índices faltantes
16. Agregar CHECK constraints + updated_at triggers
17. Agregar audit triggers faltantes

---

*Fin del informe — 95+ archivos analizados, 52 hallazgos documentados.*
