# Manual de Usuario — SIGIC v1.0

> 🌐 **URL Pública de Acceso en Línea:** [https://occupation-suppliers-attribute-superintendent.trycloudflare.com](https://occupation-suppliers-attribute-superintendent.trycloudflare.com)  
> *Servidor web público activo con certificado SSL/HTTPS en la red perimetral de Cloudflare.*

## Tabla de contenido
1. [Introducción y objetivo del sistema](#1-introducción-y-objetivo-del-sistema)
2. [Requisitos del sistema](#2-requisitos-del-sistema)
3. [Acceso al sistema](#3-acceso-al-sistema)
   - [3.1 Registro de cuenta nueva](#31-registro-de-cuenta-nueva)
   - [3.2 Inicio de sesión](#32-inicio-de-sesión)
   - [3.3 Recuperación de contraseña](#33-recuperación-de-contraseña)
   - [3.4 Cierre de sesión](#34-cierre-de-sesión)
4. [Interfaz general](#4-interfaz-general)
5. [Pantallas maestras](#5-pantallas-maestras)
   - [5.1 Panel principal (Dashboard)](#51-panel-principal-dashboard)
   - [5.2 Parcelas](#52-parcelas)
   - [5.3 Cultivos](#53-cultivos)
   - [5.4 Inventario](#54-inventario)
   - [5.5 Calendario](#55-calendario)
   - [5.6 Alertas](#56-alertas)
6. [Transacción principal: Registro de actividad agrícola](#6-transacción-principal-registro-de-actividad-agrícola)
7. [Reportes](#7-reportes)
   - [7.1 Bitácora de actividades](#71-bitácora-de-actividades)
   - [7.2 Inventario de parcelas](#72-inventario-de-parcelas)
   - [7.3 Resumen ejecutivo](#73-resumen-ejecutivo)
8. [Funciones por rol](#8-funciones-por-rol)
9. [Funciones avanzadas](#9-funciones-avanzadas)
10. [Trabajo sin conexión (modo offline)](#10-trabajo-sin-conexión-modo-offline)
11. [Solución de problemas frecuentes](#11-solución-de-problemas-frecuentes)
12. [Glosario de términos](#12-glosario-de-términos)

---

## 1. Introducción y objetivo del sistema

Bienvenido al Manual de Usuario de **SIGIC** (Sistema Inteligente de Gestión y Seguimiento de Cultivos), una plataforma digital de vanguardia diseñada específicamente para transformar y optimizar la administración de proyectos y actividades agrícolas. Este documento ha sido elaborado para guiarlo paso a paso en el uso de la aplicación, garantizando que pueda aprovechar al máximo todas sus funcionalidades, desde la planificación inicial hasta la cosecha.

**Objetivo principal del sistema:**
El objetivo primordial de SIGIC es centralizar, simplificar y automatizar la gestión integral de fincas, parcelas y cultivos. Al utilizar SIGIC, los agricultores, técnicos agrícolas y administradores pueden registrar actividades en tiempo real, monitorear el progreso del ciclo productivo, controlar inventarios de insumos, planificar labores futuras mediante un calendario interactivo y recibir alertas tempranas sobre posibles eventualidades (como plagas, clima extremo o bajo stock de insumos). Todo esto con la finalidad de incrementar la productividad, reducir los costos operativos, mejorar la toma de decisiones basada en datos concretos y garantizar la trazabilidad completa de los productos agrícolas.

La aplicación está diseñada bajo principios de usabilidad modernos, asegurando que personas con distintos niveles de habilidad tecnológica puedan navegar e interactuar de manera fluida y sin complicaciones. Ya sea que se encuentre en la oficina planificando la temporada o en medio del campo registrando una aplicación de fertilizante, SIGIC es su aliado tecnológico indispensable.

---

## 2. Requisitos del sistema

SIGIC es una aplicación web progresiva (PWA) construida con tecnologías modernas (React 19, TanStack Start y Supabase). Esto significa que no requiere instalaciones pesadas ni descargas desde tiendas de aplicaciones, sino que se accede directamente a través de un navegador web, ofreciendo una experiencia similar a la de una aplicación nativa.

**Navegadores web compatibles (se recomienda mantenerlos actualizados a su última versión):**
- **Google Chrome:** Versión 90 o superior (Recomendado para la mejor experiencia).
- **Mozilla Firefox:** Versión 88 o superior.
- **Microsoft Edge:** Versión 90 o superior.
- **Apple Safari:** Versión 14 o superior (en dispositivos macOS y iOS).

**Dispositivos compatibles:**
- **Computadoras de escritorio y laptops:** Equipos con sistemas operativos Windows, macOS o distribuciones de Linux modernos.
- **Tabletas y iPads:** Ideal para técnicos y administradores que requieren mayor espacio de pantalla en campo.
- **Teléfonos inteligentes (Smartphones):** Pantallas a partir de 4.7 pulgadas, sistemas operativos Android 9.0+ o iOS 13+. La interfaz es completamente responsiva y se adapta al tamaño de su dispositivo.

**Conectividad:**
Aunque SIGIC requiere una conexión a Internet (Wi-Fi o datos móviles 3G/4G/5G) para la sincronización inicial y la actualización en tiempo real de los datos, la aplicación cuenta con una robusta funcionalidad de **trabajo sin conexión (modo offline)**. Esto le permite continuar registrando datos en áreas rurales sin cobertura; el sistema guardará la información en la memoria de su dispositivo y la sincronizará automáticamente con los servidores principales (Supabase) en cuanto recupere la conexión.

---

## 3. Acceso al sistema

El acceso seguro a la plataforma es el primer paso para comenzar a gestionar sus cultivos. A continuación, se detallan los procesos relacionados con la gestión de su cuenta en SIGIC.

### 3.1 Registro de cuenta nueva
Si es su primera vez utilizando la plataforma y un administrador no le ha creado una cuenta previamente, deberá registrarse:
1. Abra su navegador web y diríjase a la URL de acceso: **https://sigic.app**.
2. En la pantalla principal, localice y haga clic en el botón o enlace que dice **"Crear cuenta"** o **"Registrarse"**.
3. Complete el formulario de registro con sus datos personales:
   - Nombre completo.
   - Correo electrónico válido (este será su usuario).
   - Número de teléfono (opcional pero recomendado para alertas por SMS o WhatsApp).
   - Contraseña segura (debe contener al menos 8 caracteres, combinando letras mayúsculas, minúsculas, números y símbolos).
4. Seleccione el rol de usuario que mejor describa su función inicial (Agricultor). Tenga en cuenta que los roles de Técnico y Administrador deben ser asignados y aprobados por la administración del sistema.
5. Lea y acepte los Términos y Condiciones y la Política de Privacidad de SIGIC.
6. Haga clic en **"Registrarse"**. Recibirá un correo electrónico de confirmación. Haga clic en el enlace dentro del correo para activar su cuenta.

### 3.2 Inicio de sesión
Para ingresar a su cuenta de SIGIC de manera cotidiana:
1. Diríjase a **https://sigic.app**.
2. Ingrese su dirección de correo electrónico en el campo "Correo electrónico" o "Usuario".
3. Ingrese su contraseña en el campo correspondiente. Puede utilizar el ícono del "ojo" para visualizar la contraseña y asegurarse de haberla escrito correctamente.
4. (Opcional) Marque la casilla **"Mantener sesión iniciada"** si está utilizando un dispositivo personal y no compartido. Esto evitará que tenga que ingresar sus credenciales cada vez.
5. Haga clic en el botón **"Iniciar Sesión"**. Si sus credenciales son correctas, será redirigido inmediatamente al Panel principal (Dashboard).

### 3.3 Recuperación de contraseña
Si olvida su contraseña, no se preocupe, puede restablecerla fácilmente:
1. En la pantalla de inicio de sesión, haga clic en el enlace **"¿Olvidaste tu contraseña?"**.
2. Ingrese el correo electrónico asociado a su cuenta de SIGIC.
3. Haga clic en **"Enviar enlace de recuperación"**.
4. Revise su bandeja de entrada (y la carpeta de spam o correo no deseado). Recibirá un correo de SIGIC con instrucciones.
5. Haga clic en el enlace proporcionado en el correo. Se abrirá una nueva pestaña donde podrá ingresar y confirmar su nueva contraseña.
6. Una vez guardada la nueva contraseña, vuelva a la pantalla de inicio de sesión e ingrese con sus nuevas credenciales.

### 3.4 Cierre de sesión
Por razones de seguridad, especialmente si utiliza un dispositivo público o compartido, es fundamental cerrar su sesión al finalizar su trabajo:
1. Localice su **Perfil de usuario** en la esquina superior derecha de la pantalla (generalmente representado por su foto, iniciales o un ícono de persona).
2. Haga clic sobre el ícono para desplegar el menú de opciones de perfil.
3. Seleccione la opción **"Cerrar Sesión"** o **"Salir"**.
4. El sistema lo regresará a la pantalla principal de inicio de sesión, garantizando que nadie más pueda acceder a su información.

---

## 4. Interfaz general

La interfaz de usuario de SIGIC ha sido diseñada enfocándose en la simplicidad, la limpieza visual y la rapidez de navegación. La estructura general de la aplicación se divide en las siguientes áreas principales:

**Menú de navegación lateral (Sidebar):**
Ubicado en el lado izquierdo de la pantalla (o accesible mediante un botón de "hamburguesa" - tres líneas horizontales - en dispositivos móviles). Este menú es su centro de comando principal. Contiene enlaces directos a todas las "Pantallas Maestras" y funciones del sistema (Dashboard, Parcelas, Cultivos, Inventario, Calendario, Alertas, Reportes y Configuración).

**Barra superior (Top bar):**
Se encuentra en la parte superior de la pantalla y permanece visible en todo momento. Aquí encontrará:
- **Buscador global:** Una barra de búsqueda rápida que le permite encontrar parcelas, cultivos, insumos o actividades escribiendo palabras clave.
- **Centro de notificaciones:** Un ícono de campana que mostrará un punto rojo o un número cuando tenga notificaciones nuevas (alertas de sistema, recordatorios del calendario, avisos de bajo stock). Al hacer clic, se despliega una lista de las notificaciones más recientes.
- **Asistente IA:** Un botón para abrir el panel del asistente de Inteligencia Artificial para consultas rápidas.
- **Perfil de usuario:** El acceso a la configuración de su cuenta y la opción de cierre de sesión.

**Área de trabajo central:**
Es la sección más grande de la pantalla, donde se visualiza el contenido de la opción seleccionada en el menú de navegación. Aquí se muestran las tablas de datos, formularios, gráficos y mapas.

**Tema Claro y Oscuro:**
Para adaptarse a sus preferencias de visualización y proteger su vista en entornos de baja luminosidad (o reducir el brillo bajo el sol directo), SIGIC ofrece dos modos visuales:
- **Tema Claro:** Fondo blanco con texto oscuro, ideal para entornos muy iluminados.
- **Tema Oscuro:** Fondos en tonos grises oscuros y negros con texto claro, ideal para trabajar de noche o en interiores.
Puede alternar entre estos temas desde el menú de perfil de usuario en la barra superior o en la sección de configuración general.

---

## 5. Pantallas maestras

Estas pantallas son el núcleo operativo de SIGIC, donde se gestionan las entidades fundamentales de la plataforma agrícola.

### 5.1 Panel principal (Dashboard)
Es la primera pantalla que verá al iniciar sesión. Actúa como un centro de control que proporciona una vista panorámica del estado actual de su operación agrícola.
- **Métricas clave:** Tarjetas de resumen en la parte superior que muestran datos críticos al instante, como el número total de parcelas activas, cultivos en progreso, tareas pendientes para hoy y alertas críticas sin resolver.
- **Gráficos interactivos:** Representaciones visuales de información, como la distribución de tipos de cultivos, rendimiento histórico, evolución de gastos en insumos o cumplimiento de la programación.
- **Alertas y tareas inminentes:** Un panel dedicado a resaltar lo que requiere su atención inmediata, organizado por prioridad.

### 5.2 Parcelas
Esta sección permite gestionar la división física de su terreno. Una parcela es un área de tierra delimitada geográficamente donde se establecerán los cultivos.
- **Listado de parcelas:** Una tabla completa que muestra todas las parcelas registradas, indicando su nombre, código, área (en hectáreas o metros cuadrados), tipo de suelo y estado actual (activa, en descanso, preparación).
- **Crear nueva parcela:** Mediante el botón "Nueva Parcela", accederá a un formulario para registrar los detalles. Puede dibujar el polígono de la parcela directamente en el Mapa interactivo integrado para calcular automáticamente su área.
- **Editar y eliminar:** Puede actualizar la información de una parcela existente o darla de baja si ya no pertenece a su gestión.
- **Búsqueda y filtros:** Herramientas para encontrar parcelas específicas por nombre, tamaño, o estado.

### 5.3 Cultivos
Un cultivo representa la plantación específica que se realiza en una o varias parcelas durante un ciclo de tiempo determinado (por ejemplo, "Maíz de verano 2024").
- **Gestión del ciclo productivo:** Esta pantalla permite visualizar en qué fase se encuentra cada cultivo (preparación del terreno, siembra, germinación, desarrollo vegetativo, floración, fructificación, cosecha, post-cosecha).
- **Crear cultivo:** Al registrar un nuevo cultivo, deberá asociarlo a una parcela, definir la variedad de la semilla, la fecha estimada de siembra y cosecha, y el rendimiento esperado.
- **Actualización de estado:** Con un solo clic, puede avanzar el estado del cultivo a la siguiente fase de su ciclo productivo, lo cual actualizará los paneles de todos los usuarios vinculados.

### 5.4 Inventario
El control de los recursos materiales es vital. Esta pantalla gestiona todos los insumos, herramientas y productos cosechados.
- **Catálogo de insumos:** Lista de fertilizantes, semillas, pesticidas, herramientas y maquinaria.
- **Entradas y salidas:** Registro detallado de cada vez que se compra nuevo material (entrada) o se utiliza en campo (salida).
- **Alertas de stock:** El sistema monitorea constantemente las cantidades. Puede configurar niveles mínimos de inventario para cada producto; si el stock cae por debajo de este límite, SIGIC generará una advertencia automática para solicitar reabastecimiento.

### 5.5 Calendario
La herramienta principal de planificación temporal. Funciona como una agenda interactiva enfocada en el campo.
- **Vista mensual, semanal y diaria:** Navegue por el calendario para visualizar las labores programadas a corto, mediano y largo plazo.
- **Programar labores:** Asigne tareas a fechas específicas, vinculándolas a una parcela o cultivo particular y designando a un responsable. Puede configurar tareas recurrentes (por ejemplo, "Riego todos los martes y jueves").
- **Marcar como realizadas:** Una vez que el trabajo en campo concluye, el usuario puede marcar la tarea como "Completada" directamente desde el calendario, lo que genera automáticamente un registro en la bitácora.

### 5.6 Alertas
El centro de notificaciones de incidentes y avisos del sistema.
- **Tipos de alertas:** El sistema categoriza las alertas en diferentes niveles de severidad (Informativa, Advertencia, Crítica). Ejemplos incluyen: "Pronóstico de helada", "Stock bajo de Urea", o "Reporte de plaga en Parcela A".
- **Gestión de alertas:** Desde esta pantalla, puede visualizar el detalle de cada alerta. Una vez que se toma acción, puede "Atender" o "Descartar" la alerta, dejándola registrada en el historial pero removiéndola de las vistas de atención inmediata.

---

## 6. Transacción principal: Registro de actividad agrícola

El corazón operativo de SIGIC es la capacidad de registrar qué, cuándo, dónde y cómo se están realizando las labores en el campo. Este registro es esencial para la trazabilidad y el análisis de costos.

### Tipos de actividad
El sistema clasifica las actividades en diversas categorías predefinidas, tales como:
- **Preparación de suelo:** Arado, rastrillado, nivelación.
- **Siembra/Plantación.**
- **Riego:** Por goteo, aspersión, gravedad.
- **Fertilización/Nutrición:** Aplicación de abonos orgánicos o químicos.
- **Manejo fitosanitario:** Aplicación de herbicidas, fungicidas, insecticidas.
- **Mantenimiento:** Poda, deshierbe, limpieza.
- **Cosecha:** Recolección de productos.
- **Monitoreo/Inspección:** Evaluaciones de técnicos agrícolas.

### Flujo paso a paso para registrar una actividad
1. Navegue a la sección **"Registro de Actividad"** desde el menú principal o presione el botón de acceso rápido **"+"** ubicado en la barra superior o en el Dashboard.
2. **Seleccione la Parcela y el Cultivo:** Indique dónde se está realizando la labor.
3. **Seleccione el Tipo de Actividad:** Elija de la lista desplegable la categoría que corresponda.
4. **Fecha y Hora:** Por defecto se asigna la fecha y hora actual, pero puede modificarla si está registrando una actividad pasada.
5. **Insumos utilizados (opcional):** Si la actividad implica el uso de materiales (por ejemplo, fertilización), seleccione el insumo de su inventario y la cantidad aplicada. Esto descontará automáticamente el producto de la pantalla de Inventario.
6. **Responsable/Trabajadores:** Indique quién o quiénes realizaron la labor, así como las horas invertidas (útil para el cálculo de costos laborales).
7. **Observaciones/Comentarios:** Un espacio de texto libre para anotar detalles importantes (ej. "La tierra estaba muy seca", "Se observó presencia leve de pulgón").
8. **Adjuntar evidencias fotográficas (Crucial):** Utilice el botón de adjuntar o la cámara de su dispositivo móvil para capturar y subir fotos del trabajo realizado, del estado de la planta, o de problemas detectados (plagas, enfermedades). Esto es fundamental para el seguimiento remoto por parte de los técnicos.
9. Haga clic en **"Guardar Actividad"**. La información quedará inmutable y enlazada a la bitácora del cultivo.

---

## 7. Reportes

La información recopilada en SIGIC se transforma en conocimiento a través de los reportes automatizados, los cuales son esenciales para la toma de decisiones gerenciales, las auditorías de calidad y la sustentabilidad económica.

### 7.1 Bitácora de actividades
Es el historial detallado y cronológico de absolutamente todo lo que ha sucedido en la finca.
- **Filtros avanzados:** Puede filtrar la bitácora por rango de fechas, por parcela específica, por tipo de cultivo, por tipo de actividad o por el usuario que registró la acción.
- **Exportación:** Esta bitácora puede ser exportada a formato **PDF** (ideal para presentar en inspecciones de certificadoras agrícolas o autoridades sanitarias) o a **CSV** (para importación en otros sistemas informáticos o análisis detallado de datos).

### 7.2 Inventario de parcelas
Un reporte de estado que consolida la situación actual de sus tierras.
- Muestra qué parcelas están ocupadas, qué cultivo tienen, la fecha estimada de cosecha y el rendimiento proyectado basado en la variedad plantada.
- **Exportación:** Disponible en **PDF** para lectura rápida y en **Excel (.xlsx)** para que los administradores puedan realizar cálculos adicionales de planificación de espacios y rotación de cultivos.

### 7.3 Resumen ejecutivo
Un reporte de alto nivel diseñado específicamente para los administradores o dueños de la explotación agrícola.
- Combina datos de costos (insumos utilizados + horas de trabajo) vs. proyección de cosecha, entregando un cálculo estimado de rentabilidad por parcela.
- Incluye gráficos de pastel y barras que resumen la eficiencia de la operación y el estado general de salud del proyecto.

---

## 8. Funciones por rol

SIGIC implementa un estricto control de acceso basado en roles (RBAC) para garantizar que cada usuario vea y modifique solo la información pertinente a su responsabilidad.

| Funcionalidad / Pantalla | Agricultor (Operario de Campo) | Técnico (Ingeniero/Asesor) | Administrador (Gerente/Dueño) |
| :--- | :--- | :--- | :--- |
| **Dashboard** | Vista simplificada (sus tareas del día). | Vista analítica de parcelas a su cargo. | Control total, vista financiera y operativa general. |
| **Registro de Actividades** | Crear, adjuntar fotos. No puede borrar. | Crear, revisar y validar actividades de agricultores. | Control total. |
| **Parcelas y Cultivos** | Solo lectura (ver dónde debe trabajar). | Crear, editar y actualizar estados de ciclo. | Control total (crear, editar, eliminar). |
| **Inventario** | Registrar salidas (consumo). No ve costos. | Registrar salidas, solicitar abastecimiento. | Control total (compras, ajustes de inventario, costos). |
| **Calendario** | Ver tareas asignadas, marcar completadas. | Programar tareas para agricultores. | Control total sobre la planificación global. |
| **Reportes** | Sin acceso. | Acceso a bitácoras agronómicas. | Acceso total a todos los reportes, incluyendo financieros. |
| **Alertas** | Ver y reportar incidentes de campo. | Evaluar y resolver alertas fitosanitarias. | Configurar reglas de alertas, gestión del sistema. |
| **Gestión de Usuarios** | Sin acceso. | Sin acceso. | Añadir, suspender y asignar roles a usuarios. |

---

## 9. Funciones avanzadas

Para llevar su gestión al siguiente nivel, SIGIC incorpora herramientas tecnológicas de punta.

### Mapa interactivo
Integrado en la vista de parcelas y el dashboard principal, este módulo utiliza cartografía digital (como Google Maps o Mapbox) para mostrar su finca desde una vista satelital.
- Los polígonos de las parcelas se dibujan sobre el mapa.
- El mapa se colorea mediante "mapas de calor" o códigos de colores para indicar el estado de los cultivos (ej. verde: saludable, amarillo: requiere atención, rojo: alerta crítica o cosecha inminente).

### Asistente IA (Inteligencia Artificial)
SIGIC cuenta con un bot conversacional integrado entrenado en conocimientos agronómicos y en la documentación del propio sistema.
- **Consultas del sistema:** "¿Cómo exporto el reporte de inventario a Excel?".
- **Soporte agronómico:** "Mi cultivo de tomate presenta manchas negras en las hojas, ¿qué podría ser y qué insumo de mi inventario recomiendas usar?". El asistente procesará la consulta y ofrecerá orientación, aunque siempre se recomienda la validación de un Técnico.

### Trazabilidad mediante códigos QR
En la etapa de cosecha y embalaje, el sistema puede generar automáticamente un código QR para cada lote de producto.
- Al escanear este código con cualquier teléfono móvil, el comprador final o intermediario podrá visualizar una página web pública que detalla la historia del producto: lugar de origen (parcela), fecha de siembra, productos orgánicos aplicados, fecha de cosecha y certificaciones, garantizando transparencia y aumentando el valor comercial del producto agrícola.

---

## 10. Trabajo sin conexión (modo offline)

Entendemos que la agricultura se desarrolla en lugares donde la cobertura de red de telefonía móvil suele ser débil o inexistente. Por ello, SIGIC como PWA, ofrece un robusto modo offline.

**¿Cómo funciona?**
1. **Sincronización inicial:** Mientras esté en un área con buena conexión (como la oficina o su casa), abra la aplicación SIGIC. El sistema descargará la base de datos esencial (parcelas, catálogos de insumos, tareas pendientes) a la memoria de su dispositivo.
2. **Desplazamiento al campo:** Cuando vaya al campo y pierda la señal, notará un pequeño ícono de un satélite desconectado o un texto indicando "Modo Offline" en la barra superior.
3. **Registro continuo:** Usted puede continuar utilizando la aplicación normalmente. Puede registrar actividades, consumir inventario, tomar fotos y completar tareas del calendario.
4. **Almacenamiento local:** Todos estos datos se guardarán temporalmente y de forma segura en la memoria interna de su dispositivo.
5. **Sincronización automática:** Al regresar a una zona con cobertura Wi-Fi o datos móviles, la aplicación detectará automáticamente la conexión y comenzará a enviar toda la información guardada a la nube. Un mensaje de "Sincronización completada con éxito" le confirmará que sus datos están seguros en los servidores centrales.

**Precaución:** Es vital no cerrar sesión (Logout) ni borrar el caché del navegador mientras esté en modo offline, ya que esto podría resultar en la pérdida de los datos registrados que aún no se han sincronizado con la nube.

---

## 11. Solución de problemas frecuentes (FAQ)

Aquí agrupamos las respuestas a las incidencias más comunes que los usuarios pueden experimentar, para que pueda solucionarlas rápidamente.

**P1. No puedo iniciar sesión, el sistema dice "Credenciales incorrectas".**
*Respuesta:* Verifique que está ingresando el correo exacto con el que se registró. Revise que la tecla de "Bloqueo de Mayúsculas" (Caps Lock) no esté activada accidentalmente al escribir su contraseña. Si el problema persiste, utilice el enlace "¿Olvidaste tu contraseña?" para restablecerla.

**P2. La aplicación está muy lenta al cargar los mapas.**
*Respuesta:* La carga de mapas interactivos consume un ancho de banda considerable. Si su conexión a internet es inestable, la carga se ralentizará. Intente conectarse a una red Wi-Fi más fuerte. Si está en el campo, el sistema operará más rápido limitándose a los datos en texto sin cargar las capas satelitales complejas.

**P3. Registré una actividad en el campo (offline), pero el administrador no la ve en el reporte.**
*Respuesta:* Es probable que su dispositivo aún no haya sincronizado los datos. Asegúrese de abrir la aplicación SIGIC estando conectado a una red de internet estable y espere un par de minutos hasta que desaparezca el indicador de "Modo Offline" y aparezca el mensaje de sincronización exitosa.

**P4. ¿Cómo instalo SIGIC en mi teléfono celular si no está en la App Store o Google Play?**
*Respuesta:* SIGIC es una PWA. Abra el navegador (Chrome en Android, Safari en iOS), ingrese a https://sigic.app, inicie sesión, abra el menú de opciones de su navegador y seleccione **"Añadir a la pantalla de inicio"** o "Instalar aplicación". Aparecerá un ícono junto a sus demás apps y funcionará exactamente igual.

**P5. Equivoqué la cantidad de fertilizante al registrar la actividad, ¿puedo corregirlo?**
*Respuesta:* Si usted tiene el rol de Agricultor, no podrá editar actividades pasadas para garantizar la inmutabilidad de los datos. Deberá contactar a su Técnico o Administrador, quienes tienen los privilegios necesarios para editar el registro en la bitácora y ajustar el inventario.

**P6. No recibo las alertas por correo electrónico.**
*Respuesta:* Primero, revise la carpeta de "Spam" o "Correo no deseado" de su proveedor de email y marque los correos de SIGIC como "Seguros" o "No es Spam". Segundo, vaya a la configuración de su Perfil en la aplicación y verifique que las notificaciones por correo electrónico estén activadas.

**P7. ¿El Asistente de Inteligencia Artificial tiene costo adicional?**
*Respuesta:* En la versión SIGIC v1.0, el Asistente IA está incluido sin costo adicional dentro de los límites de uso justo estipulados para cada tipo de suscripción o licencia de la finca.

**P8. Las fotos que tomo de las plagas no se suben al sistema.**
*Respuesta:* Si la foto es demasiado grande o de una resolución muy alta (ej. cámaras modernas de 48MP+), y su conexión a internet es débil, la carga fallará. Recomendamos configurar su cámara para tomar fotos en una resolución media o esperar a estar conectado a una red Wi-Fi para que la sincronización de archivos pesados se realice sin interrupciones.

---

## 12. Glosario de términos

Para asegurar una comprensión homogénea del sistema, definimos los siguientes términos de uso frecuente en SIGIC:

- **Bitácora:** Cuaderno o registro digital de carácter cronológico donde se anotan todas las incidencias y actividades relacionadas con un cultivo.
- **Dashboard:** Panel de control o tablero de instrumentos principal que resume la información crítica del sistema de forma visual.
- **Fitosanitario:** Relativo a la prevención y curación de las enfermedades de las plantas.
- **Insumo:** Todo aquel producto (semilla, fertilizante, agroquímico) necesario para el desarrollo de la producción agrícola.
- **Modo Offline:** Capacidad del sistema para funcionar y recibir datos sin necesidad de conexión a internet.
- **Parcela:** Porción de terreno, normalmente delimitada y separada de otras, dedicada al cultivo. Es la unidad geográfica base del sistema.
- **PWA (Progressive Web App):** Aplicación web que utiliza capacidades web modernas para ofrecer una experiencia de usuario similar a la de las aplicaciones nativas.
- **RBAC (Role-Based Access Control):** Control de acceso basado en roles. Método de seguridad informática que restringe el acceso a la información según el rol del usuario.
- **Trazabilidad:** Capacidad de seguir el rastro y el histórico de un producto agrícola desde su siembra hasta su cosecha y distribución.

---
*Fin del Documento.*
*Para soporte técnico adicional, por favor contacte a su administrador de sistema o envíe un correo a soporte@sigic.app.*
