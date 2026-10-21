# Integraciones recomendadas para SIGIC

Este documento ordena integraciones que pueden mejorar el producto sin introducir acoplamientos innecesarios. Cada integracion debe pasar por staging, tener responsable, presupuesto y una ruta de desactivacion.

## Prioridad inmediata

### 1. MFA para administradores y tecnicos

Activar TOTP de Supabase para cuentas con permisos elevados. La aplicacion ya centraliza la autenticacion y puede incorporar un flujo de enrolamiento, desafio y verificacion sin almacenar secretos de MFA propios.

- **Beneficio:** reduce el riesgo de toma de cuentas con acceso a datos y operaciones sensibles.
- **Implementacion:** pantalla de seguridad en perfil, verificacion AAL2 para rutas administrativas y codigos de recuperacion administrados por el proveedor.
- **Referencia:** [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa).

### 2. Observabilidad de errores y rendimiento

Conectar `captureAppError` a Sentry u otro APM compatible. Debe enviarse el error, ruta, rol no sensible, identificador de despliegue y correlacion de solicitud; nunca tokens, contrasenas, telefonos completos ni contenido de parcelas sin consentimiento.

- **Beneficio:** permite detectar errores reales despues del lanzamiento y medir tiempos de carga.
- **Implementacion:** integracion opcional por variables de entorno, muestreo en produccion y alertas por tasa de errores.
- **Referencia:** [Sentry para React](https://sentry.io/for/react/).

### 3. Precios SIPSA/DANE con contrato versionado

Configurar `VITE_MARKET_PRICES_URL` solo despues de validar el endpoint o un adaptador propio. El cliente acepta un arreglo o `{ data: [] }`, valida los registros y etiqueta los datos locales como referencia cuando el proveedor no esta disponible.

- **Beneficio:** evita decisiones basadas en datos simulados presentados como actuales.
- **Implementacion:** crear un adaptador server-side si el endpoint requiere transformacion, registrar fecha/fuente y probar cambios de formato con fixtures.
- **Referencia:** [Geoportal SIPSA del DANE](https://geoportal.dane.gov.co/geovisores/territorio/precios-mayoristas-sipsa/).

## Prioridad de corto plazo

### 4. Notificaciones programadas

Mover el envio de SMS y push a un outbox en Supabase/Edge Functions. Las alertas deben registrar `pending`, `sent`, `failed`, reintentos y fecha de ultimo intento. El cliente no debe considerar entregado un mensaje solo porque la funcion fue invocada.

- **Opciones:** proveedor SMS con contrato empresarial, Web Push con VAPID o un proveedor omnicanal.
- **Control:** limite por usuario, deduplicacion por tipo de alerta y ventana temporal para no saturar al agricultor.

### 5. Evidencias con almacenamiento seguro

Usar bucket privado de Supabase Storage, URLs firmadas de corta duracion, limites de MIME/tamano y escaneo antivirus antes de exponer archivos. La base de datos debe guardar solo metadatos y el path privado.

### 6. Monitoreo operativo

Conservar `/healthz` para disponibilidad basica y añadir un chequeo separado de dependencias para el panel interno: Supabase, almacenamiento, servicio de IA y fuente meteorologica. El chequeo no debe filtrar secretos y debe distinguir `degraded` de `down`.

## Prioridad de mediano plazo

### 7. Analitica de producto respetuosa de la privacidad

Instrumentar eventos agregados como `parcel_created`, `crop_confirmed`, `report_exported` y `alert_acknowledged`. Matomo o una instancia gestionada de analitica son opciones adecuadas si se requiere control de datos. No registrar coordenadas exactas ni nombres de parcelas en eventos.

### 8. Cache de clima por coordenada normalizada

El pronostico ya usa validacion de respuesta y cache de React Query. Para escalar, persistir en una tabla o cache server-side por coordenada redondeada, con TTL y marca de proveedor. Esto reduce solicitudes repetidas cuando muchos usuarios consultan la misma zona.

- **Referencia:** [Open-Meteo Forecast API](https://open-meteo.com/en/docs).

### 9. Integracion institucional

Evaluar exportaciones y conectores con asociaciones de productores, cooperativas o sistemas contables. El primer paso debe ser un contrato CSV versionado y un job de importacion con previsualizacion, validacion y rollback antes de una API bidireccional.

## Criterios para aprobar una nueva integracion

1. Tiene dueño funcional y técnico, costo estimado y alternativa manual.
2. Tiene timeout, reintentos acotados, cache y un estado visible cuando el proveedor falla.
3. No expone secretos al navegador ni mezcla datos de staging con producción.
4. Cuenta con fixture o prueba automatizada para el formato externo.
5. Tiene plan de baja: como desactivar la integracion sin bloquear parcelas, cultivos, inventario o reportes.
