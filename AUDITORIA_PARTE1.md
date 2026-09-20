# INFORME DE AUDITORÍA PROFESIONAL
## Sistema de Seguimiento y Gestión Inteligente de Cultivos (SGIC)

**Fecha:** 2026-06-07 | **Framework:** TanStack Start v1.168 + React 19 + Supabase (Docker)
**Auditores:** Arquitecto, PO, QA, UX, Seguridad, DB, Cloud, Full Stack

---

## RESUMEN EJECUTIVO

| Métrica | Valor |
|---------|-------|
| Archivos analizados | ~95 (12 migraciones, 20 rutas, 25 componentes) |
| Tablas en BD | 20 |
| Políticas RLS | 20 |
| Hallazgos CRÍTICOS | 6 | Hallazgos ALTOS | 14 | MEDIOS | 22 | BAJOS | 10 |

**Riesgo general: ALTO** — Vulnerabilidades de seguridad críticas (secretos expuestos, service role key en cliente), bugs de RLS que permiten a técnicos eliminar datos, y problemas de UX que afectarían la adopción.

---

## FASE 1: ACTORES Y PERMISOS

### Actores Actuales
| Actor | ¿Suficiente? | Recomendación |
|-------|-------------|---------------|
| Agricultor | ✅ | OK |
| Técnico Agrónomo | ✅ | Renombrar a "Supervisor de Campo" |
| Administrador | ✅ | OK |

### Nuevos Actores Propuestos
| Actor | Justificación |
|-------|---------------|
| **Supervisor Regional** | Gestiona múltiples técnicos, ve KPIs regionales |
| **Operario de Campo** | Solo registra actividades, no ve datos financieros |
| **Invitado / Visor** | Solo lectura de reportes compartidos |
| **Contador / Finanzas** | Acceso a costos, ingresos, reportes financieros |
| **Certificador** | Para auditorías GlobalGAP, orgánico |
| **Sistema (API)** | Para integraciones con sistemas externos |

### Problemas de Permisos Detectados
| # | Problema | Severidad | Solución |
|---|----------|-----------|----------|
| P1 | Técnico puede ELIMINAR parcelas, cultivos, actividades (bug RLS FOR ALL) | CRÍTICO | Separar políticas por operación; DELETE solo admin |
| P2 | Técnico puede ELIMINAR inventario (mismo bug) | CRÍTICO | Separar políticas |
| P3 | No existe rol "visor" para compartir reportes | MEDIO | Crear nuevo rol |
| P4 | No existe rol "operario" para registro rápido en campo | MEDIO | Crear subrol de técnico |
| P5 | Admin tiene todos los permisos sin restricciones | BAJO | Separar "Admin del sistema" de "Super Admin" |

---

## FASE 2: FUNCIONALIDADES POR MÓDULO

### 2.1 Autenticación
| Funcionalidad | Estado | Riesgo | Prioridad |
|--------------|--------|--------|-----------|
| Registro/Login/Logout | ✅ | JWT en localStorage (XSS) | ALTA |
| Recuperación de contraseña | ❌ | Usuario bloqueado sin recovery | CRÍTICA |
| Verificación de correo | ❌ | Cuentas no verificadas | ALTA |
| Cambio de contraseña | ❌ | Usuario no puede cambiar su pass | ALTA |
| 2FA / MFA | ❌ | Sin doble factor | MEDIA (V2) |
| Bloqueo por intentos fallidos | ❌ | Ataque de fuerza bruta | CRÍTICA |
| Gestión de sesiones activas | ❌ | No se ven sesiones abiertas | MEDIA |

### 2.2 Usuarios
| Funcionalidad | Estado | Observación |
|--------------|--------|-------------|
| Crear/Editar perfil | ✅ | OK |
| Eliminar/Suspender usuario | ❌ | Sin soft-delete ni desactivación |
| Historial de actividad | ❌ | No hay tracking de últimos accesos |
| Asignar/Ver roles | ✅ | Solo admin |

**Recomendación:** Agregar is_active, last_login_at, deleted_at en profiles.

### 2.3 Parcelas
| Funcionalidad | Estado | Mejora |
|--------------|--------|--------|
| CRUD + GPS + Mapa | ✅ | OK |
| Análisis de suelo | ❌ | Sin tabla soil_analysis (pH, N, P, K, MO) |
| Fotos de parcela | ❌ | No hay galería de imágenes |
| Historial de rotación | ❌ | Sin crop_rotation_plan |
| Documentos adjuntos | ❌ | Sin subida de documentos legales |

### 2.4 Cultivos
| Funcionalidad | Estado | Mejora |
|--------------|--------|--------|
| CRUD + Estados + Catálogo | ✅ | OK |
| Seguimiento plagas | ✅ | pest_incidents |
| Galería fotos | ✅ | OK |
| Predicción cosecha | ❌ | Basado en ciclo + fecha siembra |
| Alertas por etapa fenológica | ❌ | No hay automáticas por etapa |
| Variedad/híbrido/semilla | ❌ | Campos missing: variety, seed_source, seed_lot |

### 2.5 Actividades Agrícolas
| Funcionalidad | Estado | Problema |
|--------------|--------|----------|
| 7 tipos de actividad | ✅ | OK |
| Duración de actividad | ❌ | Sin campo duration_hours |
| Costo de actividad | ❌ | Sin costo asociado directo |
| Mano de obra | ❌ | Sin registro de trabajadores ni horas-hombre |
| Insumos usados | ❌ | Sin relación actividad → inventario |
| Firma digital | ❌ | Para conformidad |

### 2.6 Calendario
| Funcionalidad | Estado | Observación |
|--------------|--------|-------------|
| Vista mensual + eventos en vivo | ✅ | OK |
| Eventos recurrentes | ❌ | Sin repetición semanal/mensual |
| Recordatorios push | ❌ | Sin notificaciones programadas |
| Vista semanal/agenda | ❌ | Solo vista mensual |
| Arrastrar y soltar | ❌ | No se puede re-programar |

### 2.7 Alertas
| Funcionalidad | Estado | Recomendación |
|--------------|--------|---------------|
| Alertas manuales + asignables | ✅ | OK |
| Alertas automáticas (RPC) | ⚠️ Parcial | Existe función pero sin UI |
| Alertas climáticas | ❌ | Sin integración con API climática |
| Alertas por stock mínimo | ❌ | min_stock existe sin alerta |
| Notificaciones push | ⚠️ Parcial | Tabla push_subscriptions existe, no implementado |
| Badge en sidebar | ❌ | Sin contador de alertas pendientes |
| Notificaciones SMS/WhatsApp | ❌ | Excluido por decisión |

### 2.8 Reportes
| Funcionalidad | Estado | Mejora |
|--------------|--------|--------|
| PDF dashboard + Excel costos | ✅ | jsPDF + xlsx |
| Reporte programado | ❌ | scheduled_reports sin UI |
| Reporte por cultivo | ❌ | Rendimiento, costos, actividades |
| Reporte de trazabilidad | ❌ | Lote → campo → consumidor |
| Dashboard ejecutivo | ❌ | KPIs consolidados para gerencia |

### 2.9 Módulo Offline
| Funcionalidad | Estado | Riesgo |
|--------------|--------|--------|
| Almacenamiento local | ❌ | Sin Service Worker ni cache |
| Sincronización | ❌ | Sin cola de operaciones offline |
| Indicador de conectividad | ❌ | Sin indicador online/offline |

**Riesgo:** En zonas rurales sin internet, la app es completamente inutilizable.

---

## FASE 3: BASE DE DATOS

### Tablas Críticamente Faltantes
| Tabla | Prioridad | Justificación |
|-------|-----------|---------------|
| soil_analysis | ALTA | Sin análisis de suelo no hay agricultura de precisión |
| weather_history | ALTA | weather_cache solo guarda 1 registro (sin historial) |
| irrigation_events | ALTA | Trazabilidad de agua (crítico para certificación) |
| labor_records | ALTA | Costos de MO = ~40% del costo total |
| financial_transactions | MEDIA | Pagos, facturas, estado de cuenta |
| contracts | MEDIA | Contratos de arrendamiento o producción |
| crop_rotation_plan | MEDIA | Planificación de rotación |

### Índices Faltantes (14 índices)
Los más críticos:
`sql
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);  -- USADO EN TODAS LAS RLS
CREATE INDEX idx_user_roles_role ON user_roles(role);         -- has_role()
CREATE INDEX idx_inventory_items_owner ON inventory_items(owner_id);
CREATE INDEX idx_crop_costs_crop ON crop_costs(crop_id);
CREATE INDEX idx_crop_harvests_crop ON crop_harvests(crop_id);
`

### Restricciones CHECK Faltantes
`sql
-- Planting antes que harvest
ALTER TABLE crops ADD CHECK (estimated_harvest_date IS NULL OR estimated_harvest_date >= planting_date);
-- Cantidades positivas
ALTER TABLE crop_harvests ADD CHECK (harvested_qty > 0);
ALTER TABLE crop_costs ADD CHECK (total > 0);
ALTER TABLE inventory_movements ADD CHECK (qty > 0);
ALTER TABLE inventory_items ADD CHECK (stock_qty >= 0);
`

### updated_at Triggers Faltantes
Faltan en: activities, calendar_events, alerts, crop_costs, crop_harvests, batches, inventory_movements, pest_incidents.

### Auditoría Faltante
Faltan triggers audit en: crops (ALTA), activities (ALTA), inventory_items (ALTA), crop_costs (ALTA), crop_harvests (ALTA), batches (ALTA), pest_incidents (ALTA).

