# 🌱 Manual de Usuario — SIGIC
### Sistema de Información de Gestión Integral y Control
**Versión:** 1.0 · **Idioma:** Español · **Fecha:** Septiembre 2026

---

> **¿A quién va dirigido este manual?**
> Este documento está pensado para tres tipos de usuarios:
> - 🌾 **Agricultores** — propietarios de parcelas que gestionan sus cultivos e inventario.
> - 🔬 **Técnicos Agrónomos** — profesionales que supervisan y asesoran a los agricultores.
> - 🛡️ **Administradores** — responsables de la configuración y supervisión del sistema.
>
> Cada sección indica con un ícono qué rol tiene acceso a esa funcionalidad.

---

## 📋 Tabla de Contenidos

1. [Introducción al Sistema](#1-introducción-al-sistema)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Navegación General](#3-navegación-general)
4. [Gestión de Parcelas](#4-gestión-de-parcelas)
5. [Gestión de Cultivos](#5-gestión-de-cultivos)
6. [Seguimiento de Actividades Agrícolas](#6-seguimiento-de-actividades-agrícolas)
7. [Mapa Interactivo](#7-mapa-interactivo)
8. [Calendario de Actividades](#8-calendario-de-actividades)
9. [Inventario de Insumos](#9-inventario-de-insumos)
10. [Alertas](#10-alertas)
11. [Reportes para Agricultores](#11-reportes-para-agricultores)
12. [Reportes para Técnicos y Administradores](#12-reportes-para-técnicos-y-administradores)
13. [Chat con Asistente IA](#13-chat-con-asistente-ia)
14. [Administración del Sistema](#14-administración-del-sistema)
15. [Preguntas Frecuentes](#15-preguntas-frecuentes)

---

## 1. Introducción al Sistema

### 1.1 ¿Qué es SIGIC?

**SIGIC** (*Sistema de Información de Gestión Integral y Control*) es una plataforma web agrícola diseñada para digitalizar, centralizar y optimizar la gestión de fincas y parcelas agrícolas. Combina tecnología moderna — mapas satelitales, inteligencia artificial y análisis de datos — con una interfaz intuitiva accesible desde cualquier dispositivo: computador, tableta o teléfono móvil.

SIGIC permite a los agricultores llevar un registro preciso de sus cultivos, actividades, costos e inventario, mientras facilita la supervisión remota de técnicos agrónomos y la toma de decisiones basada en datos reales del campo.

### 1.2 ¿Para qué sirve?

| Problema                                      | Solución en SIGIC                                     |
|-----------------------------------------------|-------------------------------------------------------|
| Registros en papel difíciles de consultar     | Base de datos digital con búsqueda instantánea        |
| No saber cuándo ni cómo aplicar insumos       | Asistente IA agrónomo disponible 24/7                 |
| Pérdida de trazabilidad del producto          | Código QR por cultivo con historial completo          |
| Alertas tardías de plagas o enfermedades      | Sistema de alertas predictivas con notificaciones     |
| Inventario descontrolado de insumos           | Módulo de inventario con alertas de stock mínimo      |
| Falta de información climática                | Pronóstico del tiempo integrado en el dashboard       |
| Reportes manuales de temporada                | Generación automática de reportes PDF, CSV y Excel    |

### 1.3 Módulos del sistema

| Módulo         | Descripción                                              | Roles con acceso         |
|----------------|----------------------------------------------------------|--------------------------|
| Dashboard      | Vista general de indicadores y estado de la finca        | Todos                    |
| Parcelas       | Gestión de terrenos agrícolas                            | Todos                    |
| Cultivos       | Registro y seguimiento de cultivos por parcela           | Todos                    |
| Mapa           | Visualización georreferenciada de parcelas               | Todos                    |
| Calendario     | Programación de actividades agrícolas                    | Todos                    |
| Inventario     | Control de insumos con alertas de stock                  | Todos (técnico/admin ven más)|
| Alertas        | Notificaciones y avisos sobre eventos críticos           | Todos                    |
| Chat IA        | Asistente inteligente agrónomo                           | Todos                    |
| Reportes       | Generación de informes descargables                      | Todos (vistas distintas) |
| Administración | Gestión de usuarios y roles                              | Solo Admin               |
| Auditoría      | Log de actividad del sistema                             | Solo Admin               |

---

## 2. Acceso al Sistema

### 2.1 Registro de nueva cuenta

🌾 **Disponible para:** Todos los usuarios nuevos

**Pasos para registrarse:**

1. Abre tu navegador y navega a la URL del sistema.
2. En la pantalla de bienvenida verás la pestaña **"Acceder"** activa por defecto.
3. Haz clic en la pestaña **"Crear cuenta"**.
4. Completa el formulario con los siguientes datos:
   - **Nombre**: mínimo 2 caracteres, máximo 60.
   - **Apellido**: mínimo 2 caracteres, máximo 60.
   - **Teléfono**: mínimo 7 dígitos, máximo 20.
   - **Correo electrónico**: debe ser un email válido.
   - **Contraseña**: mínimo 8 caracteres. Puedes usar el ícono 👁️ para mostrar u ocultar la contraseña.
5. Haz clic en **"Crear cuenta"**.

> 💡 **Nota:** Si el administrador tiene habilitada la confirmación por correo, recibirás un email para verificar tu cuenta antes de poder iniciar sesión.

**Errores comunes al registrarse:**

| Error                                    | Solución                                           |
|------------------------------------------|----------------------------------------------------|
| "Correo electrónico inválido"            | Verifica que el formato sea usuario@dominio.com    |
| "La contraseña debe tener al menos 8 caracteres" | Usa una contraseña más larga                |
| "Ingresa tu nombre (mínimo 2 caracteres)"| Escribe al menos 2 letras en el campo nombre       |
| El correo ya está registrado             | Usa "¿Olvidaste tu contraseña?" para recuperar acceso|

---

### 2.2 Inicio de sesión

🌾 **Disponible para:** Todos los usuarios registrados

**Pasos para iniciar sesión:**

1. Navega a la URL del sistema.
2. En la pestaña **"Acceder"** (activa por defecto):
   - Ingresa tu **correo electrónico** registrado.
   - Ingresa tu **contraseña**.
3. Haz clic en **"Entrar"**.
4. Serás redirigido automáticamente al **Dashboard**.

> ⚠️ **Importante:** Si intentas acceder a cualquier sección del sistema sin sesión activa, serás redirigido automáticamente a la pantalla de inicio de sesión.

---

### 2.3 Recuperación de contraseña

🌾 **Disponible para:** Todos los usuarios

**Pasos:**

1. En la pantalla de inicio de sesión, haz clic en **"¿Olvidaste tu contraseña?"**.
2. Ingresa tu **correo electrónico** registrado.
3. Haz clic en **"Enviar enlace"**.
4. Revisa tu bandeja de entrada y haz clic en el enlace del correo.
5. Serás llevado a la pantalla de restablecimiento donde podrás ingresar tu nueva contraseña.
6. Confirma y guarda. Serás redirigido al dashboard.

> 💡 **Nota:** El enlace de recuperación expira después de un tiempo determinado. Si expira, repite el proceso.

---

### 2.4 Cerrar sesión

Para cerrar sesión de forma segura:

1. En la barra lateral del menú, desplázate hasta el final.
2. Haz clic en el ícono de **"Cerrar sesión"** (ícono de salida).
3. Tu sesión termina y serás redirigido a la pantalla de bienvenida.

---

## 3. Navegación General

### 3.1 Menú lateral

Una vez dentro del sistema, verás un **menú lateral** (sidebar) con los siguientes elementos:

- **Logo SIGIC** — en la parte superior.
- **Elementos de navegación** — cada uno con ícono y nombre:

| Ícono | Sección        | Descripción rápida                    |
|-------|----------------|---------------------------------------|
| 🏠    | Dashboard      | Vista general de indicadores          |
| 📍    | Parcelas       | Gestión de tus terrenos               |
| 🌿    | Cultivos       | Tus cultivos activos e históricos     |
| 🗺️   | Mapa           | Parcelas en mapa interactivo          |
| 📅    | Calendario     | Actividades programadas               |
| 📦    | Inventario     | Control de insumos                    |
| 🔔    | Alertas        | Notificaciones (muestra contador)     |
| 🤖    | Chat IA        | Asistente agrónomo inteligente        |
| 📊    | Reportes       | Generación de informes                |
| 🛡️   | Admin          | (Solo administradores)                |

- **Perfil de usuario** — en la parte inferior del menú con tu nombre y opciones.

### 3.2 Búsqueda global

Puedes buscar parcelas y cultivos desde cualquier parte del sistema:

- **Método 1:** Haz clic en el ícono de búsqueda (🔍) en la barra superior.
- **Método 2:** Presiona el atajo de teclado **Ctrl + K** (o Cmd + K en Mac).
- Escribe el nombre de la parcela o cultivo que buscas.
- Los resultados aparecen en tiempo real agrupados por tipo.
- Haz clic en un resultado para ir directamente a él.

### 3.3 Cambiar idioma

El sistema está disponible en **español** e **inglés**:

1. En la parte superior del menú lateral, busca el selector de idioma (ícono de globo 🌐).
2. Selecciona tu idioma preferido.
3. La interfaz cambia inmediatamente.

### 3.4 Modo oscuro / claro

Para cambiar entre modo claro y oscuro:

1. Busca el ícono de sol/luna (☀️/🌙) en la barra superior.
2. Haz clic para alternar entre los dos modos.
3. Tu preferencia se guarda automáticamente en el navegador.

### 3.5 Instalar como aplicación (PWA)

SIGIC puede instalarse en tu dispositivo como una app nativa:

1. En el navegador (Chrome/Edge), busca el ícono de instalación en la barra de dirección.
2. O busca el botón **"Instalar app"** que puede aparecer en la barra lateral.
3. Haz clic en "Instalar" y el sistema funcionará como una aplicación independiente.

### 3.6 Indicador de conexión

En la barra superior verás un indicador que muestra:
- 🟢 **En línea** — conexión activa, todos los datos sincronizados.
- 🔴 **Sin conexión** — modo offline, algunas funciones pueden no estar disponibles.

---

## 4. Gestión de Parcelas

🌾🔬🛡️ **Disponible para:** Todos los roles

Las parcelas representan tus terrenos agrícolas. Desde esta sección puedes crear, editar y eliminar tus parcelas.

### 4.1 Ver la lista de parcelas

1. Haz clic en **"Parcelas"** en el menú lateral.
2. Verás una cuadrícula con todas tus parcelas registradas.
3. Cada tarjeta muestra: nombre, área en m², tipo de suelo y número de cultivos activos.

### 4.2 Crear una nueva parcela

1. En la página de Parcelas, haz clic en el botón **"+ Nueva parcela"** (esquina superior derecha).
2. Se abrirá un formulario con los siguientes campos:
   - **Nombre** *(requerido)*: identificador único de la parcela (ej. "Lote Norte A", "Cafetal Principal").
   - **Área (m²)** *(requerido)*: extensión del terreno en metros cuadrados.
   - **Tipo de suelo** *(opcional)*: selecciona de la lista desplegable.
   - **Latitud / Longitud** *(opcional)*: coordenadas GPS del terreno.
   - **Notas** *(opcional)*: información adicional relevante.
3. Para capturar ubicación automáticamente: haz clic en el botón **📍 "Capturar GPS"**. El sistema solicitará permiso de ubicación y completará los campos de latitud y longitud automáticamente.
4. Haz clic en **"Guardar"**.

> 💡 **Consejo:** Registra las coordenadas GPS de cada parcela para poder verlas en el mapa interactivo.

### 4.3 Editar una parcela

1. En la lista de parcelas, haz clic en el menú de tres puntos (**⋮**) de la parcela a editar.
2. Selecciona **"Editar"**.
3. Modifica los campos necesarios en el formulario.
4. Haz clic en **"Guardar"** para aplicar los cambios.

### 4.4 Eliminar una parcela

> ⚠️ **Advertencia:** La eliminación es permanente. Si la parcela tiene cultivos activos, ten precaución.

1. Haz clic en el menú (**⋮**) de la parcela.
2. Selecciona **"Eliminar"**.
3. En el diálogo de confirmación, haz clic en **"Confirmar"** para proceder o **"Cancelar"** para volver.

### 4.5 Buscar y paginar parcelas

- Usa el campo de búsqueda en la parte superior para filtrar por nombre.
- Si tienes más de 18 parcelas, usa los controles de paginación en la parte inferior para navegar entre páginas.

---

## 5. Gestión de Cultivos

🌾🔬🛡️ **Disponible para:** Todos los roles

Los cultivos representan el tipo de planta sembrada en cada parcela durante un período determinado.

### 5.1 Ver la lista de cultivos

1. Haz clic en **"Cultivos"** en el menú lateral.
2. Verás una tabla con todos tus cultivos, mostrando: tipo de planta, parcela, fecha de siembra, estado y fecha estimada de cosecha.

### 5.2 Filtrar cultivos

En la parte superior de la lista tienes tres filtros combinables:

| Filtro          | Opciones disponibles                                        |
|-----------------|-------------------------------------------------------------|
| Búsqueda        | Escribe nombre del cultivo o parcela                        |
| Estado          | Todos / Activos / Inactivos / Estado específico             |
| Parcela         | Todas / Nombre de parcela específica                        |

> 💡 Los filtros se aplican en tiempo real. La lista regresa a la primera página al cambiar cualquier filtro.

### 5.3 Registrar un nuevo cultivo

1. Haz clic en **"+ Nuevo cultivo"**.
2. Completa el formulario:
   - **Parcela** *(requerido)*: selecciona la parcela donde sembraste.
   - **Tipo de cultivo** *(requerido)*: elige del catálogo de plantas disponibles.
   - **Fecha de siembra** *(requerido)*: la fecha en que sembraste.
3. Haz clic en **"Crear cultivo"**.

> 💡 El sistema calculará automáticamente una **fecha estimada de cosecha** basada en el tipo de cultivo.

### 5.4 Ir al detalle de un cultivo

Haz clic en el nombre de cualquier cultivo en la lista para acceder a su **página de detalle**, donde podrás registrar actividades, costos y cosechas. (Ver sección 6).

### 5.5 Actualización masiva de estado

Para cambiar el estado de varios cultivos a la vez:

1. Marca los cultivos que deseas actualizar usando las casillas de verificación.
2. Haz clic en **"Actualizar estado"**.
3. Selecciona el nuevo estado y confirma.

---

## 6. Seguimiento de Actividades Agrícolas

🌾🔬🛡️ **Disponible para:** Todos los roles

La página de detalle de cada cultivo (`/crops/:id`) es el **centro de operaciones** de SIGIC. Desde aquí puedes registrar todo lo que ocurre con un cultivo específico.

### 6.1 Acceder al detalle de un cultivo

- Desde la lista de cultivos, haz clic sobre el nombre del cultivo.
- O desde el Dashboard, haz clic en cualquier tarjeta de cultivo activo.

### 6.2 Registrar una actividad

Las actividades son las labores que realizas en el campo:

1. En la página de detalle del cultivo, haz clic en **"+ Nueva actividad"**.
2. Selecciona el **tipo de actividad**:

| Tipo           | Descripción                                     |
|----------------|-------------------------------------------------|
| RIEGO          | Aplicación de agua al cultivo                   |
| FERTILIZACION  | Aplicación de fertilizantes o abonos            |
| MONITOREO      | Revisión del estado del cultivo                 |
| COSECHA        | Recolección del producto                        |
| PODA           | Corte y formación de la planta                  |
| APLICACION     | Aplicación de fungicidas, herbicidas, etc.      |
| SIEMBRA        | Siembra o trasplante                            |

3. Selecciona la **fecha y hora** de la actividad.
4. Escribe **notas** adicionales (opcional, máx. 1000 caracteres).
5. Adjunta una **foto de evidencia** si lo deseas (PNG, JPEG, WEBP o GIF, máx. 5 MB).
6. Haz clic en **"Guardar"**.

### 6.3 Registrar un costo

Para registrar gastos asociados al cultivo:

1. En la sección **"Costos"** del detalle del cultivo, haz clic en **"+ Agregar costo"**.
2. Completa:
   - **Tipo**: INSUMOS, MANO_OBRA, MAQUINARIA, TRANSPORTE, OTROS.
   - **Descripción**: qué compraste o qué servicio pagaste.
   - **Cantidad**: cuántas unidades.
   - **Precio unitario**: costo por unidad.
3. El **total** se calcula automáticamente (`cantidad × precio unitario`).
4. Haz clic en **"Guardar"**.

El resumen de costos acumulados se actualiza automáticamente en la cabecera del cultivo.

### 6.4 Registrar una cosecha

1. En la sección **"Cosechas"**, haz clic en **"+ Registrar cosecha"**.
2. Completa:
   - **Cantidad cosechada** y **unidad** (kg, toneladas, cajas, etc.).
   - **Precio por unidad de venta**.
   - **Fecha de cosecha**.
3. El **ingreso total** se calcula automáticamente.
4. Guarda el registro.

### 6.5 Ver rentabilidad del cultivo

En la cabecera o resumen del cultivo verás:

- **Costo total**: suma de todos los costos registrados.
- **Ingreso total**: suma de todas las cosechas registradas.
- **Margen bruto**: Ingreso total − Costo total.
- **Rentabilidad (%)**: (Margen / Costo) × 100.

### 6.6 Código QR de trazabilidad

Cada cultivo genera automáticamente un **código QR único** que contiene su historial:

1. En la página de detalle, busca la sección **"Trazabilidad"** o el ícono de QR.
2. Puedes **descargar** el código QR para imprimirlo y adherirlo al producto.
3. Cualquier persona puede escanear el QR para ver el historial público del cultivo en la URL `/trace/:codigo`.

---

## 7. Mapa Interactivo

🌾🔬🛡️ **Disponible para:** Todos los roles

El mapa te permite ver tus parcelas georreferenciadas en un mapa interactivo.

### 7.1 Acceder al mapa

Haz clic en **"Mapa"** en el menú lateral. El mapa cargará centrado en la región donde están tus parcelas.

### 7.2 Navegar en el mapa

- **Zoom**: usa la rueda del ratón o los botones **+/-** en el mapa.
- **Desplazamiento**: haz clic y arrastra.
- **Marcadores**: cada punto azul/verde representa una parcela con coordenadas registradas.

### 7.3 Ver información de una parcela en el mapa

1. Haz clic sobre el marcador de una parcela.
2. Aparecerá un **popup** con: nombre de la parcela, área y tipo de suelo.
3. Desde el popup puedes ir directamente a la página de la parcela.

### 7.4 Visor NDVI (índice de salud vegetal)

> 💡 Esta función requiere configuración de Sentinel Hub por parte del administrador.

El NDVI (*Normalized Difference Vegetation Index*) permite ver imágenes satelitales del estado de la vegetación:

1. En el mapa, busca el selector de capas.
2. Activa la capa **"NDVI"**.
3. Las zonas verdes intensas indican vegetación sana; las zonas amarillas/marrones indican estrés hídrico o enfermedad.

> ⚠️ Las imágenes satelitales pueden tener un retraso de días o semanas dependiendo de la disponibilidad de Sentinel Hub.

---

## 8. Calendario de Actividades

🌾🔬🛡️ **Disponible para:** Todos los roles

El calendario te permite ver y planificar las actividades agrícolas en una vista temporal.

### 8.1 Acceder al calendario

Haz clic en **"Calendario"** en el menú lateral.

### 8.2 Navegar entre fechas

- Usa las flechas **← →** para moverte entre semanas o meses.
- Haz clic en **"Hoy"** para volver a la fecha actual.
- Cambia entre vista de **día**, **semana** y **mes** usando los botones de la esquina superior derecha.

### 8.3 Ver actividades en el calendario

- Cada actividad registrada aparece como un bloque de color en la fecha en que fue realizada.
- Los colores corresponden al tipo de actividad:
  - 🔵 Azul: Riego
  - 🟢 Verde: Fertilización
  - 🟡 Amarillo: Monitoreo
  - 🔴 Rojo: Cosecha
  - 🟣 Morado: Poda

### 8.4 Crear actividad desde el calendario

1. Haz clic en un espacio vacío del calendario en la fecha deseada.
2. Se abrirá el formulario de nueva actividad.
3. Completa los datos y guarda.

---

## 9. Inventario de Insumos

🌾🔬🛡️ **Disponible para:** Todos (técnicos y admin pueden ver de múltiples agricultores)

El inventario te permite controlar los insumos agrícolas que tienes disponibles, como fertilizantes, plaguicidas, semillas y herramientas.

### 9.1 Acceder al inventario

Haz clic en **"Inventario"** en el menú lateral.

> 💡 Si eres técnico o administrador, verás un selector en la parte superior para elegir qué agricultor deseas ver.

### 9.2 Ver el inventario

La lista de insumos muestra:
- Nombre del insumo y categoría.
- Cantidad actual disponible y unidad.
- Stock mínimo configurado.
- **Indicador de estado**: verde (normal), rojo (stock bajo).

### 9.3 Agregar un insumo nuevo

1. Haz clic en **"+ Agregar insumo"**.
2. Completa:
   - **Nombre**: nombre del insumo (ej. "Urea 46%").
   - **Categoría**: fertilizante, plaguicida, semilla, herramienta, otros.
   - **Cantidad actual**: cuánto tienes ahora.
   - **Unidad**: kg, litros, sacos, unidades, etc.
   - **Stock mínimo**: a partir de qué cantidad el sistema te alertará.
3. Guarda el insumo.

### 9.4 Registrar entrada o salida de insumo

Para actualizar el stock cuando compras o usas insumos:

1. Selecciona el insumo de la lista.
2. Haz clic en **"Registrar movimiento"**.
3. Selecciona el tipo:
   - **Entrada**: cuando compras o recibes insumos.
   - **Salida**: cuando los usas en el campo.
4. Ingresa la cantidad.
5. El sistema actualiza automáticamente el stock y valida que no quede negativo.

> ⚠️ El sistema no permite registrar salidas que dejen el stock en negativo.

### 9.5 Alertas de stock mínimo

Si la cantidad actual de un insumo es menor o igual al stock mínimo configurado:
- El insumo aparecerá resaltado en **rojo** en la lista.
- Se generará una **alerta automática** en la sección de Alertas.

---

## 10. Alertas

🌾🔬🛡️ **Disponible para:** Todos los roles

Las alertas son avisos sobre eventos que requieren tu atención: plagas detectadas, necesidad de riego, cosechas próximas, etc.

### 10.1 Ver tus alertas

1. Haz clic en **"Alertas"** en el menú lateral.
2. Verás dos secciones:
   - **Alertas pendientes**: requieren acción de tu parte.
   - **Historial**: alertas ya resueltas o descartadas.

> 💡 El menú lateral muestra el número de alertas pendientes como un badge rojo sobre el ícono de campana 🔔.

### 10.2 Gestionar una alerta

Para cada alerta pendiente tienes dos opciones:

| Acción      | Descripción                                        | Resultado                              |
|-------------|----------------------------------------------------|-----------------------------------------|
| ✅ Resolver  | Indica que tomaste la acción necesaria              | La alerta pasa al historial como RESUELTA |
| ❌ Descartar | La alerta no aplica o ya no es relevante            | La alerta pasa al historial como DESCARTADA |

Haz clic en el ícono correspondiente junto a la alerta para ejecutar la acción.

### 10.3 Crear una alerta (técnicos y administradores)

🔬🛡️ **Solo para técnicos y administradores:**

1. Haz clic en **"+ Nueva alerta"**.
2. Selecciona el **agricultor destinatario** (o déjalo en "yo mismo").
3. Selecciona el **tipo de alerta**: RIEGO, FERTILIZACION, PODA, MONITOREO, CLIMA, PLAGA, COSECHA.
4. Escribe el **título** (obligatorio) y el **cuerpo/mensaje** (opcional).
5. Haz clic en **"Guardar"**.

La alerta aparecerá inmediatamente en la bandeja del agricultor seleccionado.

---

## 11. Reportes para Agricultores

🌾 **Disponible para:** Agricultores (vista simplificada)

Cuando accedes a la sección **"Reportes"** como agricultor, verás un panel diseñado especialmente para ti con información clara de tu finca.

### 11.1 Pestañas del reporte agricultor

El reporte tiene las siguientes pestañas:

| Pestaña      | Contenido                                                        |
|--------------|------------------------------------------------------------------|
| Resumen      | KPI principal: parcelas, cultivos activos, alertas, rentabilidad |
| Mis Cultivos | Lista de cultivos con estado, costos e ingresos por cultivo      |
| Financiero   | Gráficos de costos e ingresos por tipo y por mes                 |
| Cosechas     | Historial de cosechas con fechas, cantidades y precios           |
| Alertas      | Resumen de alertas activas                                       |

### 11.2 Análisis con Inteligencia Artificial

1. En tu reporte, haz clic en el botón **"Generar análisis con IA"**.
2. El sistema envía un resumen de tus datos agrícolas al asistente de inteligencia artificial.
3. Recibirás recomendaciones personalizadas sobre:
   - Cultivos con mayor rentabilidad.
   - Tipos de actividad más frecuentes.
   - Alertas que requieren atención inmediata.
   - Sugerencias de optimización de costos.

> ⚠️ El análisis IA requiere conexión a internet. Los resultados son orientativos y no reemplazan el criterio de un agrónomo profesional.

### 11.3 Exportar tu reporte a PDF

1. En la parte superior del reporte, haz clic en **"Exportar PDF"**.
2. Se descargará automáticamente un archivo PDF con el resumen de tu temporada.

---

## 12. Reportes para Técnicos y Administradores

🔬🛡️ **Disponible para:** Técnicos y Administradores

Los técnicos y administradores tienen acceso a reportes más completos y configurables.

### 12.1 Configurar filtros del reporte

En la sección de Reportes, el panel de configuración tiene los siguientes filtros:

| Filtro         | Opciones                                               |
|----------------|--------------------------------------------------------|
| Plantilla      | Bitácora de actividades / Inventario de parcelas / Resumen ejecutivo |
| Parcela        | Todas / Parcela específica                             |
| Tipo de cultivo| Todos / Tipo específico (no aplica en parcelas)        |
| Desde          | Fecha de inicio del período                            |
| Hasta          | Fecha de fin del período                               |
| Año (gráficos) | Selecciona el año para los gráficos de rentabilidad    |

> ⚠️ Si la fecha "Desde" es mayor que "Hasta", el sistema mostrará un error y el botón de generar quedará deshabilitado.

### 12.2 Generar reporte PDF

1. Configura los filtros deseados.
2. Haz clic en **"Generar PDF"**.
3. El reporte se descarga con el formato: `sigic-[plantilla]-[fecha]-[hora].pdf`

#### Contenido por plantilla:

**📋 Bitácora de actividades:**
- Tabla detallada de todas las actividades filtradas.
- Resumen por tipo de actividad.

**📍 Inventario de parcelas:**
- Lista de parcelas con: nombre, área, tipo de suelo, coordenadas.

**📊 Resumen ejecutivo:**
- Indicadores generales (parcelas, actividades, alertas, costos, ingresos).
- Distribución por tipo de actividad.
- Costos por tipo.
- Cosechas recientes.

### 12.3 Exportar datos

| Botón              | Qué exporta                    | Formato | Cuándo disponible            |
|--------------------|--------------------------------|---------|------------------------------|
| Exportar CSV       | Bitácora de actividades         | .csv    | Plantilla "Actividades"      |
| Exportar Excel     | Inventario de parcelas          | .csv compatible con Excel | Plantilla "Parcelas" |

### 12.4 Gráficos interactivos

El panel de reportes incluye dos gráficos:

1. **📈 Ingresos por mes**: gráfico de líneas con la evolución de ingresos de cosechas mes a mes.
2. **📊 Actividades por mes**: gráfico de barras con el número de actividades registradas por mes.

### 12.5 Análisis de rentabilidad

En la sección "Rentabilidad" verás:

| Indicador     | Descripción                               |
|---------------|-------------------------------------------|
| Costo total   | Suma de todos los costos en el período    |
| Ingreso total | Suma de todos los ingresos de cosechas    |
| Margen bruto  | Ingreso − Costo                           |
| Rentabilidad  | (Margen / Costo) × 100%                   |

### 12.6 Comparativa anual (Year-over-Year)

Si existen datos de años anteriores, verás una sección de **Comparativa Anual** con:
- Ingreso del año anterior vs. año actual.
- Variación porcentual de ingresos y costos.

### 12.7 Análisis IA para reportes

Similar al reporte del agricultor, los técnicos también pueden solicitar un **análisis IA** que interpreta los datos filtrados y genera recomendaciones para el período seleccionado.

### 12.8 Reportes programados por email

Para automatizar el envío de reportes:

1. En la sección **"Reportes programados"**, haz clic en **"+ Nuevo"**.
2. Completa:
   - **Plantilla**: tipo de reporte a enviar.
   - **Destinatarios**: correos separados por coma (ej. `correo1@mail.com, correo2@mail.com`).
   - **Frecuencia**: Diario, Semanal o Mensual.
3. Haz clic en **"Programar"**.

Para gestionar los reportes programados:
- **✅ Habilitar/Deshabilitar**: haz clic en el ícono de estado (verde = activo, gris = inactivo).
- **🗑️ Eliminar**: haz clic en el ícono de papelera.

---

## 13. Chat con Asistente IA

🌾🔬🛡️ **Disponible para:** Todos los roles

SIGIC incluye un asistente agrónomo impulsado por inteligencia artificial que responde tus preguntas sobre agricultura.

### 13.1 Acceder al chat

Haz clic en **"Chat"** (ícono 🤖) en el menú lateral.

### 13.2 Hacer una consulta

1. Escribe tu pregunta en el campo de texto en la parte inferior del chat.
2. Presiona **Enter** o haz clic en el botón de enviar (➤).
3. El asistente responderá en segundos.

### 13.3 Ejemplos de preguntas que puedes hacer

- "¿Cuándo debo aplicar fertilizante a mi cultivo de maíz?"
- "¿Qué síntomas indican que mis plantas tienen roya?"
- "¿Cuál es la densidad de siembra recomendada para el frijol?"
- "¿Cómo optimizo el riego por goteo en una parcela de 2 hectáreas?"
- "¿Qué hacer si detecté pulgones en mis plantas de tomate?"

> ⚠️ El asistente IA es una herramienta de apoyo. Para situaciones críticas, consulta siempre con un agrónomo certificado.

> 💡 El asistente conoce el contexto agrícola, pero no tiene acceso directo a tus datos de SIGIC en el chat. Para análisis personalizados usa la función de reportes con IA.

---

## 14. Administración del Sistema

🛡️ **Solo para Administradores**

El panel de administración permite gestionar todos los usuarios y configuraciones del sistema.

### 14.1 Acceder a Administración

Haz clic en **"Admin"** (ícono de escudo 🛡️) en el menú lateral. Solo aparece si tienes rol de administrador.

### 14.2 Métricas del sistema

En la parte superior verás tarjetas con indicadores globales:

| Métrica            | Descripción                                      |
|--------------------|--------------------------------------------------|
| Total usuarios     | Número de cuentas registradas                    |
| Total parcelas     | Parcelas registradas en todo el sistema          |
| Total cultivos     | Cultivos activos en el sistema                   |
| Alertas pendientes | Alertas sin resolver en todo el sistema          |

### 14.3 Gestión de usuarios y roles

En la sección **"Usuarios"** puedes:

1. **Ver** todos los usuarios con sus roles actuales.
2. **Buscar** un usuario por nombre usando el campo de búsqueda.
3. **Asignar un rol** a un usuario:
   - Selecciona el rol en el selector desplegable junto al usuario.
   - El cambio es inmediato.
4. **Revocar un rol**:
   - Haz clic en el botón **X** junto al rol que deseas eliminar.
   - Confirma la acción.

> ⚠️ Los roles disponibles son: **agricultor**, **técnico**, **admin**. Un usuario puede tener múltiples roles simultáneamente.

### 14.4 Resumen de agricultores

En la sección **"Agricultores"** verás un resumen de cada agricultor con:
- Nombre completo.
- Número de parcelas y cultivos activos.
- Alertas pendientes asignadas.

Haz clic en cualquier agricultor para ver su información detallada.

### 14.5 Generación automática de alertas

Como administrador puedes ejecutar el proceso automático de generación de alertas:

1. Haz clic en el botón **"Generar alertas automáticas"** (ícono de refresh 🔄).
2. El sistema analiza el estado de los cultivos y genera alertas para los agricultores correspondientes.
3. Se mostrará una notificación con el número de alertas creadas.

### 14.6 Auditoría del sistema

La sección de Auditoría (`/audit`) está disponible para administradores y muestra un log cronológico de todas las acciones realizadas en el sistema:

- Cambios de datos críticos.
- Asignación y revocación de roles.
- Accesos al panel de administración.

---

## 15. Preguntas Frecuentes

**❓ ¿Puedo usar SIGIC en mi teléfono móvil?**

Sí. SIGIC es una aplicación web responsiva que funciona correctamente en smartphones y tabletas. Además, puedes instalarla como PWA para acceder sin abrir el navegador.

---

**❓ ¿Qué pasa si pierdo la conexión a internet?**

El sistema detecta la pérdida de conexión y muestra un indicador rojo en la barra superior. Algunas funciones básicas pueden continuar funcionando en modo offline, pero los datos no se sincronizarán hasta recuperar la conexión.

---

**❓ ¿Cómo se protegen mis datos?**

SIGIC usa políticas de seguridad a nivel de fila (RLS) en la base de datos Supabase, lo que garantiza que solo tú y los usuarios autorizados puedan ver y modificar tus datos. La comunicación está cifrada con HTTPS.

---

**❓ ¿Pueden los técnicos ver mis datos sin que yo lo sepa?**

Los técnicos tienen acceso a los datos de los agricultores que están bajo su supervisión como parte de su función. El administrador gestiona qué usuarios tienen rol de técnico. Todas las acciones quedan registradas en el log de auditoría.

---

**❓ ¿Cómo agrego un nuevo tipo de cultivo que no aparece en el catálogo?**

El catálogo de tipos de cultivo es administrado por el equipo técnico del sistema. Comunícate con tu administrador para solicitar la adición de un nuevo tipo de cultivo.

---

**❓ ¿Puedo compartir el código QR de mi cultivo con compradores?**

Sí. El código QR lleva a una página pública de trazabilidad (`/trace/:codigo`) donde cualquier persona puede ver el historial de actividades del cultivo sin necesidad de iniciar sesión.

---

**❓ ¿Los reportes programados por email tienen costo adicional?**

Depende de la configuración de correo (SMTP) del sistema. Consulta con tu administrador sobre los límites de envío configurados.

---

**❓ ¿Cómo reporto un error o problema técnico?**

1. Comunícate con el administrador de tu sistema.
2. Proporciona:
   - Descripción detallada del problema.
   - Pasos para reproducirlo.
   - Navegador y versión que usas.
   - Capturas de pantalla si es posible.

---

## 📞 Información de Contacto y Soporte

Para soporte técnico o consultas sobre el sistema, contacta con el administrador de tu organización. El administrador cuenta con acceso al panel de auditoría y métricas del sistema para diagnosticar y resolver problemas.

---

## 📝 Historial de Versiones

| Versión | Fecha           | Cambios                             |
|---------|-----------------|-------------------------------------|
| 1.0     | Septiembre 2026 | Versión inicial del manual completo |

---

*Manual de Usuario SIGIC — © 2026 — Sistema de Información de Gestión Integral y Control*
*Todos los derechos reservados. Este documento es confidencial y para uso interno.*
