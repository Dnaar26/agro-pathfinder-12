# ✅ SIGIC — Pre-Launch Checklist

> **Stack:** React + TanStack Start · Supabase (PostgreSQL + Auth + Storage) · Bun · Render / Vercel  
> Generado a partir de la auditoría de producción — septiembre 2026

---

## 🔴 Bloqueantes (resolver antes del deploy)

- [ ] **`has_role()` corregida** — Aplicar migración `20260921000000_fix_has_role.sql` en Supabase Cloud (`supabase db push`)
- [ ] **Ruta `/reset-password` creada** — ✅ Archivo `src/routes/reset-password.tsx` ya existe. Agregar `https://tu-dominio.com/reset-password` como Redirect URL en Supabase Dashboard → Authentication → URL Configuration
- [ ] **`APP_ALLOWED_ORIGINS` configurada** — En el dashboard de Render/Vercel, establecer el valor a la URL de producción exacta (ej: `https://sigic.onrender.com`). Sin esto el chat AI falla con error CSRF.

---

## 🟡 Importantes (resolver antes o justo después del deploy)

- [ ] **Variables de entorno en Render** — Configurar todas las variables marcadas como `sync: false` en `render.yaml`:
  - `SUPABASE_URL` → URL del proyecto Supabase Cloud
  - `VITE_SUPABASE_URL` → misma URL (para el cliente)
  - `SUPABASE_PUBLISHABLE_KEY` → anon key de Supabase
  - `VITE_SUPABASE_PUBLISHABLE_KEY` → misma key (para el cliente)
  - `SUPABASE_SERVICE_ROLE_KEY` → service role key (¡nunca exponer al cliente!)
  - `GROQ_API_KEY` → API key de Groq
  - `APP_ALLOWED_ORIGINS` → `https://tu-dominio.com`
  - `SENTINEL_INSTANCE_ID` → ID de instancia Sentinel Hub (opcional, para NDVI real)
  - `SENTINEL_API_KEY` → API key Sentinel Hub (opcional)
  - `VITE_VAPID_PUBLIC_KEY` → clave pública VAPID para push notifications (opcional)

- [ ] **Variables de entorno en Vercel** (si se despliega en Vercel en lugar de Render) — mismas variables anteriores

- [ ] **URLs de callback en Supabase Dashboard** — En Authentication → URL Configuration agregar:
  - `https://tu-dominio.com/auth`
  - `https://tu-dominio.com/dashboard`
  - `https://tu-dominio.com/reset-password`

- [ ] **Migraciones aplicadas en producción** — Ejecutar `supabase db push` o aplicar las 25 migraciones en el proyecto Supabase Cloud (incluida la nueva `20260921000000_fix_has_role.sql`)

- [ ] **Build local sin errores** — Ejecutar `npm run build` y verificar que no haya errores de TypeScript ni de linter antes del deploy

---

## 🟢 Buenas prácticas (verificar)

- [ ] **Datos de prueba eliminados** — Revisar `src/lib/services/seed-data.server.ts` y asegurarse de que no se ejecute automáticamente en producción
- [ ] **`console.log` de debug** — ✅ No hay `console.log` de debug en el código fuente (solo `console.error` legítimos en manejo de errores)
- [ ] **Sentry / APM activado** — `src/lib/services/error-monitoring.ts` tiene Sentry comentado. Considerar activarlo o conectar un servicio de monitoreo de errores en producción
- [ ] **`VITE_VAPID_PUBLIC_KEY` configurada** — Si se quieren push notifications activas, configurar la clave VAPID. Sin ella las notificaciones quedan silenciosamente desactivadas (no rompe la app)
- [ ] **Storage bucket `evidences` privado** — ✅ Configurado como privado con límite de 5 MB y solo tipos de imagen en la migración `20260920001000`
- [ ] **RLS habilitado en todas las tablas** — ✅ Verificado en auditoría: todas las tablas críticas tienen RLS activo con políticas granulares por operación
- [ ] **`SUPABASE_SERVICE_ROLE_KEY` nunca en el cliente** — ✅ Solo se usa en `client.server.ts` (archivo `.server.ts`, nunca llega al bundle del cliente)

---

## 🔧 Comandos útiles para el deploy

```bash
# Aplicar migraciones en Supabase Cloud
supabase db push

# Build de producción local (verificar antes de deploy)
npm run build

# Verificar tipos TypeScript
npx tsc --noEmit

# Ejecutar tests E2E
npx playwright test
```

---

## 📋 Resumen de archivos modificados en esta auditoría

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/20260921000000_fix_has_role.sql` | ✅ Nueva migración — corrige bug en `has_role()` |
| `src/routes/reset-password.tsx` | ✅ Nueva ruta — flujo completo de recuperación de contraseña |
| `src/routes/auth.tsx` | ✅ `redirectTo` corregido a `/reset-password` |
| `vercel.json` | ✅ Agregado `outputDirectory` y `rewrites` para TanStack Start |
| `src/lib/api/groq-chat.server.ts` | ✅ Warning explícito si `APP_ALLOWED_ORIGINS` no está configurado en producción |
| `postman/collections/SIGIC - Agro-Pathfinder API/` | ✅ Colección con 26 endpoints y test scripts en 12 requests |

---

*Última actualización: septiembre 2026 — Auditoría SIGIC v1.0*
