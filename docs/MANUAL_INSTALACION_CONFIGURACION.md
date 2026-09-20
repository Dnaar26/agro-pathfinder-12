# Manual de Instalacion y Configuracion — SIGIC v1.0

> Alcance: SIGIC no es una pagina web estatica. Es un sitio web transnacional con frontend SSR, backend Supabase, almacenamiento, autenticacion, politicas RLS, integracion IA y configuracion operacional de servidor.

> Seguridad obligatoria: si alguna clave real fue incluida en `.env`, historial Git, capturas o despliegues previos, debe rotarse inmediatamente en Supabase y Groq antes de publicar el sitio.

> 🌐 **Despliegue Web Público Activo:** [https://occupation-suppliers-attribute-superintendent.trycloudflare.com](https://occupation-suppliers-attribute-superintendent.trycloudflare.com)  
> *Aplicación compilada y publicada mediante túnel HTTPS seguro Cloudflare Edge, accesible públicamente desde cualquier dispositivo conectado a internet.*

Este documento proporciona una guía exhaustiva y detallada para la instalación, configuración, ejecución y despliegue del Sistema de Información de Gestión Integral y Control (SIGIC). El manual está diseñado para desarrolladores, ingenieros de sistemas, administradores de bases de datos y personal de operaciones de TI que necesiten configurar el entorno local de desarrollo o desplegar el sistema en un entorno de producción seguro y escalable.

## Tabla de contenido

1. [Arquitectura del sistema](#1-arquitectura-del-sistema)
2. [Prerrequisitos de instalación](#2-prerrequisitos-de-instalación)
3. [Instalación en entorno local (desarrollo)](#3-instalación-en-entorno-local-desarrollo)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Base de datos](#5-base-de-datos)
6. [Pruebas](#6-pruebas)
7. [Despliegue en producción — Opción A: Netlify + Supabase Cloud (GRATUITO)](#7-despliegue-en-producción--opción-a-netlify--supabase-cloud-gratuito)
8. [Despliegue — Opción B: Render.com (SSR Node.js)](#8-despliegue--opción-b-rendercom-ssr-nodejs)
9. [Configuración de correo electrónico (Supabase SMTP)](#9-configuración-de-correo-electrónico-supabase-smtp)
10. [Solución de problemas comunes de instalación](#10-solución-de-problemas-comunes-de-instalación)
11. [Guía de actualización](#11-guía-de-actualización)

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
# Clonar el repositorio
git clone https://github.com/tu-organizacion/agro-pathfinder-12-main.git

# Ingresar al directorio del proyecto principal
cd agro-pathfinder-12-main/agro-pathfinder-12-main
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
APP_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
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
2.  Navegue a la pantalla de registro (`/register` o `/auth/signup`) y cree una cuenta nueva con su correo electrónico (ej. `admin@sigic.local`).
3.  Abra el panel de Supabase Studio local (`http://127.0.0.1:54323`).
4.  Navegue a la sección **Table Editor**, seleccione la tabla de usuarios (ej. `public.users` o la tabla de perfiles correspondiente a su esquema).
5.  Modifique la fila de su usuario recién creado y asigne el rol o bandera de administrador (ej. cambiando `role` a `'ADMIN'`).

Alternativamente, puede ejecutar una consulta SQL directa en Supabase Studio:
```sql
UPDATE public.perfiles SET rol = 'admin' WHERE email = 'admin@sigic.local';
```

### 3.7. Iniciar el servidor de desarrollo

Con todo configurado, inicie el servidor Vite y el compilador TanStack Start.

```bash
# Iniciar servidor local con Hot Module Replacement (HMR)
npm run dev
```

### 3.8. Verificar la instalación

1.  Abra su navegador web y navegue a `http://localhost:3000` (o el puerto que le indique la terminal, frecuentemente 5173 o 3000).
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
| `APP_ALLOWED_ORIGINS` | No | Si | Solo Servidor | Lista separada por comas de dominios autorizados para server functions sensibles. | `https://sigic.example.com` |
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

## 7. Despliegue en producción — Opción A: Netlify + Supabase Cloud (GRATUITO)

Esta es la opción más sencilla, recomendada para despliegues iniciales, pruebas de usuario (UAT) o entornos de staging, aprovechando los generosos planes gratuitos (Free Tiers) de Supabase Cloud y Netlify.

### Paso 1: Crear cuenta Supabase Cloud
1.  Navegue a [https://supabase.com/](https://supabase.com/).
2.  Regístrese usando su cuenta de GitHub o correo electrónico.

### Paso 2: Crear proyecto Supabase y obtener credenciales
1.  En el panel de control de Supabase, haga clic en "New Project".
2.  Seleccione su organización, elija un nombre para el proyecto (ej. "sigic-prod") y configure una contraseña de base de datos **extremadamente fuerte** (guárdela en un gestor de contraseñas, no se podrá recuperar de nuevo en texto plano).
3.  Seleccione la región de servidor más cercana a sus usuarios (ej. US East o São Paulo).
4.  Espere a que la base de datos se aprovisione (puede tardar un par de minutos).
5.  Vaya a **Project Settings -> API** para obtener la `URL` y las claves (`anon`, `service_role`).

### Paso 3: Aplicar migraciones en producción
Debe replicar su esquema de base de datos local en la nube de forma automatizada mediante la CLI.

```bash
# 1. Autenticar la CLI de Supabase (requiere token personal de acceso desde la web)
npx supabase login

# 2. Vincular su proyecto local con el proyecto en la nube
# (Encuentre el Reference ID en la URL de su proyecto en Supabase, ej. supabase.com/dashboard/project/abcdefghijk)
npx supabase link --project-ref <SU_REFERENCE_ID>

# Ingresará la contraseña de base de datos que creó en el Paso 2

# 3. Aplicar (push) todas las migraciones SQL al proyecto en la nube
npx supabase db push
```
La base de datos de producción ahora está estructurada correctamente.

### Paso 4: Configurar Auth (URL del sitio)
Para que los enlaces de autenticación, confirmación de correo y redirecciones funcionen:
1.  En Supabase Dashboard, vaya a **Authentication -> URL Configuration**.
2.  Defina la **Site URL** a la URL base de su frontend en producción (ej. `https://sigic.netlify.app`).
3.  Agregue comodines u otras URLs a los **Redirect URLs** si es necesario (ej. `https://sigic.netlify.app/**` y `http://localhost:3000/**` para permitir login desde desarrollo al entorno en la nube, aunque no es recomendado cruzar entornos).

### Paso 5: Crear cuenta Netlify
Navegue a [https://netlify.com/](https://netlify.com/) y regístrese con la misma cuenta de GitHub que aloja el código fuente de SIGIC.

### Paso 6: Conectar repositorio GitHub a Netlify
1.  En el panel de Netlify, haga clic en "Add new site" -> "Import an existing project".
2.  Seleccione "GitHub" y autorice el acceso.
3.  Busque el repositorio `agro-pathfinder-12-main` y selecciónelo.

### Paso 7: Configurar build settings en Netlify
Netlify detectará automáticamente que es un proyecto Node.js, pero debe especificar comandos precisos. Asegúrese de configurar:
*   **Base directory:** El directorio donde está su `package.json` principal (si el repo tiene múltiples carpetas, ponga `agro-pathfinder-12-main/agro-pathfinder-12-main`).
*   **Build command:** `npm run build`
*   **Publish directory:** El directorio estático generado por Nitro (usualmente `.output/public` o `dist` dependiendo de la configuración final de Vite/Nitro en este stack). *Revise su archivo de configuración de compilación local para verificar la ruta exacta. Si usa el preset de Netlify de Nitro, la salida suele ser directamente compatible sin configurar un Publish Dir explícito.*

### Paso 8: Configurar variables de entorno en Netlify
En la misma pantalla de configuración de despliegue, haga clic en "Add environment variables" e ingrese los datos obtenidos en el Paso 2 y sus claves privadas.
*   `VITE_SUPABASE_URL` = Su URL de proyecto de Supabase.
*   `VITE_SUPABASE_PUBLISHABLE_KEY` = Su anon key.
*   `SUPABASE_SERVICE_ROLE_KEY` = Su service_role key.
*   `GROQ_API_KEY` = Su clave de Groq.
*   `NODE_VERSION` = `20` (Variable interna de Netlify para forzar la versión de Node).

### Paso 9: Verificar despliegue
Haga clic en **Deploy site**.
Netlify iniciará el proceso de compilación (`npm install`, seguido de `npm run build`). Puede observar los logs en tiempo real.
Si es exitoso, Netlify le asignará una URL aleatoria que usted puede personalizar o apuntar a un dominio personalizado. Visite la URL y verifique el funcionamiento del sistema contra la base de datos de producción.

---

## 8. Despliegue — Opción B: Render.com (SSR Node.js)

Para implementaciones que requieran un control más exhaustivo del proceso de ejecución del servidor Node.js (por ejemplo, si usa características extensas de SSR, WebSockets intensivos, o procesamiento prolongado que choca con los límites de tiempo de funciones Serverless en Netlify), Render es una excelente alternativa.

### Pasos resumidos:
1.  Configure Supabase Cloud idéntico a la Opción A (Pasos 1 al 4).
2.  Cree cuenta en [Render.com](https://render.com/).
3.  Cree un nuevo **Web Service**.
4.  Conecte el repositorio de GitHub.
5.  Configuración del Web Service:
    *   **Root Directory:** `agro-pathfinder-12-main/agro-pathfinder-12-main`
    *   **Environment:** `Node`
    *   **Build Command:** `npm install && npm run build`
    *   **Start Command:** Dependiendo de Nitro. Generalmente es: `node .output/server/index.mjs` o `npm start` si existe en los scripts de su package.
6.  Agregue todas las variables de entorno detalladas en la Sección 4.
7.  Haga clic en **Create Web Service**. Render instalará, compilará y levantará el servidor Node.js exponiéndolo en el puerto necesario.

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
