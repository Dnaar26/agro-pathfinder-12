# Historias de usuario y criterios de aceptación

**Producto:** Gestión Inteligente de Cultivos · **Fecha:** 26-09-2026  
**Base técnica revisada:** React/TanStack Start + Vite, Supabase Auth/Postgres/RLS. No hay backend NestJS ni Prisma en este repositorio.

| ID | Historia | Prioridad |
|---|---|---|
| HU-01 | Como visitante quiero registrarme e iniciar sesión para usar las funciones autorizadas. | Alta |
| HU-02 | Como agricultor quiero crear y editar mis parcelas para organizar mi finca. | Alta |
| HU-03 | Como propietario/admin quiero eliminar una parcela para retirar un lote y todas sus dependencias. | Alta |
| HU-04 | Como agricultor quiero registrar una siembra con fecha para conocer su estado real. | Alta |
| HU-05 | Como agricultor quiero confirmar el inicio de una siembra programada para iniciar su seguimiento. | Alta |
| HU-06 | Como agricultor quiero gestionar mis insumos para controlar existencias. | Alta |
| HU-07 | Como usuario quiero recibir notificaciones pertinentes para actuar a tiempo. | Alta |
| HU-08 | Como técnico quiero notificar solo a mis agricultores asignados para respetar mi ámbito de trabajo. | Alta |
| HU-09 | Como administrador quiero gestionar roles, asignaciones y umbrales para gobernar el sistema. | Alta |

## HU-01 — Acceso
**Como** visitante, **quiero** registrarme e iniciar sesión, **para** acceder según mi rol.  
**Criterios**
- **Dado** un correo y contraseña válidos, **cuando** envío el acceso, **entonces** se crea la sesión y navego al dashboard.
- **Dado** credenciales inválidas, **cuando** envío el formulario, **entonces** veo un error y no se crea sesión.
- **Dado** una ruta autenticada, **cuando** no tengo sesión, **entonces** soy redirigido a acceso.  
**Prioridad:** Alta.

## HU-02 — Crear y editar parcela
**Como** agricultor, **quiero** crear y editar mis parcelas, **para** asociarles cultivos.  
**Criterios**
- **Dado** nombre y área positiva válidos, **cuando** guardo, **entonces** la parcela aparece en listado y mapa.
- **Dado** un área vacía, cero o negativa, **cuando** guardo, **entonces** se informa validación y no se inserta.
- **Dado** una parcela ajena, **cuando** intento editarla, **entonces** RLS rechaza la operación.  
**Prioridad:** Alta.

## HU-03 — Eliminar parcela en cascada
**Como** propietario o administrador, **quiero** eliminar una parcela, **para** quitar un lote y sus datos dependientes.  
**Criterios**
- **Dado** una parcela propia con cultivos, **cuando** confirmo eliminar, **entonces** `delete_parcel_cascade` elimina parcela, cultivos y dependencias en una transacción y confirma el UUID eliminado.
- **Dado** un fallo del backend, **cuando** confirmo, **entonces** el diálogo no muestra éxito ni se cierra de forma optimista.
- **Dado** éxito, **cuando** termina la RPC, **entonces** se invalidan las consultas de parcelas/cultivos y desaparece del mapa y listado.  
**Prioridad:** Alta.

## HU-04 — Registrar siembra y calcular estado
**Como** agricultor, **quiero** registrar parcela, cultivo y fecha, **para** distinguir siembra realizada de programada.  
**Criterios**
- **Dado** fecha hoy o anterior, **cuando** guardo, **entonces** el estado es `SEMBRADO`.
- **Dado** fecha futura, **cuando** guardo, **entonces** el estado es `PLANEADO`.
- **Dado** una fecha editada, **cuando** aún está en estado inicial, **entonces** el trigger recalcula el estado; no modifica estados posteriores.  
**Regla:** se permiten fechas pasadas de forma intencional, para registrar siembras ya realizadas.  
**Prioridad:** Alta.

## HU-05 — Confirmar inicio programado
**Como** agricultor, **quiero** recibir y confirmar el inicio, **para** que una siembra planificada no se marque como iniciada sin evidencia.  
**Criterios**
- **Dado** un cultivo `PLANEADO` cuya fecha llegó, **cuando** corre el cron diario, **entonces** se genera una alerta automática idempotente y el estado sigue `PLANEADO`.
- **Dado** esa alerta, **cuando** confirmo inicio, **entonces** se guarda `planting_confirmed_at` y cambia a `SEMBRADO`.
- **Dado** una fecha futura, **cuando** veo el detalle, **entonces** no se ofrece confirmar inicio.  
**Prioridad:** Alta.

## HU-06 — Stock y alerta automática
**Como** agricultor, **quiero** registrar existencias y movimientos, **para** evitar quedarme sin insumos.  
**Criterios**
- **Dado** un insumo propio, **cuando** registro una entrada/salida válida, **entonces** el stock se actualiza mediante la RPC segura.
- **Dado** stock menor o igual a `max(min_stock, stock_alert_threshold)`, **cuando** corre el generador, **entonces** recibo una alerta automática de stock.
- **Dado** alertas de stock deshabilitadas, **cuando** corre el generador, **entonces** no se crea alerta.  
**Prioridad:** Alta.

## HU-07 — Recibir notificaciones por rol
**Como** agricultor, **quiero** ver avisos automáticos y de mi técnico separados, **para** reconocer su origen.  
**Criterios**
- **Dado** alertas pendientes, **cuando** ingreso a Alertas, **entonces** veo secciones `Automáticas` y `De tu técnico`.
- **Dado** una alerta automática, **cuando** se almacena, **entonces** tiene `origin=AUTOMATICA` y `sender_id=NULL`.
- **Dado** un agricultor, **cuando** abre Alertas, **entonces** no ve formulario ni botón de envío.  
**Prioridad:** Alta.

## HU-08 — Aviso manual de técnico
**Como** técnico, **quiero** enviar un aviso a agricultores asignados, **para** dar seguimiento técnico.  
**Criterios**
- **Dado** un técnico, **cuando** abre destinatarios, **entonces** `list_manual_alert_recipients()` devuelve solo sus agricultores asignados.
- **Dado** un agricultor no asignado, **cuando** se intenta invocar la RPC manual con su ID, **entonces** `create_manual_alert()` la rechaza en base de datos.
- **Dado** envío permitido, **cuando** se crea, **entonces** queda `origin=MANUAL` y `sender_id` es el técnico autenticado.  
**Prioridad:** Alta.

## HU-09 — Administración
**Como** administrador, **quiero** asignar técnicos, roles y umbral global, **para** controlar el acceso y alertas.  
**Criterios**
- **Dado** un administrador, **cuando** asigna técnico-agricultor, **entonces** se crea la relación y el técnico puede consultar ese agricultor.
- **Dado** un administrador, **cuando** configura un umbral >= 0, **entonces** se persiste en `alert_settings.stock_alert_threshold`.
- **Dado** un usuario no administrador, **cuando** intenta editar asignaciones/configuración, **entonces** RLS lo rechaza.  
**Prioridad:** Alta.
