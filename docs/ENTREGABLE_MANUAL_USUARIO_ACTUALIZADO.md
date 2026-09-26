# Manual de usuario — Gestión Inteligente de Cultivos

## 1. Alcance y requisitos
La aplicación gestiona parcelas, siembras, actividades, inventario y avisos. Funciona en navegador actualizado (Chrome, Edge, Firefox o Safari), computador/tableta/teléfono, conexión a Internet y cuenta activa. Permita ubicación solo si desea completar GPS y notificaciones del navegador solo si desea avisos push.

**Pantalla común:** menú lateral con Dashboard, Parcelas, Cultivos, Mapa, Inventario y Alertas. El menú puede variar según el rol.

## 2. Acceso (todos los roles)
1. Abra la URL entregada por la organización.
2. En **Acceder**, escriba correo y contraseña y pulse **Entrar**.
3. Para una cuenta nueva use **Crear cuenta**; el rol inicial es agricultor hasta que administración lo cambie.
4. Para recuperar acceso seleccione **¿Olvidaste tu contraseña?** y siga el correo recibido.

## 3. Agricultor
### Parcelas
1. Abra **Parcelas** > **Nueva parcela**.
2. Complete nombre y área; suelo, GPS y notas son opcionales. Pulse **Crear**.
3. Para editar/eliminar, abra el menú **⋮** de la tarjeta. Eliminar borra permanentemente sus cultivos, actividades, costos y cosechas dependientes.
4. En **Mapa**, abra el marcador/polígono y use **Eliminar parcela** para la misma operación.

### Cultivos y siembra
1. Abra **Cultivos** > **Nuevo cultivo**.
2. Seleccione parcela, tipo y fecha de siembra.
3. Fecha de hoy o pasada crea estado **Sembrado**. Fecha futura crea **Planeado**. Las fechas pasadas están permitidas para registrar trabajo ya realizado.
4. En la fecha planificada verá una alerta. Abra el cultivo y pulse **Confirmar inicio**; solo esa acción lo cambia a Sembrado.

### Inventario y alertas
1. En **Inventario**, cree el insumo y registre entradas/salidas.
2. Revise **Alertas**: **Automáticas** incluye stock/siembra; **De tu técnico** muestra avisos manuales. Puede atender o descartar un aviso.
3. El agricultor solo recibe avisos: no dispone de botón para crear notificaciones.

## 4. Técnico
Puede consultar exclusivamente agricultores asignados por administración. En **Alertas** pulse **Enviar aviso**, seleccione un destinatario y redacte el mensaje. El selector solo muestra agricultores asignados; el servidor vuelve a validar esa relación. No comparta credenciales ni intente notificar usuarios fuera de la asignación.

## 5. Administrador
En **Administración** puede asignar roles, relacionar técnico-agricultor y abrir reportes. En **Configuración automática de alertas** ajuste días de anticipación, active/desactive stock bajo y defina el **umbral global de stock**; guarde y use **Regenerar alertas** si necesita ejecutar el cálculo inmediatamente.

## 6. Preguntas frecuentes
| Situación | Solución |
|---|---|
| No veo una parcela | Confirme sesión/rol, busque por nombre y recargue. Técnico: pida asignación al administrador. |
| No puedo eliminar | Solo dueño o administrador pueden hacerlo; confirme el mensaje de error. |
| Cultivo futuro aparece planeado | Es correcto; confirme inicio cuando llegue la fecha. |
| No recibí alerta de stock | Verifique stock, umbral, alertas activas y espere el cron diario o pida al admin regenerarlas. |
| Técnico no ve destinatario | El administrador debe crear la asignación técnico-agricultor. |
