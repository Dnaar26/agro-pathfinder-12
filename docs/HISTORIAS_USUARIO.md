# HISTORIAS DE USUARIO - SIGIC (Sistema Inteligente de Gestión y Seguimiento de Cultivos)

## 1. Introducción
El proyecto **SIGIC** (Sistema Inteligente de Gestión y Seguimiento de Cultivos) es una aplicación web agrícola moderna construida utilizando React 19, TanStack (Query, Router, Table) en el frontend, y Supabase (PostgreSQL) como Backend-as-a-Service (BaaS). Su objetivo principal es facilitar y optimizar la administración de explotaciones agrícolas, proveyendo herramientas avanzadas para la gestión de parcelas, cultivos, inventario de insumos, programación de labores agrícolas, emisión de alertas y análisis de datos. 

Este documento consolida y estandariza los requerimientos ágiles del sistema mediante Historias de Usuario (HU) detalladas, estableciendo un contrato claro entre los stakeholders y el equipo de desarrollo. Se detallan aspectos fundamentales como el modelo de dominio, reglas de negocio y requisitos no funcionales que guiarán la arquitectura del sistema.

### 1.1 Modelo de Dominio (Entidades Principales)

| Entidad | Descripción | Relaciones Principales |
|---------|-------------|------------------------|
| **Usuario (User)** | Representa a cualquier actor que interactúa con el sistema (Agricultor, Técnico, Admin). Gestionado mediante Supabase Auth. | 1:N con Perfil, 1:N con Parcela, 1:N con Actividad, 1:N con Auditoría |
| **Rol (Role)** | Define los permisos y el nivel de acceso en la plataforma. | N:M con Usuario |
| **Parcela (Plot)** | Unidad básica de tierra destinada al cultivo. Tiene geometría (polígono), área, ubicación y estado. | N:1 con Usuario (Propietario), 1:N con Cultivo |
| **Cultivo (Crop)** | Plantación específica dentro de una parcela. Contiene especie, variedad, fecha de siembra, estado de desarrollo y rendimiento estimado. | N:1 con Parcela, 1:N con Actividad |
| **Insumo (Item/Inventory)** | Producto físico utilizado en la explotación agrícola (fertilizantes, pesticidas, semillas, herramientas). | 1:N con MovimientoInventario, 1:N con UsoEnActividad |
| **Actividad (Activity)** | Transacción principal del sistema. Registro de un evento o labor agrícola (riego, fertilización, poda, cosecha) sobre un cultivo. | N:1 con Cultivo, N:1 con Usuario, N:M con Insumo (Uso) |
| **Alerta (Alert)** | Notificación automática o manual sobre condiciones climáticas, plagas, bajo stock o eventos críticos. | N:1 con Parcela/Cultivo, N:1 con Usuario |

---

## 2. Stakeholders

El éxito de SIGIC depende de la satisfacción de las necesidades de múltiples actores involucrados en el ciclo agrícola. Los principales stakeholders identificados son:

1. **Agricultores / Productores (Propietarios)**
   - **Rol en el sistema:** `Agricultor`
   - **Descripción:** Son los dueños o arrendatarios de las tierras. Su principal interés es maximizar la rentabilidad, monitorear el progreso de sus cultivos, llevar un control riguroso de costos (inventario) y tener visibilidad completa de las actividades realizadas en sus parcelas.
   - **Necesidades clave:** Facilidad de uso, acceso a datos en tiempo real, reportes claros.

2. **Técnicos Agrícolas / Agrónomos**
   - **Rol en el sistema:** `Técnico`
   - **Descripción:** Profesionales encargados de la supervisión, diagnóstico y recomendación de labores agrícolas. Asesoran a los agricultores.
   - **Necesidades clave:** Capacidad para registrar monitoreos, recetar fertilizantes o pesticidas, analizar históricos de cultivos y establecer alertas tempranas de plagas.

3. **Administradores del Sistema**
   - **Rol en el sistema:** `Admin`
   - **Descripción:** Personal de soporte IT o gestores de la plataforma.
   - **Necesidades clave:** Gestión de usuarios y roles, configuración del sistema, monitorización de auditoría, soporte técnico y mantenimiento de catálogos maestros.

4. **Usuarios Finales Indirectos (Inversionistas, Cooperativas)**
   - **Descripción:** Entidades que financian o compran la producción.
   - **Necesidades clave:** Reportes de trazabilidad, certificaciones de buenas prácticas agrícolas derivadas de la bitácora de actividades.

---

## 3. Requisitos No Funcionales

1. **Rendimiento (Performance):**
   - El tiempo de carga inicial de la aplicación no debe superar los 2.5 segundos (LCP) en redes 4G.
   - Las consultas a la base de datos (Supabase) deben responder en menos de 300ms en el 95% de los casos.
   - La generación de reportes en PDF/CSV no debe bloquear la interfaz de usuario y debe completarse en menos de 10 segundos para volúmenes estándar de datos.

2. **Seguridad (Security):**
   - Implementación estricta de RLS (Row Level Security) en PostgreSQL para garantizar que un agricultor solo pueda leer, modificar y borrar datos de sus propias parcelas y cultivos.
   - Todas las conexiones deben realizarse a través de HTTPS/TLS 1.2 o superior.
   - Las contraseñas deben estar encriptadas utilizando bcrypt (gestionado por Supabase Auth).
   - Prevención contra ataques CSRF y XSS incorporada en el framework React 19.

3. **Disponibilidad (Availability):**
   - El sistema debe ofrecer un uptime del 99.9% (excluyendo ventanas de mantenimiento programadas y anunciadas).
   - Soporte offline básico: La aplicación debe utilizar PWA y Service Workers (integrados con TanStack Query) para mostrar datos cacheados en caso de pérdida momentánea de conexión.

4. **Usabilidad (Usability):**
   - Diseño Mobile-First: La interfaz debe ser completamente responsiva, priorizando la usabilidad en dispositivos móviles (tablets y smartphones), dado que los técnicos y agricultores operan frecuentemente en el campo.
   - Interfaz limpia, accesible (cumplimiento WCAG 2.1 AA) e intuitiva para usuarios con baja alfabetización digital.

5. **Compatibilidad (Compatibility):**
   - Soporte completo para los navegadores modernos: Chrome (últimas 3 versiones), Safari (iOS/macOS últimas 2 versiones), Firefox y Edge.
   - Sistema operativo agnóstico (Windows, macOS, Android, iOS) mediante su naturaleza de Web App.

---

## 4. Reglas de Negocio

Las reglas de negocio dictan la lógica central que garantiza la consistencia de los datos agrícolas.

- **RN-01 (Stock no negativo):** Ninguna transacción de actividad agrícola que implique el consumo de un insumo (ej. fertilización) puede dejar el inventario de dicho insumo en números negativos. Si no hay suficiente stock, la transacción debe ser rechazada.
- **RN-02 (RLS y Aislamiento de Datos):** Un usuario con rol `Agricultor` o `Técnico` únicamente puede visualizar y gestionar información (parcelas, cultivos, inventario) que le pertenezca o a la cual haya sido explícitamente invitado. El rol `Admin` tiene acceso global de solo lectura y acceso completo de escritura a configuraciones, pero no debe alterar registros agrícolas directamente.
- **RN-03 (Cronología Lógica):** La fecha de cosecha de un cultivo debe ser obligatoriamente posterior a su fecha de siembra. Una actividad no puede registrarse con fechas futuras, a menos que sea un evento programado en el calendario de labores (estado "Pendiente").
- **RN-04 (Estado del Cultivo):** Un cultivo que se marca como "Cosechado" o "Perdido" pasa a un estado inactivo (histórico) y no puede recibir nuevas actividades, a excepción de notas aclaratorias.
- **RN-05 (Unicidad de Parcelas):** Dentro de la cuenta de un agricultor, no pueden existir dos parcelas activas con el mismo nombre o identificador legal.
- **RN-06 (Alertas Críticas):** Toda alerta catalogada con prioridad "Alta" (ej. Riesgo inminente de helada, plaga agresiva) debe generar una notificación push (si está habilitada) y un registro en la auditoría del sistema, exigiendo una acción de "Acuse de recibo" por parte del agricultor.

---

## 5. Historias de Usuario

A continuación se detallan las 10 historias de usuario principales, cubriendo el flujo completo o "Happy Path" y casos alternativos del sistema SIGIC.

### HU-01: Autenticación y registro
- **ID:** HU-01
- **Título:** Autenticación y registro seguro de usuarios
- **Rol:** Usuario (Cualquiera)
- **Historia:** Como usuario no autenticado, quiero poder registrarme, iniciar sesión y recuperar mi contraseña, para poder acceder de forma segura a mi espacio de trabajo en SIGIC.
- **Prioridad:** Alta
- **Estimación:** 8 Story Points
- **Requisitos funcionales vinculados:** 
  - RF-01.1: Registro con email y contraseña.
  - RF-01.2: Inicio de sesión con JWT gestionado por Supabase.
  - RF-01.3: Asignación de rol por defecto (Agricultor).
- **Criterios de Aceptación:**
  - **Escenario 1: Registro exitoso**
    - **Given** que estoy en la página de registro
    - **When** ingreso un correo válido, una contraseña fuerte y confirmo la contraseña
    - **And** presiono "Registrarse"
    - **Then** el sistema debe crear mi cuenta en Supabase
    - **And** enviarme un correo de confirmación
    - **And** mostrar un mensaje indicando que verifique mi bandeja de entrada.
  - **Escenario 2: Inicio de sesión con credenciales correctas**
    - **Given** que tengo una cuenta activa y verificada
    - **When** ingreso mi correo electrónico y contraseña en la pantalla de login
    - **Then** el sistema debe autenticarme exitosamente
    - **And** redirigirme al Dashboard principal de mi rol.
  - **Escenario 3: Inicio de sesión con contraseña incorrecta**
    - **Given** que soy un usuario registrado
    - **When** intento iniciar sesión con una contraseña que no coincide con mis registros
    - **Then** el sistema debe denegar el acceso
    - **And** mostrar un mensaje de error claro "Credenciales inválidas, por favor intente nuevamente."

---

### HU-02: Gestión de parcelas
- **ID:** HU-02
- **Título:** Creación y gestión de parcelas agrícolas
- **Rol:** Agricultor
- **Historia:** Como agricultor, quiero registrar, visualizar, editar y eliminar mis parcelas, para tener un mapa digital y un inventario físico de mis áreas de trabajo.
- **Prioridad:** Alta
- **Estimación:** 13 Story Points
- **Requisitos funcionales vinculados:** 
  - RF-02.1: CRUD completo de tabla Parcelas.
  - RF-02.2: Georreferenciación básica (polígono en mapa).
  - RF-02.3: Cálculo automático de hectáreas.
- **Criterios de Aceptación:**
  - **Escenario 1: Creación de una nueva parcela exitosa**
    - **Given** que estoy autenticado como Agricultor en la vista "Mis Parcelas"
    - **When** hago clic en "Nueva Parcela"
    - **And** completo el formulario con el nombre, tipo de suelo y trazo un polígono en el mapa
    - **Then** el sistema debe calcular el área automáticamente
    - **And** al guardar, debe reflejarse en la lista y en la vista de Mapa.
  - **Escenario 2: Edición de parcela existente**
    - **Given** que tengo al menos una parcela registrada
    - **When** selecciono la opción "Editar" en una parcela específica
    - **And** modifico su nombre y guardo los cambios
    - **Then** el sistema debe actualizar la información en la base de datos
    - **And** mostrar el mensaje "Parcela actualizada con éxito".
  - **Escenario 3: Intentar borrar una parcela con cultivos activos**
    - **Given** que intento eliminar una parcela
    - **When** la parcela tiene cultivos en estado "Activo" asociados a ella
    - **Then** el sistema debe impedir la eliminación
    - **And** mostrar un mensaje de advertencia indicando que primero debo finalizar o trasladar los cultivos asociados.

---

### HU-03: Gestión de cultivos
- **ID:** HU-03
- **Título:** Administración del ciclo de vida de cultivos
- **Rol:** Agricultor / Técnico
- **Historia:** Como agricultor o técnico, quiero registrar cultivos dentro de mis parcelas y llevar seguimiento de su desarrollo, para conocer qué está sembrado, cuándo se sembró y su expectativa de cosecha.
- **Prioridad:** Alta
- **Estimación:** 13 Story Points
- **Requisitos funcionales vinculados:** 
  - RF-03.1: CRUD de cultivos.
  - RF-03.2: Asociación de cultivo a parcela.
  - RF-03.3: Control de estados (Sembrado, En crecimiento, Cosechado, Perdido).
- **Criterios de Aceptación:**
  - **Escenario 1: Registro de un nuevo cultivo**
    - **Given** que he seleccionado una parcela vacía o con espacio disponible
    - **When** registro un nuevo cultivo indicando especie (ej. Maíz), variedad, fecha de siembra y rendimiento esperado
    - **Then** el sistema debe guardar el cultivo en estado "Sembrado"
    - **And** vincularlo correctamente a la parcela seleccionada.
  - **Escenario 2: Cambio de estado del cultivo a Cosechado**
    - **Given** que tengo un cultivo en estado "En crecimiento"
    - **When** edito el estado a "Cosechado" indicando la fecha de fin y la producción total
    - **Then** el sistema debe marcar el cultivo como histórico (inactivo)
    - **And** dejar la parcela disponible para un nuevo ciclo de siembra.
  - **Escenario 3: Validación de fechas lógicas**
    - **Given** que estoy registrando o editando un cultivo
    - **When** intento ingresar una fecha de cosecha estimada que es anterior a la fecha de siembra
    - **Then** el sistema debe mostrar un error de validación
    - **And** no permitir guardar el registro hasta que la fecha sea corregida.

---

### HU-04: Control de inventario
- **ID:** HU-04
- **Título:** Gestión del inventario de insumos
- **Rol:** Agricultor
- **Historia:** Como agricultor, quiero registrar entradas y salidas de insumos (fertilizantes, semillas, etc.), para mantener un control exacto de mis existencias y prever compras.
- **Prioridad:** Media
- **Estimación:** 8 Story Points
- **Requisitos funcionales vinculados:** 
  - RF-04.1: Catálogo de insumos.
  - RF-04.2: Registro de movimientos (Kardex).
  - RF-04.3: Alertas de stock mínimo.
- **Criterios de Aceptación:**
  - **Escenario 1: Ingreso de nuevo stock (Compra)**
    - **Given** que estoy en el módulo de Inventario
    - **When** registro un movimiento de entrada especificando el insumo "Urea", cantidad "50 kg" y costo unitario
    - **Then** el sistema debe aumentar el stock disponible en 50 unidades
    - **And** registrar el movimiento en el historial del inventario.
  - **Escenario 2: Prevención de stock negativo (Regla RN-01)**
    - **Given** que el insumo "Pesticida X" tiene un stock de 5 litros
    - **When** intento registrar una salida manual de 10 litros
    - **Then** el sistema debe denegar la operación
    - **And** mostrar un error "Stock insuficiente. Stock actual: 5 litros".
  - **Escenario 3: Visualización de bajo stock**
    - **Given** que he configurado un stock mínimo de 10 unidades para "Semilla Y"
    - **When** el stock disponible cae a 8 unidades
    - **Then** el sistema debe mostrar el insumo resaltado en rojo en el listado
    - **And** generar una alerta en el sistema de alertas.

---

### HU-05: Agenda y calendario de labores
- **ID:** HU-05
- **Título:** Programación de labores en calendario interactivo
- **Rol:** Agricultor / Técnico
- **Historia:** Como agricultor o técnico, quiero visualizar una agenda en formato calendario con las labores planificadas, para organizar mejor el trabajo diario y de los operarios.
- **Prioridad:** Media
- **Estimación:** 8 Story Points
- **Requisitos funcionales vinculados:** 
  - RF-05.1: Vista tipo calendario (mes, semana, día).
  - RF-05.2: Creación de eventos (actividades planificadas).
  - RF-05.3: Integración de colores por tipo de actividad.
- **Criterios de Aceptación:**
  - **Escenario 1: Visualización mensual de labores**
    - **Given** que accedo a la sección "Calendario"
    - **When** la página carga por completo
    - **Then** debo ver una vista mensual del mes actual
    - **And** observar las actividades planificadas marcadas en el calendario según su fecha asignada.
  - **Escenario 2: Creación de labor desde el calendario**
    - **Given** que estoy viendo el calendario
    - **When** hago clic en un día específico (ej. 15 del mes actual)
    - **Then** debe abrirse un modal para programar una actividad con la fecha pre-rellenada
    - **And** al guardar, el evento debe aparecer inmediatamente en ese día.
  - **Escenario 3: Reprogramación por Drag-and-Drop**
    - **Given** que tengo una actividad programada en el calendario
    - **When** arrastro el evento con el mouse hacia un día diferente
    - **Then** el sistema debe actualizar la fecha de la actividad en la base de datos automáticamente
    - **And** notificar del cambio exitoso.

---

### HU-06: Sistema de alertas
- **ID:** HU-06
- **Título:** Generación y gestión de notificaciones y alertas
- **Rol:** Agricultor
- **Historia:** Como agricultor, quiero recibir notificaciones sobre riesgos en mis parcelas (clima adverso, bajo stock, plagas reportadas), para poder tomar medidas preventivas a tiempo.
- **Prioridad:** Media
- **Estimación:** 8 Story Points
- **Requisitos funcionales vinculados:** 
  - RF-06.1: Centro de notificaciones.
  - RF-06.2: Alertas automáticas desde el sistema.
  - RF-06.3: Marcado de notificaciones como leídas/no leídas.
- **Criterios de Aceptación:**
  - **Escenario 1: Recepción de alerta por bajo inventario**
    - **Given** que un insumo alcanza su límite mínimo definido
    - **When** inicio sesión o navego en la plataforma
    - **Then** debo ver el ícono de la campana con un indicador numérico (badge)
    - **And** al desplegar, debe aparecer el mensaje detallando el insumo con bajo stock.
  - **Escenario 2: Marcar notificaciones como leídas**
    - **Given** que tengo el panel de notificaciones abierto con alertas no leídas (en negrita)
    - **When** hago clic en el botón "Marcar todas como leídas"
    - **Then** el contador de notificaciones debe desaparecer
    - **And** los mensajes deben cambiar a formato de lectura normal en la interfaz.
  - **Escenario 3: Historial de alertas**
    - **Given** que estoy en la pantalla principal de "Alertas"
    - **When** filtro por estado "Resueltas"
    - **Then** el sistema debe mostrar un histórico paginado de todas las advertencias anteriores para análisis posterior.

---

### HU-07: Registro de actividad agrícola (Transacción principal)
- **ID:** HU-07
- **Título:** Registro detallado de actividades y labores de campo
- **Rol:** Agricultor / Técnico
- **Historia:** Como usuario del campo, quiero registrar una labor agrícola ejecutada (riego, fertilización, poda) especificando la parcela, el cultivo, los insumos utilizados y observaciones, para mantener la bitácora técnica al día.
- **Prioridad:** Alta
- **Estimación:** 21 Story Points (Transacción central)
- **Requisitos funcionales vinculados:** 
  - RF-07.1: Formulario transaccional de actividad.
  - RF-07.2: Descuento automático de inventario al reportar consumo de insumos.
  - RF-07.3: Inclusión de evidencias (fotos).
- **Criterios de Aceptación:**
  - **Escenario 1: Registro de actividad sin insumos (Ej. Poda)**
    - **Given** que estoy en la vista del Cultivo de Aguacate
    - **When** registro una nueva actividad de tipo "Poda", asigno una fecha pasada o actual, y añado comentarios
    - **And** la guardo
    - **Then** la actividad debe aparecer en el historial del cultivo
    - **And** el estado del cultivo no se ve afectado.
  - **Escenario 2: Registro de actividad con consumo de insumo (Ej. Fertilización)**
    - **Given** que registro una actividad de tipo "Fertilización"
    - **When** selecciono el insumo "Fertilizante NPK" e indico que usé "20 kg"
    - **And** confirmo la acción
    - **Then** la actividad se guarda exitosamente
    - **And** el sistema debe descontar automáticamente 20 kg del inventario de "Fertilizante NPK".
  - **Escenario 3: Registro de monitoreo de plagas con evidencia fotográfica**
    - **Given** que estoy registrando una actividad de tipo "Monitoreo"
    - **When** adjunto un archivo de imagen (JPEG/PNG) mostrando la hoja dañada
    - **And** guardo el registro
    - **Then** la imagen debe subirse a Supabase Storage
    - **And** en el detalle de la actividad debe mostrarse la imagen adjunta.

---

### HU-08: Reportes y exportación
- **ID:** HU-08
- **Título:** Generación de reportes PDF y CSV
- **Rol:** Agricultor / Técnico
- **Historia:** Como agricultor, quiero generar reportes exportables de mi bitácora de actividades y del inventario actual, para poder compartirlos con auditores, compradores o para mi propio archivo contable.
- **Prioridad:** Media
- **Estimación:** 13 Story Points
- **Requisitos funcionales vinculados:** 
  - RF-08.1: Reporte "Bitácora de actividades".
  - RF-08.2: Reporte "Inventario de parcelas y stock".
  - RF-08.3: Exportación en formato PDF y CSV/Excel.
- **Criterios de Aceptación:**
  - **Escenario 1: Generación de bitácora en PDF**
    - **Given** que estoy en la sección de Reportes
    - **When** selecciono "Bitácora de Actividades", defino un rango de fechas de los últimos 3 meses y presiono "Exportar a PDF"
    - **Then** el sistema debe compilar los datos, generar el documento PDF con membrete y estructura de tabla
    - **And** iniciar la descarga automática del archivo.
  - **Escenario 2: Exportación de inventario a Excel/CSV**
    - **Given** que estoy en la vista principal del inventario
    - **When** hago clic en el botón "Exportar CSV"
    - **Then** el sistema debe descargar un archivo .csv con el estado actual exacto del stock, valorizado, listo para abrirse en hojas de cálculo.
  - **Escenario 3: Reporte sin datos en el rango seleccionado**
    - **Given** que solicito un reporte para un rango de fechas donde no tuve ninguna actividad
    - **When** genero el documento
    - **Then** el sistema debe emitir el PDF/CSV sin errores
    - **And** el documento debe indicar explícitamente "No se encontraron registros para el período seleccionado."

---

### HU-09: Administración de usuarios y roles
- **ID:** HU-09
- **Título:** Panel de control de administración global
- **Rol:** Admin
- **Historia:** Como administrador del sistema, quiero tener un panel central donde pueda ver todos los usuarios, gestionar sus roles, bloquear cuentas sospechosas y administrar catálogos globales (tipos de cultivos genéricos), para asegurar la correcta gobernanza de la plataforma.
- **Prioridad:** Baja
- **Estimación:** 8 Story Points
- **Requisitos funcionales vinculados:** 
  - RF-09.1: CRUD de usuarios (Panel Admin).
  - RF-09.2: Asignación y revocación de roles (Admin, Técnico, Agricultor).
  - RF-09.3: Gestión de datos maestros.
- **Criterios de Aceptación:**
  - **Escenario 1: Elevación de privilegios**
    - **Given** que soy un Administrador autenticado en el panel "Gestión de Usuarios"
    - **When** selecciono a un usuario "Agricultor" y cambio su rol a "Técnico"
    - **And** guardo los cambios
    - **Then** el sistema debe actualizar los privilegios del usuario en la base de datos
    - **And** en su próxima sesión, el usuario debe ver la interfaz y permisos de Técnico.
  - **Escenario 2: Bloqueo de usuario (Soft Delete / Ban)**
    - **Given** que estoy revisando la lista de usuarios
    - **When** marco la cuenta de un usuario como "Inactiva" o "Suspendida"
    - **Then** el sistema debe revocar los tokens de acceso activos de ese usuario
    - **And** el usuario no debe poder iniciar sesión nuevamente.
  - **Escenario 3: Acceso denegado a no-administradores**
    - **Given** que soy un usuario con rol "Agricultor"
    - **When** intento navegar forzadamente a la URL `/admin`
    - **Then** el sistema (React Router) debe interceptar la solicitud
    - **And** redirigirme a una página de "Acceso Denegado (403)" o al Dashboard principal.

---

### HU-10: Trazabilidad y auditoría
- **ID:** HU-10
- **Título:** Registro de auditoría (Log de acciones)
- **Rol:** Admin / Agricultor (para sus propios datos)
- **Historia:** Como usuario responsable, quiero consultar el historial de quién, cuándo y qué modificó en un registro clave (ej. eliminación de una actividad o modificación severa del inventario), para garantizar la transparencia, detectar errores y cumplir con normativas de calidad agrícola (GlobalGAP).
- **Prioridad:** Baja (Deseable)
- **Estimación:** 8 Story Points
- **Requisitos funcionales vinculados:** 
  - RF-10.1: Tabla de log de auditoría automatizada en PostgreSQL (Triggers).
  - RF-10.2: Vista de auditoría (solo lectura).
  - RF-10.3: Filtros por usuario, tabla y fecha.
- **Criterios de Aceptación:**
  - **Escenario 1: Registro automático de evento crítico (Trigger DB)**
    - **Given** que un usuario Técnico elimina un cultivo del sistema
    - **When** se ejecuta la operación de borrado
    - **Then** la base de datos (mediante trigger) debe insertar automáticamente un registro en la tabla `audit_logs` indicando el ID del usuario, acción (DELETE), fecha/hora y los datos antiguos en formato JSON.
  - **Escenario 2: Visualización del log de auditoría por el Administrador**
    - **Given** que soy un Administrador accediendo a la vista de "Auditoría"
    - **When** consulto los logs del día de hoy
    - **Then** debo ver una lista ordenada cronológicamente de todas las operaciones de escritura (INSERT, UPDATE, DELETE) realizadas por cualquier usuario en la plataforma.
  - **Escenario 3: Filtro de trazabilidad de un recurso específico**
    - **Given** que estoy en la vista de Auditoría
    - **When** filtro los logs escribiendo el nombre de una tabla específica (ej. "activities")
    - **Then** el sistema debe filtrar los resultados mostrando únicamente el historial de cambios realizados sobre la tabla de actividades.
