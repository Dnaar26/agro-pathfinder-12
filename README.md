# SIGIC — Sistema de Información de Gestión Integral y Control

Cuaderno de campo digital para pequeños agricultores: parcelas en mapa, cultivos, calendario de labores, inventario de insumos con alertas, trazabilidad con QR y asistente agronómico con IA. Tres roles: agricultor, técnico y administrador.

## Stack

React 19 · Vite 7 · TanStack Start (SSR) · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, RLS, Storage) · Groq (asistente IA) · Render / Vercel

## Arranque local

```bash
cp .env.example .env      # completa las claves de Supabase
npm ci
npm run dev               # http://localhost:8080
```

Requiere Node >= 20.19 (ver `.nvmrc`). Para una base local: `supabase start`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build de producción y servidor Node |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run test:e2e` | Pruebas Playwright |

## Variables de entorno

Ver `.env.example`. La clave del asistente IA es `GROQ_API_KEY` (o `GEMINI_API_KEY` como alternativa); solo se usa en el servidor.

## Diseño

Los tokens de color y tipografía viven en `src/styles.css` (OKLCH, modo claro y oscuro). Paleta: verde hoja del logo, banano (`--highlight`) para destacar y fondo niebla. Tipografías: Bricolage Grotesque (títulos) y Figtree (texto). El motivo de marca son los surcos de cultivo (`.surcos`, `.surcos-on-dark`).

## Documentación

Manuales, historias de usuario y operación en [`docs/`](docs/).
