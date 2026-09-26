# Manual de instalación y configuración

## Arquitectura
React 19/TanStack Start/Vite y Node.js para la aplicación; Supabase (Auth, PostgreSQL, RLS, Storage y funciones SQL) como backend. Render ejecuta el servicio. No se requiere NestJS/Prisma ni app móvil nativa.

## Requisitos
- Windows 10/11, macOS o Linux; Node **>=20.19**, npm, Git.
- Docker Desktop si usará Supabase local.
- Supabase CLI (`npx supabase`) y cuenta Supabase Cloud.
- Proyecto Render conectado al repositorio Git.

## Instalación local
```bash
git clone https://github.com/Dnaar26/agro-pathfinder-12.git
cd agro-pathfinder-12
npm install
cp .env.example .env # En PowerShell: Copy-Item .env.example .env
npx supabase start
npx supabase db reset
npm run dev
```
Abra `http://localhost:8080`.

## Variables
Copie `.env.example`. Requeridas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo servidor) y `APP_ALLOWED_ORIGINS`. Opcionales: `GEMINI_API_KEY`, `SENTINEL_INSTANCE_ID`, `SENTINEL_API_KEY`, `VITE_VAPID_PUBLIC_KEY`, Google OAuth. Nunca publique `.env` ni una service role con prefijo `VITE_`.

## Migraciones y cron
```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```
La migración `20260925030000_schedule_automatic_alerts.sql` instala/programa `pg_cron` para ejecutar `public.generate_automatic_alerts()` a las 07:00 UTC diariamente. Confirme que el proyecto permite `pg_cron`.

## Producción en Render
1. Cree un **Web Service** desde GitHub y rama `main`.
2. Configure Node 20+, Build Command `npm run build` y Start Command `npm start`.
3. Defina las variables anteriores en Render; `PORT` lo entrega Render, no lo fije.
4. En Supabase Auth configure Site URL/Redirect URLs con el dominio HTTPS de Render; agregue el mismo origen a `APP_ALLOWED_ORIGINS`.
5. Despliegue, revise logs y pruebe login, parcela, inventario y alertas.

## Servicios externos
Configure SMTP de Supabase para confirmación/recuperación, VAPID para push, Sentinel para NDVI y Gemini para el asistente, solo si se usan. Cree bucket privado `evidences` con MIME/limite adecuados si se cargan evidencias.
