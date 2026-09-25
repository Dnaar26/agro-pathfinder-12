# HISTORIAS DE USUARIO CON CRITERIOS DE ACEPTACIÓN
## SIGIC — Sistema de Información de Gestión Integral y Control
### Aplicación Web de Gestión Agrícola

---

**Proyecto:** SIGIC
**Versión del documento:** 1.0.0
**Fecha de elaboración:** 24 de septiembre de 2026
**Metodología:** Scrum / Desarrollo Ágil
**Estado:** Aprobado para desarrollo

---

## TABLA DE CONTENIDOS

1. [Introducción y Alcance](#1-introducción-y-alcance)
2. [Diagrama de Roles](#2-diagrama-de-roles)
3. [Tabla Resumen de Historias de Usuario](#3-tabla-resumen-de-historias-de-usuario)
4. [ÉPICA 1 — Autenticación y Acceso](#épica-1--autenticación-y-acceso)
5. [ÉPICA 2 — Gestión de Parcelas](#épica-2--gestión-de-parcelas)
6. [ÉPICA 3 — Gestión de Cultivos y Actividades](#épica-3--gestión-de-cultivos-y-actividades)
7. [ÉPICA 4 — Inventario](#épica-4--inventario)
8. [ÉPICA 5 — Alertas](#épica-5--alertas)
9. [ÉPICA 6 — Reportes](#épica-6--reportes)
10. [ÉPICA 7 — Administración](#épica-7--administración)
11. [Apéndice A — Story Points por Épica](#apéndice-a--story-points-por-épica)
12. [Apéndice B — Propuesta de Sprints](#apéndice-b--propuesta-de-sprints)
13. [Glosario](#glosario)

---

## 1. Introducción y Alcance

### 1.1 Propósito del Documento

El presente documento describe las **Historias de Usuario** del sistema SIGIC (*Sistema de Información de Gestión Integral y Control*), una aplicación web orientada a la gestión agrícola. Cada historia define, desde la perspectiva del usuario final, la funcionalidad esperada, acompañada de criterios de aceptación en formato **Dado/Cuando/Entonces** (Given/When/Then), requisitos funcionales y reglas de negocio derivadas.

### 1.2 Alcance del Sistema

| Módulo         | Descripción breve                                           |
|----------------|-------------------------------------------------------------|
| Autenticación  | Registro, inicio de sesión y recuperación de contraseña     |
| Parcelas       | Registro y visualización geoespacial de terrenos            |
| Cultivos       | Gestión de tipos de cultivo asociados a parcelas            |
| Actividades    | Bitácora de labores agrícolas por cultivo                   |
| Inventario     | Control de insumos con alertas de stock mínimo             |
| Alertas        | Notificaciones internas sobre eventos críticos              |
| Reportes       | Generación de informes en PDF, CSV y Excel                  |
| Mapa           | Visualización georreferenciada interactiva                  |
| Calendario     | Programación y seguimiento de actividades                   |
| Chat IA        | Asistente inteligente para recomendaciones agrícolas        |
| Administración | Gestión de usuarios, roles y configuración global           |

### 1.3 Stack Tecnológico

- **Frontend:** React 19 con Server-Side Rendering (SSR) — TanStack Start
- **Base de datos:** Supabase PostgreSQL con Row-Level Security (RLS)
- **Autenticación:** Supabase Auth (email/contraseña + OAuth Google)
- **Validación:** Zod (esquemas en cliente y servidor)
- **Pruebas:** Playwright (E2E)

---

## 2. Diagrama de Roles

```
┌─────────────────────────────────────────────────────────┐
│                    ROLES DEL SISTEMA                     │
├──────────────┬──────────────────┬───────────────────────┤
│  AGRICULTOR  │    TÉCNICO       │    ADMINISTRADOR       │
├──────────────┼──────────────────┼───────────────────────┤
│ • Sus parcelas│ • Todas las      │ • Acceso total         │
│ • Sus cultivos│   parcelas       │ • Panel admin          │
│ • Inventario │ • Todos los      │ • Gestión de usuarios  │
│ • Sus alertas│   cultivos       │ • Gestión de roles     │
│ • Reporte    │ • Inventario     │ • Auditoría del sistema│
│   simplificado│   completo      │ • Métricas globales    │
│ • Chat IA    │ • Crear alertas  │ • Crear alertas        │
│ • Calendario │   para cualquier │   para cualquier       │
│              │   agricultor     │   agricultor           │
│              │ • Reportes       │ • Reportes completos   │
│              │   completos      │                        │
└──────────────┴──────────────────┴───────────────────────┘
```

**Jerarquía de permisos:**
- El **Administrador** tiene todos los permisos del Técnico y del Agricultor.
- El **Técnico** tiene todos los permisos del Agricultor más supervisión de otros.
- El **Agricultor** solo accede a sus propios datos.

---

## 3. Tabla Resumen de Historias de Usuario

| ID     | Título                                          | Rol           | Prioridad | Story Points |
|--------|-------------------------------------------------|---------------|-----------|--------------|
| HU-001 | Registro de nuevo usuario                       | Agricultor    | Alta      | 3 SP         |
| HU-002 | Inicio de sesión                                | Todos         | Alta      | 2 SP         |
| HU-003 | Recuperación de contraseña                      | Todos         | Media     | 2 SP         |
| HU-004 | Crear parcela                                   | Agricultor    | Alta      | 3 SP         |
| HU-005 | Editar parcela                                  | Agricultor    | Alta      | 2 SP         |
| HU-006 | Eliminar parcela                                | Agricultor    | Media     | 2 SP         |
| HU-007 | Visualizar parcelas en mapa interactivo         | Agricultor    | Media     | 5 SP         |
| HU-008 | Registrar cultivo en parcela                    | Agricultor    | Alta      | 3 SP         |
| HU-009 | Filtrar y buscar cultivos                       | Agricultor    | Media     | 3 SP         |
| HU-010 | Registrar actividad agrícola en cultivo         | Agricultor    | Alta      | 5 SP         |
| HU-011 | Registrar costos de producción                  | Agricultor    | Alta      | 5 SP         |
| HU-012 | Registrar cosecha                               | Agricultor    | Alta      | 5 SP         |
| HU-013 | Gestionar inventario de insumos                 | Agricultor    | Alta      | 8 SP         |
| HU-014 | Recibir y gestionar alertas                     | Agricultor    | Alta      | 5 SP         |
| HU-015 | Crear alerta para agricultor                    | Técnico/Admin | Media     | 3 SP         |
| HU-016 | Generar reporte de actividades en PDF           | Técnico/Admin | Alta      | 8 SP         |
| HU-017 | Ver reporte simplificado (agricultor)           | Agricultor    | Alta      | 8 SP         |
| HU-018 | Exportar datos a CSV/Excel                      | Técnico/Admin | Media     | 5 SP         |
| HU-019 | Programar reporte automático por email          | Técnico/Admin | Media     | 8 SP         |
| HU-020 | Gestionar roles de usuarios                     | Admin         | Alta      | 5 SP         |

**Total: 20 historias — 102 Story Points**

---

## ÉPICA 1 — Autenticación y Acceso

---

### HU-001: Registro de nuevo usuario

**Épica:** Autenticación y Acceso
**Rol:** Como **agricultor nuevo**
**Quiero:** Registrarme en el sistema ingresando mis datos personales
**Para:** Acceder a las funcionalidades de gestión agrícola del sistema
**Prioridad:** Alta
**Estimación:** 3 Story Points

#### Criterios de Aceptación

**CA-001.1: Formulario de registro válido**
- **Dado** que el usuario navega a la pantalla `/auth` y selecciona la pestaña "Crear cuenta"
- **Cuando** ingresa nombre (mín. 2 caracteres), apellido (mín. 2 caracteres), teléfono (mín. 7 dígitos), correo electrónico válido y contraseña de al menos 8 caracteres
- **Entonces** el sistema crea la cuenta, envía un correo de confirmación si está habilitado, y redirige al dashboard

**CA-001.2: Validación de correo electrónico inválido**
- **Dado** que el usuario está en el formulario de registro
- **Cuando** ingresa un correo con formato incorrecto (ej. `usuario@` o `noescorreo`)
- **Entonces** el sistema muestra el mensaje "Correo electrónico inválido" sin enviar el formulario

**CA-001.3: Validación de contraseña débil**
- **Dado** que el usuario está en el formulario de registro
- **Cuando** ingresa una contraseña con menos de 8 caracteres
- **Entonces** el sistema muestra el mensaje "La contraseña debe tener al menos 8 caracteres"

**CA-001.4: Validación de nombre y apellido cortos**
- **Dado** que el usuario está en el formulario de registro
- **Cuando** ingresa un nombre o apellido con menos de 2 caracteres
- **Entonces** el sistema muestra el mensaje "Ingresa tu nombre (mínimo 2 caracteres)" o "Ingresa tu apellido (mínimo 2 caracteres)" según corresponda

**CA-001.5: Correo ya registrado**
- **Dado** que el usuario intenta registrarse con un correo que ya existe
- **Cuando** envía el formulario
- **Entonces** el sistema muestra un mensaje de error indicando que el correo ya está en uso

#### Requisitos Funcionales
- RF-001.1: El formulario de registro debe tener campos: nombre (max 60), apellido (max 60), teléfono (max 20), correo (max 180), contraseña (max 72)
- RF-001.2: La validación debe ejecutarse en tiempo real (al perder foco de cada campo)
- RF-001.3: La contraseña debe mostrarse u ocultarse mediante ícono de ojo
- RF-001.4: El sistema debe asignar automáticamente el rol "agricultor" al nuevo usuario

#### Reglas de Negocio
- RN-001.1: Ningún campo del formulario puede exceder su longitud máxima definida por el esquema Zod
- RN-001.2: El correo electrónico debe ser único en el sistema

---

### HU-002: Inicio de sesión

**Épica:** Autenticación y Acceso
**Rol:** Como **usuario registrado** (cualquier rol)
**Quiero:** Iniciar sesión con mis credenciales para acceder al sistema
**Para:** Gestionar mis parcelas, cultivos y demás funcionalidades según mi rol
**Prioridad:** Alta
**Estimación:** 2 Story Points

#### Criterios de Aceptación

**CA-002.1: Login exitoso**
- **Dado** que el usuario tiene una cuenta activa
- **Cuando** ingresa su correo y contraseña correctos y hace clic en "Entrar"
- **Entonces** el sistema autentica al usuario y lo redirige a `/dashboard`

**CA-002.2: Credenciales incorrectas**
- **Dado** que el usuario intenta iniciar sesión
- **Cuando** ingresa una contraseña incorrecta o un correo no registrado
- **Entonces** el sistema muestra un mensaje de error de autenticación sin revelar cuál dato es incorrecto

**CA-002.3: Protección de rutas**
- **Dado** que un usuario no autenticado intenta acceder a `/parcels`, `/dashboard` u otra ruta protegida
- **Cuando** el sistema verifica que no hay sesión activa
- **Entonces** redirige automáticamente a `/auth`

**CA-002.4: Sesión ya activa**
- **Dado** que el usuario ya tiene una sesión activa
- **Cuando** navega a `/auth`
- **Entonces** el sistema lo redirige automáticamente a `/dashboard`

#### Requisitos Funcionales
- RF-002.1: El formulario debe validar que el email no esté vacío y tenga formato válido
- RF-002.2: El botón de login debe mostrar un indicador de carga mientras se procesa
- RF-002.3: La sesión debe persistir entre refrescos de página

#### Reglas de Negocio
- RN-002.1: La sesión se gestiona mediante cookies HttpOnly seguras
- RN-002.2: Las rutas bajo `/_authenticated` requieren sesión válida

---

### HU-003: Recuperación de contraseña

**Épica:** Autenticación y Acceso
**Rol:** Como **usuario** que olvidó su contraseña
**Quiero:** Solicitar un enlace de recuperación por correo electrónico
**Para:** Recuperar el acceso a mi cuenta sin perder mis datos
**Prioridad:** Media
**Estimación:** 2 Story Points

#### Criterios de Aceptación

**CA-003.1: Solicitud de recuperación enviada**
- **Dado** que el usuario hace clic en "¿Olvidaste tu contraseña?"
- **Cuando** ingresa un correo registrado y confirma
- **Entonces** el sistema envía un correo con enlace de recuperación y muestra confirmación

**CA-003.2: Restablecimiento con nuevo enlace**
- **Dado** que el usuario recibe el correo de recuperación
- **Cuando** hace clic en el enlace y es redirigido a `/reset-password`
- **Entonces** puede ingresar y confirmar una nueva contraseña

**CA-003.3: Contraseña restablecida exitosamente**
- **Dado** que el usuario ingresó una nueva contraseña válida
- **Cuando** confirma el cambio
- **Entonces** el sistema actualiza la contraseña y redirige al dashboard

#### Requisitos Funcionales
- RF-003.1: El enlace de recuperación debe expirar en el tiempo configurado en Supabase Auth
- RF-003.2: La nueva contraseña debe cumplir las mismas reglas de la contraseña de registro

---

## ÉPICA 2 — Gestión de Parcelas

---

### HU-004: Crear parcela

**Épica:** Gestión de Parcelas
**Rol:** Como **agricultor**
**Quiero:** Registrar una nueva parcela con sus datos básicos y ubicación
**Para:** Organizar mis terrenos y asociarles cultivos
**Prioridad:** Alta
**Estimación:** 3 Story Points

#### Criterios de Aceptación

**CA-004.1: Creación exitosa de parcela**
- **Dado** que el agricultor está en la página `/parcels` y abre el diálogo "Nueva parcela"
- **Cuando** ingresa nombre (2-120 caracteres), área en m², tipo de suelo y hace clic en "Guardar"
- **Entonces** la parcela aparece en su lista y el sistema muestra notificación "Parcela creada"

**CA-004.2: Captura automática de GPS**
- **Dado** que el agricultor abre el formulario de nueva parcela
- **Cuando** hace clic en el botón de captura GPS
- **Entonces** el sistema obtiene la latitud y longitud del dispositivo y los completa automáticamente en los campos

**CA-004.3: Validación de nombre duplicado**
- **Dado** que el agricultor intenta crear una parcela
- **Cuando** ingresa un nombre ya utilizado
- **Entonces** el sistema muestra un error indicando el conflicto

**CA-004.4: Validación de área**
- **Dado** que el agricultor está creando una parcela
- **Cuando** ingresa un valor de área negativo, cero o mayor a 100,000,000 m²
- **Entonces** el sistema muestra mensaje de validación y no permite guardar

#### Requisitos Funcionales
- RF-004.1: Campos del formulario: nombre (requerido, max 120), área en m² (requerido, positivo), tipo de suelo (opcional, lista desplegable), latitud (-90 a 90), longitud (-180 a 180), notas (opcional, max 1000)
- RF-004.2: El GPS debe usar la API de geolocalización del navegador
- RF-004.3: La parcela debe asociarse automáticamente al usuario autenticado como propietario

#### Reglas de Negocio
- RN-004.1: Solo el propietario (o admin) puede ver y editar sus parcelas gracias a la política RLS de Supabase
- RN-004.2: El área debe expresarse en metros cuadrados

---

### HU-005: Editar parcela

**Épica:** Gestión de Parcelas
**Rol:** Como **agricultor**
**Quiero:** Modificar los datos de una parcela existente
**Para:** Mantener la información actualizada cuando cambian las condiciones
**Prioridad:** Alta
**Estimación:** 2 Story Points

#### Criterios de Aceptación

**CA-005.1: Edición exitosa**
- **Dado** que el agricultor selecciona la opción "Editar" en una parcela
- **Cuando** modifica uno o más campos y hace clic en "Guardar"
- **Entonces** los cambios se reflejan inmediatamente en la lista y el sistema muestra "Parcela actualizada"

**CA-005.2: Cancelar edición sin cambios**
- **Dado** que el agricultor abrió el diálogo de edición
- **Cuando** hace clic en "Cancelar" o cierra el diálogo
- **Entonces** no se aplica ningún cambio y la parcela mantiene sus datos anteriores

**CA-005.3: Validación en edición**
- **Dado** que el agricultor está editando una parcela
- **Cuando** borra el nombre o ingresa un área inválida
- **Entonces** el sistema muestra los mensajes de validación correspondientes sin guardar

#### Requisitos Funcionales
- RF-005.1: El formulario de edición debe pre-cargar todos los valores actuales de la parcela
- RF-005.2: Solo se deben enviar al servidor los campos modificados

---

### HU-006: Eliminar parcela

**Épica:** Gestión de Parcelas
**Rol:** Como **agricultor**
**Quiero:** Eliminar una parcela que ya no utilizo
**Para:** Mantener limpia mi lista de terrenos activos
**Prioridad:** Media
**Estimación:** 2 Story Points

#### Criterios de Aceptación

**CA-006.1: Confirmación antes de eliminar**
- **Dado** que el agricultor hace clic en "Eliminar" en el menú de una parcela
- **Cuando** aparece el diálogo de confirmación
- **Entonces** el sistema muestra un mensaje de advertencia y solicita confirmar antes de proceder

**CA-006.2: Eliminación exitosa**
- **Dado** que el agricultor confirmó la eliminación
- **Cuando** hace clic en "Confirmar"
- **Entonces** la parcela desaparece de la lista y el sistema muestra una notificación de éxito

**CA-006.3: Cancelar eliminación**
- **Dado** que el diálogo de confirmación está visible
- **Cuando** el agricultor hace clic en "Cancelar"
- **Entonces** el diálogo se cierra y la parcela permanece en el sistema

#### Reglas de Negocio
- RN-006.1: Si la parcela tiene cultivos activos asociados, el sistema debe advertir de ello antes de eliminar

---

### HU-007: Visualizar parcelas en mapa interactivo

**Épica:** Gestión de Parcelas
**Rol:** Como **agricultor**
**Quiero:** Ver mis parcelas en un mapa interactivo con su geolocalización
**Para:** Tener una vista espacial de mis terrenos y planificar mejor
**Prioridad:** Media
**Estimación:** 5 Story Points

#### Criterios de Aceptación

**CA-007.1: Mapa carga con marcadores de parcelas**
- **Dado** que el agricultor navega a `/mapa`
- **Cuando** el mapa carga completamente
- **Entonces** se muestran marcadores en las coordenadas de cada parcela registrada con latitud/longitud

**CA-007.2: Información al hacer clic en marcador**
- **Dado** que el mapa muestra las parcelas
- **Cuando** el agricultor hace clic en un marcador
- **Entonces** aparece un popup con el nombre de la parcela, área y tipo de suelo

**CA-007.3: Mapa sin coordenadas**
- **Dado** que una parcela no tiene latitud/longitud registrada
- **Cuando** el mapa carga
- **Entonces** esa parcela no aparece en el mapa (no genera error)

#### Requisitos Funcionales
- RF-007.1: El mapa debe usar Leaflet con tiles de OpenStreetMap
- RF-007.2: Debe soportar zoom, arrastre y controles de navegación estándar
- RF-007.3: Debe incluir visor NDVI satelital (Sentinel Hub) como capa opcional

---

## ÉPICA 3 — Gestión de Cultivos y Actividades

---

### HU-008: Registrar cultivo en parcela

**Épica:** Gestión de Cultivos y Actividades
**Rol:** Como **agricultor**
**Quiero:** Asociar un tipo de cultivo a una de mis parcelas con su fecha de siembra
**Para:** Llevar un registro organizado de qué cultivo tengo en cada terreno
**Prioridad:** Alta
**Estimación:** 3 Story Points

#### Criterios de Aceptación

**CA-008.1: Creación exitosa de cultivo**
- **Dado** que el agricultor está en `/cultivos` y abre el formulario "Nuevo cultivo"
- **Cuando** selecciona una parcela del listado, un tipo de cultivo del catálogo y una fecha de siembra
- **Entonces** el cultivo aparece en la lista con estado inicial y el sistema confirma la operación

**CA-008.2: Campos requeridos**
- **Dado** que el agricultor está creando un cultivo
- **Cuando** intenta guardar sin seleccionar parcela o tipo de cultivo
- **Entonces** el sistema muestra mensajes de error en los campos faltantes

**CA-008.3: Fecha de cosecha estimada**
- **Dado** que el agricultor ingresó la fecha de siembra
- **Cuando** el sistema calcula la duración estimada del cultivo
- **Entonces** muestra automáticamente una fecha estimada de cosecha

#### Requisitos Funcionales
- RF-008.1: El catálogo de tipos de cultivo es predefinido y administrado por el sistema
- RF-008.2: La fecha de siembra no puede ser futura (validación en cliente)
- RF-008.3: El cultivo inicia con estado "ACTIVO" por defecto

---

### HU-009: Filtrar y buscar cultivos

**Épica:** Gestión de Cultivos y Actividades
**Rol:** Como **agricultor**
**Quiero:** Buscar y filtrar mis cultivos por nombre, estado y parcela
**Para:** Encontrar rápidamente el cultivo que necesito gestionar
**Prioridad:** Media
**Estimación:** 3 Story Points

#### Criterios de Aceptación

**CA-009.1: Búsqueda por nombre**
- **Dado** que el agricultor está en la lista de cultivos
- **Cuando** escribe en el campo de búsqueda
- **Entonces** la lista se filtra en tiempo real mostrando solo los cultivos cuyo nombre coincide

**CA-009.2: Filtro por estado**
- **Dado** que el agricultor selecciona "Activos" en el filtro de estado
- **Cuando** el filtro se aplica
- **Entonces** solo se muestran cultivos con estados activos (PLANTADO, GERMINANDO, etc.)

**CA-009.3: Filtro por parcela**
- **Dado** que el agricultor selecciona una parcela específica en el filtro
- **Cuando** el filtro se aplica
- **Entonces** solo se muestran cultivos de esa parcela

**CA-009.4: Paginación**
- **Dado** que el agricultor tiene más de 25 cultivos
- **Cuando** navega por la lista
- **Entonces** el sistema muestra 25 cultivos por página con controles de navegación

#### Requisitos Funcionales
- RF-009.1: La búsqueda debe ser insensible a mayúsculas/minúsculas
- RF-009.2: Los filtros deben poder combinarse entre sí
- RF-009.3: Al cambiar cualquier filtro, la paginación regresa a la página 1

---

### HU-010: Registrar actividad agrícola en cultivo

**Épica:** Gestión de Cultivos y Actividades
**Rol:** Como **agricultor**
**Quiero:** Registrar las actividades que realizo en cada cultivo (riego, fertilización, cosecha, etc.)
**Para:** Llevar una bitácora completa que me ayude a tomar mejores decisiones
**Prioridad:** Alta
**Estimación:** 5 Story Points

#### Criterios de Aceptación

**CA-010.1: Registro exitoso de actividad**
- **Dado** que el agricultor está en el detalle de un cultivo (`/crops/:id`)
- **Cuando** selecciona el tipo de actividad, ingresa la fecha y opcionalmente notas
- **Entonces** la actividad queda registrada y aparece en el historial del cultivo

**CA-010.2: Tipos de actividad disponibles**
- **Dado** que el agricultor abre el formulario de nueva actividad
- **Cuando** despliega el selector de tipo
- **Entonces** ve las opciones: RIEGO, FERTILIZACION, MONITOREO, COSECHA, PODA, APLICACION, SIEMBRA

**CA-010.3: Subida de evidencia fotográfica**
- **Dado** que el agricultor está registrando una actividad
- **Cuando** adjunta una imagen (PNG, JPEG, WEBP o GIF, máx. 5 MiB)
- **Entonces** la imagen se guarda en el bucket "evidences" y se vincula a la actividad

**CA-010.4: Generación de código QR de trazabilidad**
- **Dado** que el cultivo tiene actividades registradas
- **Cuando** el agricultor accede a la sección de trazabilidad del cultivo
- **Entonces** puede ver y descargar un código QR que identifica el cultivo y su historial

#### Requisitos Funcionales
- RF-010.1: La fecha de actividad es obligatoria y no puede ser futura en más de 24 horas
- RF-010.2: Las notas son opcionales con máximo 1000 caracteres
- RF-010.3: Las actividades deben mostrarse en orden cronológico descendente

---

### HU-011: Registrar costos de producción

**Épica:** Gestión de Cultivos y Actividades
**Rol:** Como **agricultor**
**Quiero:** Registrar los costos asociados a cada cultivo (insumos, mano de obra, etc.)
**Para:** Calcular la rentabilidad real de mi producción
**Prioridad:** Alta
**Estimación:** 5 Story Points

#### Criterios de Aceptación

**CA-011.1: Registro de costo**
- **Dado** que el agricultor está en el detalle de un cultivo
- **Cuando** agrega un costo con tipo, descripción, cantidad y precio unitario
- **Entonces** el total se calcula automáticamente y el costo aparece en el resumen financiero

**CA-011.2: Cálculo automático del total**
- **Dado** que el agricultor ingresa cantidad y precio unitario
- **Cuando** el sistema procesa los datos
- **Entonces** calcula automáticamente `total = cantidad × precio_unitario`

**CA-011.3: Suma acumulada de costos**
- **Dado** que el cultivo tiene múltiples costos registrados
- **Cuando** el agricultor ve el resumen del cultivo
- **Entonces** ve el costo total acumulado y el desglose por tipo de costo

#### Requisitos Funcionales
- RF-011.1: Tipos de costo disponibles: INSUMOS, MANO_OBRA, MAQUINARIA, TRANSPORTE, OTROS
- RF-011.2: Cantidad y precio unitario deben ser valores numéricos positivos

---

### HU-012: Registrar cosecha

**Épica:** Gestión de Cultivos y Actividades
**Rol:** Como **agricultor**
**Quiero:** Registrar cada cosecha con cantidad obtenida, precio de venta y fecha
**Para:** Calcular los ingresos y la rentabilidad de cada temporada
**Prioridad:** Alta
**Estimación:** 5 Story Points

#### Criterios de Aceptación

**CA-012.1: Registro exitoso de cosecha**
- **Dado** que el agricultor está en el detalle de un cultivo
- **Cuando** registra la cantidad cosechada, unidad (kg, ton, cajas), precio por unidad y fecha
- **Entonces** el total de ingresos se calcula automáticamente y aparece en el resumen

**CA-012.2: Cálculo de ingreso total**
- **Dado** que el agricultor ingresa cantidad y precio de venta por unidad
- **Cuando** el sistema procesa el registro
- **Entonces** calcula `total_revenue = cantidad × precio_unitario`

**CA-012.3: Rentabilidad visible**
- **Dado** que el cultivo tiene costos y cosechas registradas
- **Cuando** el agricultor consulta el resumen financiero
- **Entonces** ve: costo total, ingreso total, margen bruto y porcentaje de rentabilidad

---

## ÉPICA 4 — Inventario

---

### HU-013: Gestionar inventario de insumos

**Épica:** Inventario
**Rol:** Como **agricultor**
**Quiero:** Registrar y controlar mis insumos agrícolas con stock mínimo y alertas
**Para:** Nunca quedarme sin insumos críticos en momentos clave del cultivo
**Prioridad:** Alta
**Estimación:** 8 Story Points

#### Criterios de Aceptación

**CA-013.1: Registro de insumo nuevo**
- **Dado** que el agricultor navega a `/inventory`
- **Cuando** agrega un nuevo insumo con nombre, categoría, cantidad actual y stock mínimo
- **Entonces** el insumo aparece en la lista con su estado de stock

**CA-013.2: Alerta de stock mínimo**
- **Dado** que un insumo tiene cantidad actual menor o igual al stock mínimo configurado
- **Cuando** el agricultor ve la lista de inventario
- **Entonces** el insumo se resalta visualmente con un indicador de "Stock bajo"

**CA-013.3: Movimientos de inventario**
- **Dado** que el agricultor registra una entrada o salida de insumo
- **Cuando** confirma el movimiento
- **Entonces** la cantidad se actualiza automáticamente y el sistema verifica que el stock no quede negativo

**CA-013.4: Vista de técnico/admin**
- **Dado** que un técnico o administrador accede al inventario
- **Cuando** selecciona un agricultor específico del selector
- **Entonces** ve el inventario de ese agricultor particular

#### Requisitos Funcionales
- RF-013.1: Los movimientos de inventario se registran en un log de auditoría
- RF-013.2: El sistema debe validar que una salida no resulte en stock negativo
- RF-013.3: El técnico y el admin pueden ver el inventario de cualquier agricultor

#### Reglas de Negocio
- RN-013.1: La validación de stock no negativo se realiza en el servidor mediante RPC seguro
- RN-013.2: Los agricultores solo ven y modifican su propio inventario (política RLS)

---

## ÉPICA 5 — Alertas

---

### HU-014: Recibir y gestionar alertas

**Épica:** Alertas
**Rol:** Como **agricultor**
**Quiero:** Ver las alertas que me han enviado y gestionar su estado
**Para:** Actuar oportunamente ante situaciones que requieren mi atención
**Prioridad:** Alta
**Estimación:** 5 Story Points

#### Criterios de Aceptación

**CA-014.1: Lista de alertas pendientes**
- **Dado** que el agricultor navega a `/alerts`
- **Cuando** la página carga
- **Entonces** ve una lista separada de alertas PENDIENTES e HISTORIAL (resueltas/descartadas)

**CA-014.2: Marcar alerta como resuelta**
- **Dado** que el agricultor tiene una alerta pendiente
- **Cuando** hace clic en el ícono de "check" (marcar como resuelta)
- **Entonces** la alerta se mueve a la sección de historial con estado RESUELTA

**CA-014.3: Descartar alerta**
- **Dado** que el agricultor tiene una alerta pendiente que no le aplica
- **Cuando** hace clic en descartar
- **Entonces** la alerta se mueve al historial con estado DESCARTADA

**CA-014.4: Contador de alertas en el menú**
- **Dado** que el agricultor tiene alertas pendientes
- **Cuando** navega por cualquier sección del sistema
- **Entonces** el menú lateral muestra el número de alertas pendientes como badge

#### Requisitos Funcionales
- RF-014.1: Las alertas se actualizan automáticamente cada 30 segundos
- RF-014.2: Las alertas tienen tipos predefinidos: RIEGO, FERTILIZACION, PODA, MONITOREO, CLIMA, PLAGA, COSECHA

---

### HU-015: Crear alerta para agricultor

**Épica:** Alertas
**Rol:** Como **técnico o administrador**
**Quiero:** Crear alertas personalizadas para agricultores específicos
**Para:** Notificarlos sobre acciones necesarias en sus cultivos
**Prioridad:** Media
**Estimación:** 3 Story Points

#### Criterios de Aceptación

**CA-015.1: Creación de alerta para otro usuario**
- **Dado** que el técnico está en la página de alertas y tiene rol "tecnico" o "admin"
- **Cuando** selecciona un agricultor del listado, elige el tipo de alerta, ingresa título y cuerpo
- **Entonces** la alerta aparece en la bandeja del agricultor destinatario

**CA-015.2: Alerta para sí mismo**
- **Dado** que cualquier usuario (incluido agricultor) está en la página de alertas
- **Cuando** crea una alerta sin seleccionar destinatario específico
- **Entonces** la alerta se crea para su propia cuenta

**CA-015.3: Título obligatorio**
- **Dado** que el usuario está creando una alerta
- **Cuando** intenta guardar sin título
- **Entonces** el sistema muestra el error "El título es obligatorio"

#### Requisitos Funcionales
- RF-015.1: El selector de agricultor solo es visible para técnicos y administradores
- RF-015.2: El título es obligatorio; el cuerpo es opcional

---

## ÉPICA 6 — Reportes

---

### HU-016: Generar reporte de actividades en PDF

**Épica:** Reportes
**Rol:** Como **técnico o administrador**
**Quiero:** Generar un reporte PDF de la bitácora de actividades con filtros aplicables
**Para:** Documentar y presentar el historial de trabajo agrícola
**Prioridad:** Alta
**Estimación:** 8 Story Points

#### Criterios de Aceptación

**CA-016.1: Generación de PDF con filtros**
- **Dado** que el técnico está en `/reports` y selecciona plantilla "Bitácora de actividades"
- **Cuando** aplica filtros de parcela, cultivo y rango de fechas, y hace clic en "Generar PDF"
- **Entonces** se descarga un archivo PDF con las actividades filtradas, encabezado institucional y tabla de resumen

**CA-016.2: Validación de rango de fechas**
- **Dado** que el técnico ingresa filtros de fecha
- **Cuando** la fecha "Desde" es mayor que la fecha "Hasta"
- **Entonces** el sistema muestra el mensaje "La fecha 'Desde' no puede ser mayor que 'Hasta'" y deshabilita el botón de generar

**CA-016.3: Tres plantillas disponibles**
- **Dado** que el técnico accede a la sección de reportes
- **Cuando** despliega el selector de plantilla
- **Entonces** ve tres opciones: "Bitácora de actividades", "Inventario de parcelas", "Resumen ejecutivo"

**CA-016.4: Indicadores de KPI en el reporte**
- **Dado** que el técnico genera el "Resumen ejecutivo"
- **Cuando** el PDF se descarga
- **Entonces** incluye: total parcelas, actividades del periodo, alertas pendientes, costo total, ingreso total y margen bruto

#### Requisitos Funcionales
- RF-016.1: El PDF debe generarse en el cliente usando jsPDF + jspdf-autotable
- RF-016.2: El nombre del archivo debe incluir plantilla y fecha: `sigic-actividades-20260924-1430.pdf`
- RF-016.3: El autor del reporte (email) debe aparecer en el encabezado del PDF

---

### HU-017: Ver reporte simplificado para agricultores

**Épica:** Reportes
**Rol:** Como **agricultor**
**Quiero:** Ver un reporte visual de mis cultivos, costos, cosechas y análisis IA
**Para:** Entender el desempeño de mi finca en un formato claro y accesible
**Prioridad:** Alta
**Estimación:** 8 Story Points

#### Criterios de Aceptación

**CA-017.1: Vista diferenciada para agricultores**
- **Dado** que el agricultor (sin rol técnico o admin) navega a `/reports`
- **Cuando** la página carga
- **Entonces** ve el FarmerReport en lugar del panel técnico complejo

**CA-017.2: Pestañas del reporte agricultor**
- **Dado** que el agricultor está en su reporte
- **Cuando** navega entre pestañas
- **Entonces** puede ver: Resumen, Mis Cultivos, Financiero, Cosechas, Alertas

**CA-017.3: Análisis IA**
- **Dado** que el agricultor tiene datos registrados
- **Cuando** hace clic en "Generar análisis con IA"
- **Entonces** el sistema consulta a la IA (Groq) y muestra recomendaciones personalizadas basadas en sus cultivos, costos y alertas

**CA-017.4: Exportar a PDF**
- **Dado** que el agricultor está en su reporte
- **Cuando** hace clic en "Exportar PDF"
- **Entonces** se descarga un PDF con su resumen de producción

#### Requisitos Funcionales
- RF-017.1: El FarmerReport solo carga datos del agricultor autenticado (RLS)
- RF-017.2: El análisis IA es opcional y debe funcionar aunque falle la conexión con Groq

---

### HU-018: Exportar datos a CSV/Excel

**Épica:** Reportes
**Rol:** Como **técnico o administrador**
**Quiero:** Exportar los datos de actividades y parcelas a formatos CSV y Excel
**Para:** Analizarlos en herramientas externas como Excel o Google Sheets
**Prioridad:** Media
**Estimación:** 5 Story Points

#### Criterios de Aceptación

**CA-018.1: Exportar actividades a CSV**
- **Dado** que el técnico está en la sección de reportes con plantilla "Bitácora de actividades"
- **Cuando** hace clic en "Exportar CSV"
- **Entonces** se descarga un archivo .csv con las columnas: fecha, tipo, cultivo, parcela, notas

**CA-018.2: Exportar parcelas a Excel**
- **Dado** que el técnico selecciona plantilla "Inventario de parcelas"
- **Cuando** hace clic en "Exportar Excel"
- **Entonces** se descarga un archivo en formato compatible con Excel con datos de todas las parcelas

**CA-018.3: CSV con codificación UTF-8 BOM**
- **Dado** que el archivo CSV se descarga
- **Cuando** el usuario lo abre en Excel
- **Entonces** los caracteres especiales del español se muestran correctamente (BOM UTF-8 incluido)

#### Requisitos Funcionales
- RF-018.1: El botón de exportar CSV solo está activo cuando la plantilla seleccionada es "Bitácora de actividades"
- RF-018.2: El botón de exportar Excel solo está activo cuando la plantilla es "Inventario de parcelas"

---

### HU-019: Programar reporte automático por email

**Épica:** Reportes
**Rol:** Como **técnico o administrador**
**Quiero:** Programar el envío automático de reportes por correo electrónico
**Para:** Recibir actualizaciones periódicas sin tener que generarlas manualmente
**Prioridad:** Media
**Estimación:** 8 Story Points

#### Criterios de Aceptación

**CA-019.1: Crear reporte programado**
- **Dado** que el técnico está en la sección "Reportes programados"
- **Cuando** hace clic en "Nuevo", selecciona plantilla, ingresa destinatarios (separados por coma) y frecuencia
- **Entonces** el reporte programado aparece en la lista con estado activo

**CA-019.2: Frecuencias disponibles**
- **Dado** que el técnico está creando un reporte programado
- **Cuando** despliega el selector de frecuencia
- **Entonces** ve las opciones: Diario, Semanal, Mensual

**CA-019.3: Habilitar y deshabilitar**
- **Dado** que existe un reporte programado
- **Cuando** el técnico hace clic en el ícono de estado
- **Entonces** alterna entre habilitado (verde) y deshabilitado (gris)

**CA-019.4: Eliminar reporte programado**
- **Dado** que el técnico hace clic en el ícono de papelera de un reporte programado
- **Cuando** confirma la acción
- **Entonces** el reporte programado se elimina de la lista

#### Requisitos Funcionales
- RF-019.1: Los destinatarios deben ser correos válidos separados por coma
- RF-019.2: El campo de destinatarios es requerido; sin él no se puede guardar

---

## ÉPICA 7 — Administración

---

### HU-020: Gestionar roles de usuarios

**Épica:** Administración
**Rol:** Como **administrador**
**Quiero:** Asignar y revocar roles a los usuarios del sistema
**Para:** Controlar los niveles de acceso de cada persona según su función
**Prioridad:** Alta
**Estimación:** 5 Story Points

#### Criterios de Aceptación

**CA-020.1: Ver lista de usuarios con roles**
- **Dado** que el administrador navega a `/admin`
- **Cuando** la página carga
- **Entonces** ve la lista de todos los usuarios con sus roles actuales (agricultor, técnico, admin)

**CA-020.2: Asignar rol**
- **Dado** que el administrador selecciona un usuario
- **Cuando** asigna un nuevo rol desde el selector
- **Entonces** el rol se aplica inmediatamente y el usuario obtiene los permisos correspondientes

**CA-020.3: Revocar rol**
- **Dado** que el administrador selecciona un usuario con rol asignado
- **Cuando** hace clic en el botón de eliminar rol (X)
- **Entonces** el rol se revoca y el usuario pierde los permisos asociados

**CA-020.4: Protección de acceso al panel admin**
- **Dado** que un usuario sin rol "admin" intenta acceder a `/admin`
- **Cuando** el sistema verifica su rol
- **Entonces** redirige automáticamente a `/dashboard`

**CA-020.5: Búsqueda de usuarios**
- **Dado** que el administrador está en el panel de administración
- **Cuando** escribe en el campo de búsqueda
- **Entonces** la lista de usuarios se filtra mostrando solo los que coinciden con el texto buscado

#### Requisitos Funcionales
- RF-020.1: Los roles disponibles son: agricultor, técnico, admin
- RF-020.2: El mismo usuario puede tener múltiples roles simultáneamente
- RF-020.3: La lista de usuarios debe paginarse a 20 por página

#### Reglas de Negocio
- RN-020.1: Un administrador no puede revocar su propio rol de admin
- RN-020.2: Los cambios de roles se registran en el log de auditoría

---

## Apéndice A — Story Points por Épica

| Épica                           | Historias | Story Points | % del total |
|---------------------------------|-----------|--------------|-------------|
| ÉPICA 1 — Autenticación         | 3         | 7 SP         | 6.9%        |
| ÉPICA 2 — Parcelas              | 4         | 12 SP        | 11.8%       |
| ÉPICA 3 — Cultivos/Actividades  | 5         | 21 SP        | 20.6%       |
| ÉPICA 4 — Inventario            | 1         | 8 SP         | 7.8%        |
| ÉPICA 5 — Alertas               | 2         | 8 SP         | 7.8%        |
| ÉPICA 6 — Reportes              | 4         | 29 SP        | 28.4%       |
| ÉPICA 7 — Administración        | 1         | 5 SP         | 4.9%        |
| **TOTAL**                       | **20**    | **90 SP**    | **100%**    |

---

## Apéndice B — Propuesta de Sprints

| Sprint | Historias incluidas                              | SP    | Objetivo del Sprint                                        |
|--------|--------------------------------------------------|-------|------------------------------------------------------------|
| 1      | HU-001, HU-002, HU-003, HU-004, HU-005           | 17 SP | Autenticación completa + CRUD básico de parcelas           |
| 2      | HU-006, HU-007, HU-008, HU-009, HU-010           | 18 SP | Completar parcelas + Cultivos y bitácora de actividades    |
| 3      | HU-011, HU-012, HU-013, HU-014                   | 21 SP | Costos, cosechas, inventario y alertas                     |
| 4      | HU-015, HU-016, HU-017, HU-018, HU-020           | 29 SP | Alertas, reportes PDF/CSV y administración                 |
| 5      | HU-019 + refinamiento                            | 8 SP  | Reportes automáticos, deuda técnica y pruebas finales      |

---

## Glosario

| Término         | Definición                                                              |
|-----------------|-------------------------------------------------------------------------|
| Agricultor      | Usuario final que gestiona sus propias parcelas y cultivos              |
| Técnico         | Profesional agronómico que supervisa varios agricultores                |
| Administrador   | Usuario con acceso total al sistema y gestión de usuarios               |
| Parcela         | Terreno agrícola registrado con área, tipo de suelo y coordenadas GPS   |
| Cultivo         | Asociación entre un tipo de planta y una parcela en un período          |
| Actividad       | Labor agrícola registrada en un cultivo (riego, fertilización, etc.)    |
| Stock mínimo    | Cantidad mínima de un insumo por debajo de la cual se genera alerta     |
| RLS             | Row-Level Security — política de seguridad a nivel de fila en Supabase  |
| SP              | Story Points — unidad relativa de esfuerzo en metodología ágil          |
| Épica           | Conjunto de historias de usuario relacionadas por módulo o funcionalidad|
| SSR             | Server-Side Rendering — renderizado del lado del servidor               |
| PDF             | Portable Document Format — formato de reporte descargable               |
| KPI             | Key Performance Indicator — indicador clave de desempeño                |
| QR              | Código QR de trazabilidad vinculado a un cultivo específico             |
| NDVI            | Normalized Difference Vegetation Index — índice de salud vegetal        |

---

*Documento elaborado para el proyecto SIGIC — Versión 1.0.0*
*Metodología: Scrum | Todos los Story Points son estimaciones preliminares sujetas a revisión del equipo.*
