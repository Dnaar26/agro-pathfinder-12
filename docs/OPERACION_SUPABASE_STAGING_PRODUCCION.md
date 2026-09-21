# Operacion Supabase: local, staging y produccion

## Alcance

El proyecto usa migraciones versionadas en `supabase/migrations`. No se modifican filas de `supabase_migrations` manualmente y no se ejecutan `DROP`, `TRUNCATE` ni borrados masivos como parte del despliegue.

El proyecto de produccion configurado es `xgacqkakfaormeqaagkc`. El proyecto de staging debe ser independiente y no debe recibir una copia de datos personales reales.

## Primera inspeccion autenticada

La CLI debe autenticarse localmente o en CI mediante un token administrado por el usuario o GitHub Actions. El token no se guarda en el repositorio ni se comparte en tickets, logs o mensajes.

```bash
npx supabase login
npx supabase link --project-ref xgacqkakfaormeqaagkc
npx supabase db pull
npx supabase migration list
```

`db pull` puede generar una migracion de captura. Revisarla antes de incorporarla: debe representar cambios reales de esquema, RLS, policies, constraints, indices, funciones, triggers y grants. Si el proyecto remoto ya contiene cambios directos, esa migracion se conserva y se prueba localmente antes de hacer `db push`.

Para Advisors y logs, usar el panel de Supabase del proyecto autenticado. Registrar solo hallazgos y estados, nunca tokens, claves ni contraseñas. Revisar Postgres, Auth, PostgREST, Storage, Realtime y Functions. Si `main` muestra `FUNCTIONS_FAILED` pero no existen Edge Functions en el repositorio, comprobar en el panel si hay funciones remotas inesperadas y revisar el historial de despliegue antes de volver a desplegar.

## Validacion local

Requiere Docker Desktop iniciado:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

La prueba pgTAP está en `supabase/tests/database/security.sql`. Comprueba RLS, `search_path`, permisos mínimos de funciones y unicidad de roles. Estas pruebas se ejecutan en local o staging, nunca contra producción.

## Staging

Crear un proyecto Supabase separado y configurar en GitHub Actions el environment `staging` con estos secretos, sin escribir sus valores en archivos:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_STAGING_PROJECT_REF`
- `SUPABASE_STAGING_DB_PASSWORD`
- `STAGING_APP_URL`

El workflow `.github/workflows/staging.yml` se ejecuta con `develop`, aplica solo migraciones versionadas y lanza las pruebas E2E contra la aplicación de staging. Usar usuarios de prueba y storage de prueba.

## Produccion

Configurar el environment protegido `production` en GitHub con revisión obligatoria y estos secretos:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PRODUCTION_DB_PASSWORD`

El workflow `.github/workflows/production.yml` solo acepta `workflow_dispatch` cuando se escribe `DEPLOY`. La aprobación del environment debe ser realizada por la persona responsable después de revisar staging, Advisors, backups y el plan de rollback.

```bash
npx supabase db push
```

El workflow no ejecuta `db reset` contra producción y no elimina datos.

## Rollback y restauracion

Las migraciones se revierten con una nueva migración compensatoria, no editando migraciones ya aplicadas y no haciendo `db reset` en producción. Antes de cambios de alto riesgo:

1. Confirmar backup/PITR disponible en Supabase.
2. Anotar la migración y el commit desplegados.
3. Detener el workflow si falla una prueba o Advisor crítico.
4. Crear y revisar una migración compensatoria en staging.
5. Aplicarla a producción mediante el workflow protegido.
6. Restaurar desde backup/PITR solo con aprobación del responsable de producción.

## Estado actual de esta revisión

- Migraciones locales versionadas: 22.
- Edge Functions en el repositorio: ninguna.
- CLI Supabase local: 2.117.0.
- Acceso remoto: pendiente de sesión autenticada; no se ejecutaron `db pull`, Advisors, logs ni `db push` desde este entorno.
- Docker local: no disponible durante la revisión, por lo que `db reset` y `supabase test db` quedan pendientes.
