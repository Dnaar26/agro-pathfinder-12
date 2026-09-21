# Manual de Instalacion y Configuracion — SIGIC v1.0

> Alcance: SIGIC no es una pagina web estatica. Es un sitio web transnacional con frontend SSR, backend Supabase, almacenamiento, autenticacion, politicas RLS, integracion IA y configuracion operacional de servidor.

> Seguridad obligatoria: si alguna clave real fue incluida en `.env`, historial Git, capturas o despliegues previos, debe rotarse inmediatamente en Supabase y Groq antes de publicar el sitio.

> El despliegue de producción debe usar un dominio estable con HTTPS. No se considera producción un túnel temporal de Cloudflare ni una URL de desarrollo.

Este documento proporciona una guía exhaustiva y detallada para la instalación, configuración, ejecución y despliegue del Sistema de Información de Gestión Integral y Control (SIGIC). El manual está diseñado para desarrolladores, ingenieros de sistemas, administradores de bases de datos y personal de operaciones de TI que necesiten configurar el entorno local de desarrollo o desplegar el sistema en un entorno de producción seguro y escalable.

## Tabla de contenido

0. [Paso a paso de producción (Render + Supabase)](#0-paso-a-paso-de-producción-render--supabase)
1. [Arquitectura del sistema](#1-arquitectura-del-sistema)
2. [Prerrequisitos de instalación](#2-prerrequisitos-de-instalación)
3. [Instalación en entorno local (desarrollo)](#3-instalación-en-entorno-local-desarrollo)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Base de datos](#5-base-de-datos)
6. [Pruebas](#6-pruebas)
7. [Despliegue recomendado — Render + Supabase Cloud](#7-despliegue-recomendado--render--supabase-cloud)
8. [Dominio, HTTPS y operación transnacional](#8-dominio-https-y-operación-transnacional)
9. [Configuración de correo electrónico (Supabase SMTP)](#9-configuración-de-correo-electrónico-supabase-smtp)
10. [Solución de problemas comunes de instalación](#10-solución-de-problemas-comunes-de-instalación)
11. [Guía de actualización](#11-guía-de-actualización)
12. [Checklist de despliegue seguro](#12-checklist-de-despliegue-seguro)

---

## 0. Paso a paso de producción (Render + Supabase)

Siga este orden. El sitio no arranca si faltan las variables `VITE_*` **en el momento del build**.

### Paso 1 — Cuenta y proyecto Supabase

1. Cree un proyecto en [supabase.com](https://supabase.com/).
2. Guarde la contraseña de PostgreSQL.
3. En **Project Settings > API** copie:
   - Project URL → `VITE_SUPABASE_URL` y `SUPABASE_URL`
   - anon / publishable key → `VITE_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_PUBLISHABLE_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (solo servidor, nunca con prefijo `VITE_`)
4. En **Authentication > Providers** deje Email habilitado. En producción active **Confirm email**.
5. En **Authentication > URL Configuration**:
   - `Site URL`: la URL HTTPS de Render, por ejemplo `https://sigic.onrender.com`
   - `Redirect URLs`: `https://sigic.onrender.com/**` y, si tiene dominio propio, `https://su-dominio.com/**`

### Paso 2 — Migraciones y almacenamiento

En su máquina, con Node 20+ y el repositorio clonado:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

En **Storage** del panel de Supabase cree (si no existe) el bucket `evidences`:
- privado
- límite 5 MiB
- MIME: `image/png`, `image/jpeg`, `image/webp`, `image/gif`

### Paso 3 — Correo (obligatorio para registro real)

En **Project Settings > Authentication > SMTP** configure SendGrid, Resend, Mailgun o SES. Sin SMTP propio, los correos de confirmación se limitan o no llegan.

### Paso 4 — Groq (asistente IA)

Cree una API key en [console.groq.com](https://console.groq.com) y úsela solo como `GROQ_API_KEY` (sin `VITE_`).

### Paso 5 — Render

1. Suba este repositorio a GitHub (`https://github.com/Dnaar26/agro-pathfinder-12`).
2. En [render.com](https://render.com/) → **New > Blueprint** y seleccione `render.yaml`.
3. Complete las variables (`sync: false`):

| Variable | Valor |
| :--- | :--- |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key |
| `SUPABASE_URL` | igual que `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | igual que la anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role |
| `GROQ_API_KEY` | key de Groq |
| `APP_ALLOWED_ORIGINS` | `https://sigic.onrender.com` (y el dominio propio, separados por coma) |

Deje vacíos Sentinel, VAPID y Google si no los usa. **No** defina `SEED_TEST_PASSWORD` ni `SEED_ADMIN_PASSWORD` en producción.

4. Tras el primer deploy, copie la URL `https://<servicio>.onrender.com` y actualice Site URL, Redirect URLs y `APP_ALLOWED_ORIGINS`. Redeploy si cambió variables `VITE_*`.

### Paso 6 — Primer administrador

1. Cree una cuenta en `/auth` (contraseña: mínimo 8 caracteres, mayúscula, minúscula y número).
2. Confirme el correo.
3. En Supabase → **SQL Editor**:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'su-correo@dominio.com'
ON CONFLICT DO NOTHING;
```

Si el tipo de rol no es `app_role`, inspeccione la columna `role` en `public.user_roles` y use ese tipo.

### Paso 7 — Verificar

Abra la URL HTTPS y compruebe: landing, registro, login, parcelas, evidencias, reportes, chat IA e idiomas. El plan Free de Render se duerme; el primer request puede tardar unos segundos.

---

## 1. Arquitectura del sistema

SIGIC está diseñado bajo una arquitectura moderna centrada en el rendimiento, la escalabilidad y una experiencia de usuario fluida, utilizando Server-Side Rendering (SSR) híbrido con TanStack Start.

**Diagrama de Componentes ASCII:**

```text
+-----------------------------------------------------------------------------------+
|                                     CLIENTE                                       |
|  +----------------+    +------------------+    +-------------------------------+  |
|  |                |    |                  |    |                               |  |
|  |  Navegador Web +<-->+ React 19 / Vite  +<-->+ TanStack Router / Query (SSR) |  |
|  |                |    | TailwindCSS UI   |    | Gestión de Estado & Cache     |  |
|  +----------------+    +------------------+    +-------------------------------+  |
+---------+--------------------------+-------------------------------+--------------+
          |                          |                               |
          | (Renderizado SSR)        | (Llamadas API directas)       | (Autenticación)
          v                          v                               v
+---------+----------------+ +-------+--------------------+ +--------+--------------+
|       SERVIDOR           | |       BACKEND / BAAS       | |     SERVICIOS         |
|                          | |                            | |                       |
|  +--------------------+  | |  +----------------------+  | |  +-----------------+  |
|  |                    |  | |  |     Supabase         |  | |  | Groq API (LLM)  |  |
|  |  Motor Nitro.js    |  | |  | - PostgREST API      +<----> | AI y Analítica  |  |
|  |  (Node.js runtime) |  | |  | - Supabase Auth      |  | |  | Avanzada        |  |
|  |                    |  | |  | - Row Level Security |  | |  +-----------------+  |
|  +---------+----------+  | |  +----------+-----------+  | |                       |
|            |             | |             |              | |  +-----------------+  |
|            +-------------+->             v              | |  | Proveedor SMTP  |  |
|                          | |  +----------+-----------+  | |  | (SendGrid, AWS, |  |
|                          | |  |  PostgreSQL 15+      |  | |  | Resend, etc.)   |  |
|                          | |  |  (Base de Datos)     |  | |  +-----------------+  |
|                          | |  +----------------------+  | |                       |
+--------------------------+ +----------------------------+ +-----------------------+
```

### Componentes Principales:

*   **Frontend (Cliente):** Aplicación de página única (SPA) enriquecida con capacidades de renderizado en el servidor (SSR) mediante React 19 y TanStack Start. Utiliza TailwindCSS para el diseño responsivo e interfaces estilizadas de forma nativa.
*   **Motor de Compilación / Runtime (Servidor):** Vite 7 orquesta la compilación rápida y HMR durante el desarrollo. Nitro gestiona el proceso de build, generando un directorio `.output/` compatible con múltiples entornos de ejecución (Node.js nativo, Vercel, Netlify, Cloudflare, etc.).
*   **Backend (BaaS):** Supabase sirve como pilar de backend proporcionando una capa de API autogenerada (PostgREST) sobre PostgreSQL, junto con servicios vitales como Autenticación integrada (Supabase Auth) y almacenamiento en la nube.
*   **Base de datos:** PostgreSQL robusto, asegurado mediante políticas granulares de Seguridad a Nivel de Fila (Row Level Security - RLS).
*   **Integración de IA:** Consumo de la API de Groq para procesamiento de lenguaje natural y tareas analíticas dentro de la plataforma.

---

## 2. Prerrequisitos de instalación

Antes de proceder con la instalación de SIGIC, asegúrese de que la máquina de destino (desarrollo o servidor on-premise) cumple con los siguientes requisitos técnicos estrictos. La ausencia de alguno de estos componentes podría derivar en fallas de compilación o errores durante la ejecución.

### Herramientas y Lenguajes
*   **Node.js:** Versión 20.0.0 o superior (Se recomienda LTS v20.11+ o v22.x). Verificable con `node -v`.
*   **Gestor de paquetes:** npm 10.x o superior (incluido por defecto con Node.js 20+). Verificable con `npm -v`.
*   **Docker Desktop:** Requerido indispensablemente para el entorno de desarrollo local con Supabase. Versión 4.20.0 o superior. Debe estar en ejecución antes de iniciar los servicios.
*   **Git:** Versión 2.30.0 o superior, para el control de versiones y clonado del repositorio. Verificable con `git --version`.
*   **Supabase CLI:** Interfaz de línea de comandos de Supabase. (Instalable globalmente mediante `npm install -g supabase`).

### Sistemas Operativos Compatibles
El entorno de desarrollo es altamente compatible con múltiples plataformas, gracias al uso de tecnologías multiplataforma (Node.js y Docker):
*   **Windows:** Windows 10/11 con WSL2 (Windows Subsystem for Linux) instalado y configurado como backend por defecto para Docker Desktop.
*   **macOS:** macOS Monterey (12.0) o superior, compatible tanto con arquitecturas Intel (x86_64) como con Apple Silicon (M1/M2/M3).
*   **Linux:** Cualquier distribución moderna (Ubuntu 20.04+, Debian 11+, Fedora 36+, CentOS/RHEL 8+) con Docker Engine y Docker Compose v2 instalados.

### Hardware Recomendado para Desarrollo
*   **CPU:** 4 núcleos lógicos (mínimo).
*   **RAM:** 16 GB (Docker y Node.js requieren recursos considerables simultáneamente).
*   **Almacenamiento:** Mínimo 20 GB de espacio libre en disco SSD.

---

## 3. Instalación en entorno local (desarrollo)

Siga cuidadosamente estos pasos en orden secuencial para establecer un entorno de desarrollo funcional para SIGIC.

### 3.1. Clonar repositorio

Abra una terminal (en Windows se recomienda Git Bash, PowerShell o la terminal de WSL2; en macOS/Linux la terminal por defecto) y ejecute:

```bash
git clone https://github.com/Dnaar26/agro-pathfinder-12.git
cd agro-pathfinder-12
```

### 3.2. Instalar dependencias

Con Node.js y npm instalados, descargue las librerías requeridas. El uso de `--legacy-peer-deps` o similar no debería ser necesario si el archivo `package.json` está correctamente estructurado, pero téngalo en cuenta en caso de conflictos de versión con React 19.

```bash
# Instalación estándar
npm install
```

Este proceso descargará todas las dependencias en la carpeta `node_modules`, incluyendo Vite, React, TanStack, Tailwind, Playwright, y el cliente de Supabase.

### 3.3. Configurar Supabase local con Docker

SIGIC utiliza Supabase para su base de datos y autenticación. Para desarrollo, ejecutamos un stack completo de Supabase de manera local usando Docker.

Asegúrese de que Docker Desktop esté abierto y ejecutándose (el icono de la ballena debe estar verde o estático).

```bash
# Iniciar los contenedores locales de Supabase en segundo plano
npx supabase start
```

*Nota: La primera vez que ejecute este comando, Docker descargará múltiples imágenes pesadas (PostgreSQL, GoTrue, PostgREST, Realtime, Storage, Inbucket, etc.). Este proceso puede tardar varios minutos dependiendo de su ancho de banda.*

Una vez finalizado, la consola mostrará las URLs locales de los servicios, similares a estas (guarde esta información):
*   API URL: `http://127.0.0.1:54321`
*   GraphQL URL: `http://127.0.0.1:54321/graphql/v1`
*   DB URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
*   Studio URL: `http://127.0.0.1:54323` (Interfaz gráfica para administrar la BD)
*   Inbucket URL: `http://127.0.0.1:54324` (Para correos de prueba)
*   `anon key` y `service_role key`.

### 3.4. Variables de entorno (.env)

Cree el archivo de configuración copiando el ejemplo base:

```bash
# En Windows (PowerShell)
Copy-Item .env.example .env

# En Linux/macOS
cp .env.example .env
```

Edite el archivo `.env` utilizando su editor de código preferido (ej. VS Code). Rellénelo con las credenciales locales proporcionadas por el comando `supabase start`.

```env
# Ejemplo de .env local
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=ey... (tu anon key local generada por supabase start)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-solo-servidor>
GROQ_API_KEY=<groq-api-key-solo-servidor>
APP_ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
```

### 3.5. Ejecutar migraciones SQL

La estructura de la base de datos (tablas, funciones, políticas RLS, triggers) está definida en código dentro de la carpeta `supabase/migrations`. Para aplicarlas a su base de datos local recién iniciada:

```bash
# Ejecutar todas las migraciones SQL pendientes
npx supabase db reset
```

Si recibe una confirmación de éxito, su esquema de PostgreSQL ahora contiene todas las tablas necesarias para SIGIC (usuarios, roles, transacciones, etc.). Opcionalmente, puede inyectar datos semilla si están configurados en `supabase/seed.sql`.

### 3.6. Crear primer administrador

Para poder acceder al sistema con privilegios administrativos, deberá registrar el primer usuario o promover un usuario existente a administrador.

Opción recomendada:
1.  Inicie el servidor de desarrollo (paso siguiente).
2.  Navegue a `/auth` y cree una cuenta (contraseña de 8+ caracteres con mayúscula, minúscula y número).
3.  Abra Supabase Studio local (`http://127.0.0.1:54323`).
4.  En **SQL Editor** asigne el rol admin:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin@sgic.local'
ON CONFLICT DO NOTHING;
```

En Windows también puede usar `.\create-admin.ps1 -Password $env:SIGIC_ADMIN_PASSWORD` con `SUPABASE_PUBLISHABLE_KEY` definida.

### 3.7. Iniciar el servidor de desarrollo

Con todo configurado, inicie el servidor Vite y el compilador TanStack Start.

```bash
# Iniciar servidor local con Hot Module Replacement (HMR)
npm run dev
```

### 3.8. Verificar la instalación

1.  Abra `http://localhost:8080`. Si Vite informa otro puerto, use el de la terminal.
2.  Debería observar la pantalla de inicio de sesión o panel de SIGIC sin errores en la consola del navegador.
3.  Intente iniciar sesión con la cuenta creada en el paso 3.6.
4.  Si configuró el registro por correo electrónico, los correos de confirmación son interceptados localmente. Puede verlos ingresando a Inbucket en `http://127.0.0.1:54324`.

---

## 4. Variables de entorno

El sistema utiliza variables de entorno para gestionar la configuración que difiere entre entornos (Desarrollo, Staging, Producción) o que debe mantenerse secreta (claves API).

| Variable | Prefijo Vite | Obligatoria | Entorno | Descripción | Ejemplo |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Sí | Sí | Cliente/Servidor | URL base de la instancia de Supabase (Local o Producción). Necesaria para inicializar el cliente JS. | `https://xyzabc.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sí | Sí | Cliente/Servidor | Clave "anon" (anónima) pública de Supabase. Segura de exponer en el navegador. | `eyJhbGciOiJIUzI1NiIsInR5...` |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Si | Solo Servidor | Clave de acceso completo a la BD (omite RLS). **NUNCA DEBE LLEVAR EL PREFIJO VITE_**. Uso exclusivo en funciones SSR y API backend. | `<service-role-key>` |
| `GROQ_API_KEY` | No | Si | Solo Servidor | Credencial para el consumo de la API de LLMs de Groq. Debe permanecer secreta. | `<groq-api-key>` |
| `APP_ALLOWED_ORIGINS` | No | Si | Solo Servidor | Orígenes autorizados para el chat IA, separados por coma. En local use el puerto 8080. | `https://sigic.example.com` |
| `SENTINEL_INSTANCE_ID` | No | No | Solo Servidor | Identificador de configuración Sentinel Hub para NDVI. Nunca usar prefijo `VITE_`. | `<sentinel-instance>` |
| `SENTINEL_API_KEY` | No | No | Solo Servidor | Credencial Sentinel Hub para NDVI. Se consume exclusivamente desde SSR. | `<sentinel-api-key>` |
| `VITE_VAPID_PUBLIC_KEY` | No | No | Cliente | Clave pública para notificaciones push. No es un secreto privado. | `<vapid-public-key>` |
| `NODE_ENV` | No | No | Servidor | Define el entorno de ejecución (`development`, `production`, `test`). Automático en la mayoría de hosts. | `production` |
| `PORT` | No | No | Servidor | Puerto donde escuchará el servidor Node.js en producción. | `3000` |

---

## 5. Base de datos

SIGIC confía plenamente en PostgreSQL, administrado mediante Supabase, que nos provee una poderosa capa adicional de abstracción y seguridad en tiempo real.

### Estructura de tablas (Principales)

El esquema relacional `public` se compone de (pero no se limita a) las siguientes entidades clave:

1.  **`users` / `auth.users`:** (Gestionada por Supabase) Almacena identidades, emails y contraseñas cifradas.
2.  **`profiles` / `perfiles`:** Tabla vinculada a `auth.users` mediante UUID. Almacena nombres completos, avatares y roles de sistema.
3.  **`projects` / `proyectos`:** Entidad principal del sistema de gestión.
4.  **`tasks` / `tareas`:** Tareas asignadas dentro de un proyecto, enlazadas por llave foránea.
5.  **`logs` / `auditoria`:** Tabla de registro inmutable para acciones de administradores.

### Migraciones SQL

Como se mencionó, las migraciones se gestionan con la CLI de Supabase y aseguran que la base de datos mantenga el mismo estado en cualquier entorno.
*   Directorio: `supabase/migrations/`
*   Comando para crear una nueva migración vacía: `npx supabase migration new nombre_migracion`
*   Esto creará un archivo ej. `20240501120000_nombre_migracion.sql`. Usted debe escribir el SQL en dicho archivo.

### Políticas RLS (Row Level Security)

RLS es una característica crítica de PostgreSQL empleada de forma extensiva en SIGIC. En lugar de verificar los permisos en el backend de Node.js, las reglas de acceso se definen directamente en la base de datos.
*   **Default:** Cuando RLS está activado en una tabla (`ALTER TABLE tabla ENABLE ROW LEVEL SECURITY;`), el acceso predeterminado es DENEGADO para todos (salvo superusuarios y `service_role`).
*   **Políticas comunes:**
    *   *Lectura pública:* `CREATE POLICY "Permitir lectura a todos" ON perfiles FOR SELECT USING (true);`
    *   *Acceso propio:* `CREATE POLICY "Usuario modifica sus propios datos" ON perfiles FOR UPDATE USING (auth.uid() = id);`
    *   *Acceso admin:* Funciones de comprobación de rol que consultan si el JWT del usuario tiene claims específicos.

### Roles del sistema

SIGIC implementa un modelo RBAC (Role-Based Access Control) respaldado por la base de datos. Los roles comunes (y mapeados en la tabla perfiles o en claims del token JWT) son:
1.  **ADMINISTRADOR (Admin):** Acceso total de lectura y escritura al sistema, gestión de usuarios, auditoría.
2.  **GESTOR (Manager):** Puede crear, editar y eliminar proyectos a su cargo.
3.  **USUARIO (User):** Rol predeterminado. Puede ver proyectos asignados e interactuar con sus tareas y perfil propio.

---

## 6. Pruebas

Garantizar la calidad y robustez del código es primordial en SIGIC. El proyecto integra herramientas de análisis, compilación y pruebas automatizadas (End-to-End).

### Análisis estático

Detecta errores de sintaxis, inconsistencias de estilo y problemas potenciales sin ejecutar el código.

```bash
# Ejecutar ESLint en todos los archivos soportados (TS, JS, TSX)
npm run lint

# Opcional: Intentar reparar problemas automáticamente
npm run lint -- --fix
```

### Compilación (Build)

Comprobar que el código TypeScript sea válido y que Nitro pueda generar un empaquetado de producción exitoso.

```bash
# Iniciar el proceso de compilación para producción
npm run build
```
Si el código está libre de errores fatales, se generará la carpeta `.output/` (o la ruta especificada por la configuración de Vite/TanStack).

### Pruebas E2E (Playwright)

Las pruebas End-to-End simulan el comportamiento de un usuario real utilizando un navegador controlado.

1.  **Instalar navegadores de Playwright:** Esto solo es necesario una vez, o tras actualizar la dependencia de Playwright. Instala el motor Chromium (Google Chrome / Edge subyacente).
    ```bash
    npx playwright install chromium
    ```
2.  **Ejecutar pruebas E2E:** Asegúrese de que el entorno de desarrollo local (incluyendo Supabase) NO esté corriendo en un puerto que interfiera, o ajuste la configuración de Playwright para usar un puerto específico. Playwright iniciará su propio servidor de pruebas.
    ```bash
    npm run test:e2e
    ```
    Los reportes se generarán normalmente en una carpeta `playwright-report/` y los errores mostrarán un registro detallado en la terminal.

---

## 7. Despliegue recomendado — Render + Supabase Cloud

El proyecto usa SSR de TanStack Start/Nitro con preset `node-server`. El archivo `render.yaml` de la raíz automatiza esta configuración. Las variables `VITE_*` se incrustan en el cliente durante `npm run build`; si las cambia, debe redeployar.

### 7.1. Crear y preparar Supabase Cloud

1. Cree un proyecto en [Supabase](https://supabase.com/) y guarde la contraseña de PostgreSQL en un gestor seguro.
2. En **Project Settings > API**, copie la URL, la publishable/anon key y la service role key.
3. En la raíz del proyecto ejecute:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

4. En **Authentication > URL Configuration**, configure temporalmente la URL de Render como `Site URL`. Después de conectar el dominio definitivo, reemplácela por el dominio canónico HTTPS.

### 7.2. Crear el servicio Node en Render

1. Abra [Render](https://render.com/) y seleccione **New > Blueprint**.
2. Conecte el repositorio `https://github.com/Dnaar26/agro-pathfinder-12.git`.
3. Seleccione el archivo `render.yaml`. No configure `Root Directory`: el `package.json` está en la raíz del repositorio.
4. Render ejecutará `npm ci && npm run build` y arrancará con `npm start`.
5. Complete en Render todas las variables marcadas como `sync: false` en `render.yaml`. Nunca exponga `SUPABASE_SERVICE_ROLE_KEY` ni `GROQ_API_KEY` con prefijo `VITE_`.
6. Configure `APP_ALLOWED_ORIGINS` con la URL HTTPS de Render y, después, con el dominio definitivo separado por comas.

### 7.3. Verificación de producción

```bash
npm ci
npm run build
npm start
```

Compruebe la URL pública, el registro/login, recuperación de contraseña, lectura/escritura de parcelas, carga de evidencias, reportes, IA y cambio de idioma. El health check de Render usa `/`.

## 8. Dominio, HTTPS y operación transnacional

En Render agregue el dominio personalizado y cree en su proveedor DNS el registro indicado por Render. Espere a que Render emita el certificado TLS antes de publicar la URL. En Supabase Auth agregue el dominio canónico y cada subdominio regional autorizado en **Additional Redirect URLs**.

Para cada dominio permitido, actualice `APP_ALLOWED_ORIGINS` y pruebe login, logout, recuperación de contraseña, carga de archivos y funciones de IA. Configure SMTP propio, backups automáticos de Supabase, monitoreo de errores, rate limiting y una política de rotación de secretos.

---

## 9. Configuración de correo electrónico (Supabase SMTP)

Para sistemas en producción, no debe usar los correos de prueba de Supabase ni las plantillas por defecto (que tienen limitaciones estrictas de tasa por hora y pueden caer en spam).

Debe configurar su propio servidor SMTP comercial (SendGrid, Mailgun, AWS SES, Resend, etc.).

1.  Obtenga las credenciales SMTP de su proveedor (Host, Puerto, Usuario, Contraseña, Email remitente).
2.  En el panel de **Supabase Cloud**, navegue a **Project Settings -> Authentication -> SMTP Settings**.
3.  Habilite "Enable Custom SMTP".
4.  Complete los campos con la información de su proveedor de correo.
5.  En **Authentication -> Email Templates**, personalice los mensajes de "Confirm Signup", "Reset Password" y "Magic Link" para reflejar la marca de SIGIC. Guarde los cambios.

A partir de este momento, los registros y reseteos de contraseña enviarán correos reales a los usuarios a través del servidor SMTP designado.

---

## 12. Checklist de despliegue seguro para sitio web transnacional

SIGIC debe desplegarse como aplicacion web transnacional con servidor, base de datos, autenticacion, almacenamiento privado y controles operativos. Antes de publicar en internet, complete esta lista.

1. Rotar credenciales expuestas

Ejecute la rotacion en Supabase y Groq si alguna clave real estuvo en `.env`, repositorio, historial Git, capturas, logs o proveedor de hosting. Reemplace las variables en el servidor y nunca publique `SUPABASE_SERVICE_ROLE_KEY` ni `GROQ_API_KEY` con prefijo `VITE_`.

2. Configurar variables del servidor

En el proveedor de despliegue configure solo en entorno privado: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY` y `APP_ALLOWED_ORIGINS`. En el cliente solo deben existir `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

3. Configurar dominio transnacional

Defina el dominio publico final en Supabase Auth como `Site URL`. Agregue los dominios regionales o subdominios permitidos en `Additional Redirect URLs`, por ejemplo `https://sigic.example.com`, `https://co.sigic.example.com`, `https://pe.sigic.example.com`.

4. Activar seguridad de autenticacion

En Supabase Auth habilite confirmacion de correo, recuperacion de contrasena por SMTP, rotacion de refresh tokens, contrasena minima de 8 caracteres, rate limiting de login/registro y bloqueo de origenes no autorizados.

5. Validar RLS y roles

Ejecute todas las migraciones antes de publicar. Verifique que las tablas sensibles tengan RLS activo y que las operaciones administrativas dependan de `public.has_role(auth.uid(), 'admin')`, no solo de validaciones visuales del cliente.

6. Configurar almacenamiento privado

El bucket `evidences` debe ser privado, con limite de 5 MiB y MIME permitidos `image/png`, `image/jpeg`, `image/webp`, `image/gif`. La aplicacion valida firmas binarias antes de subir fotos, pero el servidor tambien debe rechazar tipos no permitidos.

7. Proteger server functions

Configure `APP_ALLOWED_ORIGINS` con el dominio publico real. Las funciones que usan Groq deben ejecutarse solo en servidor, exigir JWT valido y rechazar origenes no autorizados.

8. Operacion del servidor

Use HTTPS obligatorio, variables secretas del proveedor, logs sin tokens, backups de PostgreSQL, monitoreo de errores, actualizaciones periodicas de dependencias y revision de auditoria despues de cada despliegue.

9. Aplicar hardening de base de datos

Las migraciones `20260920002000_production_db_hardening.sql` y `20260920003000_rls_performance_and_external_secrets.sql` fijan `search_path`, restringen las funciones `SECURITY DEFINER`, optimizan las políticas RLS y mantienen `apply_inventory_movement` disponible para usuarios autenticados. Aplíquelas en staging antes de producción:

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

10. Validar perfiles de autorización

En staging, pruebe con cuentas `anon`, agricultor, técnico y administrador que cada perfil solo lea y modifique sus filas permitidas. No ejecute pruebas de acceso indebido con datos reales.

---

## 10. Solución de problemas comunes de instalación

Durante la configuración inicial y desarrollo, pueden surgir bloqueos comunes. Consulte las siguientes resoluciones:

*   **Error: `supabase command not found`**
    *   *Causa:* La CLI no está instalada o no está en la variable PATH del sistema.
    *   *Solución:* Instálela globalmente con npm (`npm i -g supabase`) o ejecute el comando siempre anteponiendo `npx` (ej. `npx supabase start`).
*   **Error iniciando Docker: Contenedores en colisión de puertos (ej. 5432)**
    *   *Causa:* Supabase local intenta vincular puertos que ya están en uso en su máquina (quizás un servidor PostgreSQL local existente en el puerto 5432 o un servidor web en 8000).
    *   *Solución:* Identifique y detenga el servicio en conflicto, o modifique el archivo `supabase/config.toml` (si se ha extraído) para cambiar los puertos locales de Supabase.
*   **El frontend falla con error de CORS al hacer llamadas a la API o Autenticación.**
    *   *Causa:* Las variables de entorno URL están mal escritas o el trailing slash (`/`) final está causando problemas.
    *   *Solución:* Verifique que `VITE_SUPABASE_URL` no contenga una barra diagonal al final (debe ser `http://127.0.0.1:54321`, no `http://127.0.0.1:54321/`).
*   **Las vistas no se actualizan localmente después de un cambio de código.**
    *   *Causa:* Vite / Nitro pueden tener una caché colgada, común tras cambios masivos en ramas git.
    *   *Solución:* Detenga el servidor de desarrollo (`Ctrl+C`), borre las carpetas `.vite` o `node_modules/.vite` y vuelva a ejecutar `npm run dev`.
*   **Acceso Denegado (403 Forbidden) al consultar datos en Supabase a pesar de estar logueado.**
    *   *Causa:* No se han ejecutado las migraciones SQL que contienen las políticas RLS, o el usuario no cumple las condiciones de la política.
    *   *Solución:* Asegúrese de haber ejecutado `npx supabase db reset`. Verifique las políticas de la tabla afectada en Supabase Studio.

---

## 11. Guía de actualización

El mantenimiento de SIGIC implica mantener las dependencias y la base de datos sincronizadas con el repositorio remoto.
Cuando otro desarrollador agrega características o modifica el esquema de la base de datos (nuevas migraciones SQL):

1.  **Sincronice el código remoto:**
    ```bash
    git pull origin main
    ```
2.  **Instale nuevas dependencias (si aplica):**
    ```bash
    npm install
    ```
3.  **Actualice su base de datos local:**
    No edite las tablas a mano. Aplique las nuevas migraciones que llegaron a través del `git pull`.
    ```bash
    # Para resetear e inyectar todas las migraciones limpiamente
    npx supabase db reset

    # O, si no quiere perder datos de desarrollo locales, y solo aplicar lo nuevo:
    npx supabase migration up
    ```
4.  Reinicie el servidor de desarrollo (`npm run dev`) si estaba activo durante el `npm install`.
