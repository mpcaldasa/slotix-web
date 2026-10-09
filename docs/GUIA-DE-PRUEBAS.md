# Guía de usuario y pruebas E2E de Slotix

Esta guía permite recorrer desde el navegador las funciones que hoy ofrece el frontend y su API. Úsala en una base local desechable. Las acciones de alta, suspensión, bloqueo y eliminación cambian datos reales; prepara identidades y recursos de prueba antes de empezar.

## 1. Preparar el entorno

Requisitos: macOS, Linux o Windows con Node.js 22.22.3+, npm 11, Java compatible con el backend, Docker y Docker Compose. Ejecuta desde la carpeta `slotix-web`:

```bash
npm ci
docker compose -f ../reservation-core/docker-compose.yml up -d postgres
```

En otra terminal inicia el backend y luego el frontend:

```bash
cd ../reservation-core
./mvnw spring-boot:run
```

```bash
cd ../slotix-web
npm start
```

Abre `http://localhost:4200`. La app solicita `/api/...` y el proxy de Angular lo dirige a `http://localhost:8080`. Comprueba `http://localhost:8080/actuator/health/readiness`: debe responder estado `UP`. Swagger está en `http://localhost:8080/swagger-ui.html`.

No se distribuyen credenciales de demostración. Para una base vacía, sigue una sola vez el bootstrap descrito en `../reservation-core/README.md`: define `APP_BOOTSTRAP_PLATFORM_ADMIN_ENABLED=true`, `APP_BOOTSTRAP_PLATFORM_ADMIN_EMAIL`, `APP_BOOTSTRAP_PLATFORM_ADMIN_PASSWORD` y, opcionalmente, `APP_BOOTSTRAP_PLATFORM_ADMIN_FULL_NAME`; inicia el backend y desactiva el bootstrap después. Solo crea el primer administrador de plataforma si aún no existe. No pegues contraseñas, JWT ni tokens en tickets, capturas o terminales compartidas.

## 2. Ubicación y roles

La barra superior identifica el ámbito y el rol de la sesión. La barra lateral muestra las secciones disponibles. Cambiar entre la aplicación de plataforma y una compañía requiere iniciar sesión con la identidad apropiada; no existe cambio de compañía en la API.

| Etiqueta en Slotix | Rol del backend | Puede probar |
| --- | --- | --- |
| **PLATAFORMA · Administrador de plataforma** | `PLATFORM_ADMIN` | Compañías, usuarios globales, auditoría y notificaciones fallidas. No sustituye una membresía de compañía. |
| **COMPAÑÍA · Administrador de compañía** | `COMPANY_ADMIN` | Miembros, recursos, horarios, bloqueos, políticas, asignaciones y todas las operaciones de reservas de la compañía. |
| **COMPAÑÍA · Gestor de reservas** | `BOOKING_MANAGER` | Recursos y horarios de consulta, reservas, aprobación y asistencia. No administra miembros ni políticas. Puede reservar para otra persona solo con un ID conocido. |
| **COMPAÑÍA · Usuario de compañía** | `CUSTOMER` | Recursos visibles para clientes y sus propias reservas. No administra la compañía ni ve las reservas de otras personas. |

Los permisos de la interfaz orientan, pero el backend vuelve a comprobar el rol, la compañía, la cuenta y la membresía en cada petición. Una cuenta de plataforma no gana acceso a los datos de una compañía por ser `PLATFORM_ADMIN`.

## 3. Preparar datos de prueba

1. Inicia sesión como administrador de plataforma.
2. En **Compañías**, pulsa **Crear compañía con administrador**. Completa razón social, nombre visible, slug corto, correo de contacto y los datos del administrador inicial. Guarda el **identificador único de la compañía** que aparece en el listado. El servidor fija zona `America/Bogota` y moneda `COP`.
3. Cierra sesión y entra desde **Acceso de compañía** con ese identificador, el correo del administrador y su contraseña.
4. En **Miembros y acceso**, crea una cuenta de prueba con rol **Gestor de reservas** y otra con rol **Cliente**. Guarda sus correos y contraseñas en un gestor local. Para probar varios roles, crea una segunda membresía `COMPANY_ADMIN` y nunca suspendas todos los administradores activos.
5. En **Recursos**, crea un recurso de prueba con capacidad `1`, visibilidad `MEMBERS` y estado inicial `DRAFT`. Abre el detalle, actívalo y añade una regla semanal para el día que vas a probar. El fin debe ser posterior al inicio; no se admiten reglas nocturnas que crucen medianoche.
6. En **Políticas**, crea una política de prueba: duración mínima `30`, máxima `120`, incremento `30`, anticipación mínima `0`, máxima `30` días, aviso de cancelación `0`, aprobación requerida **Sí** y cancelación por cliente **Sí**. En el detalle del recurso asígnala desde una fecha futura con offset explícito, por ejemplo `2026-10-10T00:00:00-05:00`.
7. Para probar reservas confirmadas automáticamente, crea un segundo recurso y asígnale una segunda política idéntica salvo **Requiere aprobación: No**. Las políticas quedan inmutables tras asignarlas; crea otra en vez de editar sus términos.

Un recurso sin horario, política vigente o disponibilidad no producirá opciones reservables. Las reglas y disponibilidad usan el día/hora de la compañía. Los instantes de reservas y bloqueos deben conservar su zona explícita; no los conviertas a la zona del navegador.

## 4. Autenticación y acceso

### 4.1 Compañía

**Rol:** público para iniciar sesión; la cuenta debe tener usuario, compañía y membresía activos.

1. Abre `/login`.
2. Ingresa el identificador único de compañía, correo y contraseña.
3. Confirma que aparece la sección **Reservas** y la barra superior dice **COMPAÑÍA** con el rol correcto.
4. Repite con contraseña incorrecta: se muestra un error sin revelar si la cuenta está suspendida o no existe.
5. Como cliente, intenta abrir `/members` o `/policies`: debe aparecer acceso denegado. La navegación tampoco muestra esas opciones.
6. Pulsa **Cerrar sesión** y confirma. Se limpia el contexto local y regresas al acceso.

### 4.2 Plataforma

**Rol:** `PLATFORM_ADMIN`.

1. Abre `/platform/login`, separado del acceso de compañía.
2. Ingresa correo y contraseña de la identidad global con rol de plataforma.
3. Verifica el rótulo **PLATAFORMA · Administrador de plataforma** y las secciones **Compañías**, **Usuarios globales** y **Operaciones**.
4. Abre `/members`: la app debe rechazar esa ruta porque el token de plataforma no incluye una compañía autorizada.

### 4.3 Recuperar contraseña y aceptar invitación

**Rol:** público; depende del correo configurado en el backend.

1. Desde el login pulsa **¿Olvidaste tu contraseña?**, ingresa el correo y envía la solicitud.
2. Slotix confirma la recepción con el mismo mensaje para cuentas existentes, inexistentes o con correo deshabilitado. Confirma la entrega en el buzón solo si SMTP está configurado.
3. Usa el enlace con token para definir una nueva contraseña dentro de 30 minutos. El token es de un solo uso y las sesiones anteriores quedan invalidadas.
4. Para invitaciones, un administrador debe enviar una invitación con correo habilitado. Abre el enlace recibido dentro de siete días, define nombre y contraseña, y acepta. Inicia sesión en la compañía invitante.

El backend no ofrece una lista, reenvío ni revocación de invitaciones. Si SMTP no está habilitado, usa **Crear cuenta y miembro** para completar las pruebas locales.

## 5. Administración de plataforma

### 5.1 Alta de compañía con administrador inicial

**Rol:** `PLATFORM_ADMIN`.

1. En **Compañías**, pulsa **Crear compañía y administrador**.
2. Completa razón social, nombre visible, slug y correo de contacto.
3. Para crear al administrador, completa correo, nombre y contraseña (8–72 caracteres). Alternativamente vincula un usuario global activo con su ID; no combines las dos opciones.
4. Guarda y verifica una compañía activa con su zona y moneda, y la identidad administradora inicial.
5. Inicia sesión en esa compañía con las credenciales y prueba sus funciones.

### 5.2 Compañía pendiente e inicialización

**Rol:** `PLATFORM_ADMIN`.

1. En **Compañías**, pulsa **Crear compañía pendiente** y completa sus datos.
2. En la fila creada, prueba **Activar**.
3. Pulsa **Crear administrador inicial** en una compañía `PENDING` o `ACTIVE` que aún no tenga administrador. Registra un usuario nuevo o vincula uno existente.
4. Verifica que el acceso de compañía funcione después de completar los requisitos de cuenta.

El frontend no tiene edición, suspensión ni eliminación de compañías porque la API no ofrece esas operaciones.

### 5.3 Usuarios globales y roles de plataforma

**Rol:** `PLATFORM_ADMIN`.

1. Abre **Usuarios globales**; prueba la paginación de 20 filas.
2. En una identidad de prueba, concede el rol de administrador de plataforma y verifica que aparece en su lista de roles.
3. Revoca el rol de esa segunda cuenta de prueba y verifica el cambio.
4. Desactiva una identidad de prueba. Sus tokens dejan de servir en todas las compañías; vuelve a activarla y pide que inicie sesión de nuevo.
5. Prueba la protección del último administrador activo: la API debe rechazar su desactivación o revocación con conflicto. Conserva siempre al menos una identidad administradora activa.

La API no permite cambiar el correo o nombre global desde esta pantalla.

## 6. Miembros y roles de compañía

**Rol:** `COMPANY_ADMIN` solamente. El listado pagina 20 registros.

1. En **Miembros**, pulsa **Crear cuenta y miembro**. Completa correo, nombre, contraseña y uno o más roles. Verifica que aparece la membresía activa.
2. Pulsa **Invitar miembro**, elige uno o más roles y envía al correo de prueba. Acepta el enlace con la persona invitada (SMTP requerido).
3. Pulsa **Vincular usuario existente**. Ingresa el ID de una identidad global activa que no tenga membresía activa en esta compañía y los roles deseados.
4. En un miembro de prueba, abre **Editar roles** y reemplaza el conjunto completo de roles. Verifica que un gestor no ve **Miembros** ni **Políticas**.
5. Suspende una membresía. Sus peticiones quedan rechazadas; luego reactívala e inicia sesión otra vez.
6. Intenta suspender o quitar el rol del último administrador activo. Debe fallar con conflicto. Mantén al menos un `COMPANY_ADMIN` activo.

No existe búsqueda de miembros. Los gestores solo pueden reservar a otra persona si conocen su identificador único de usuario; no pueden consultar el directorio.

## 7. Recursos, horarios y bloqueos

### 7.1 Crear y mantener recursos

**Crear/editar/activar/desactivar/eliminar:** `COMPANY_ADMIN`. **Consultar catálogo:** administrador, gestor y cliente con recursos autorizados.

1. Ve a **Recursos** y pulsa **Crear recurso**.
2. Completa nombre, descripción opcional, tipo (`SPACE`, `PERSON`, `EQUIPMENT`, `SERVICE_RESOURCE` u `OTHER`), capacidad y visibilidad (`PUBLIC`, `MEMBERS` o `PRIVATE`). Todos requieren sesión de compañía; `PUBLIC` no es catálogo anónimo.
3. Guarda: el recurso nace como borrador. Ábrelo desde su nombre, revisa el detalle y pulsa **Activar**.
4. En la lista prueba **Buscar por nombre**, **Actualizar** y los controles de página. El texto de búsqueda y la página quedan en la URL; la API entrega el catálogo completo sin paginar.
5. Como `CUSTOMER`, confirma que los recursos privados no aparecen. Con `COMPANY_ADMIN` o `BOOKING_MANAGER`, comprueba que sí se pueden inspeccionar según permisos.
6. Edita nombre/descripción/capacidad/visibilidad. Para probar el conflicto de capacidad, crea una reserva futura activa y trata de bajar la capacidad por debajo de la ocupación.
7. Desactiva el recurso y comprueba que no se ofrecen nuevos horarios. Reactívalo para las pruebas siguientes.
8. Elimina únicamente un recurso descartable sin reservas futuras activas. La eliminación es lógica e irreversible; conserva el historial.

No hay detalle separado en la API: la pantalla resuelve el recurso desde el catálogo autorizado. No existe acción directa para poner estado `MAINTENANCE`.

### 7.2 Horario semanal

**Rol:** `COMPANY_ADMIN` escribe; administrador, gestor y cliente pueden consultar.

1. En el detalle del recurso, dentro de **Horarios y bloqueos**, pulsa **Añadir horario**.
2. Elige día (domingo=0, lunes=1, … sábado=6), hora local inicial y final, y fechas de vigencia opcionales.
3. Guarda. Edita una regla y luego elimínala en un recurso de prueba.
4. Intenta fin igual o anterior al inicio y verifica validación. Para cubrir horario que cruza medianoche, divide el horario entre dos días.
5. Consulta una reserva: la disponibilidad debe contener solo horarios producidos por las reglas activas, políticas y bloqueos.

### 7.3 Bloqueos

**Rol:** `COMPANY_ADMIN` escribe; administrador, gestor y cliente pueden consultar.

1. En el mismo detalle pulsa **Añadir bloqueo**.
2. Ingresa inicio y fin ISO-8601 con offset UTC (`-05:00` en Bogotá), motivo y tipo `MAINTENANCE`, `CLOSURE` o `ADMIN_BLOCK`.
3. Guarda y verifica que no se ofrezcan slots que se solapen.
4. Edita el motivo/intervalo y elimina el bloqueo de prueba. Comprueba que los slots vuelven a estar disponibles.

## 8. Políticas y vigencias

**Rol:** `COMPANY_ADMIN` solamente. La lectura de asignaciones está disponible para miembros con acceso al recurso.

1. Abre **Políticas** y pulsa **Crear política**.
2. Define duración mínima/máxima, incremento, anticipación mínima en minutos, máxima en días, aviso de cancelación, si requiere aprobación y si permite cancelar al cliente.
3. Valida que duración mínima y máxima sean múltiplos del incremento y que la mínima no supere la máxima.
4. Guarda y activa/desactiva una política no asignada.
5. Edita una política antes de asignarla. Una vez asignada alguna vez, sus términos son inmutables incluso cuando termina la vigencia.
6. Regresa al detalle del recurso. Pulsa **Asignar política**, elige una política activa y especifica inicio y fin opcional con offset explícito.
7. Comprueba que una vigencia no pueda solaparse con otra. Reemplaza una política en una vigencia futura, acorta un fin y elimina una asignación futura sin reservas activas.
8. Prueba el rechazo de cierre, reemplazo o eliminación cuando una reserva activa dependa del intervalo.

No se puede eliminar una política. La pantalla de asignaciones muestra política e intervalo; el backend no da los términos completos de la política a gestores o clientes.

## 9. Reservas: disponibilidad, lista y calendario

**Crear, listar, detalle y reprogramar/cancelar:** administrador, gestor y cliente. El cliente solo ve sus reservas. **Aprobar, rechazar, ingreso, finalizar y ausencia:** administrador o gestor.

### 9.1 Crear una reserva

1. Comprueba que el recurso esté activo, tenga horario y política vigentes y capacidad libre.
2. En **Reservas**, pulsa **Nueva reserva**.
3. Elige recurso, fecha de la compañía, duración permitida por la política y notas opcionales.
4. Si eres administrador o gestor y reservas para un cliente, puedes agregar su ID conocido. Deja vacío para reservar para ti. El cliente siempre reserva para sí mismo.
5. Pulsa **Consultar disponibilidad**, elige un horario devuelto por el servidor y pulsa **Reservar este horario** una sola vez.
6. Confirma el detalle creado. La política produce `PENDING` si exige aprobación o `CONFIRMED` si no la exige.
7. Si aparece **Horario ocupado**, otro proceso tomó el slot: consulta de nuevo y escoge una opción actual. No reintentes con datos distintos suponiendo que la reserva original falló.

Slotix envía una clave de idempotencia y bloquea el botón mientras guarda. Si ocurre una falla de red, revisa **Reservas** antes de repetir; el servidor puede haber recibido la primera solicitud.

### 9.2 Lista, calendario, filtros y detalle

1. Usa **Lista** y **Calendario** en el encabezado; el modo activo se resalta y se anuncia al lector de pantalla.
2. Ajusta **Desde** y **Hasta**, pulsa **Actualizar** y confirma que el enlace conserva fechas en la URL.
3. Abre una reserva desde **Ver detalle** o desde un elemento del calendario. Revisa estado, recurso, horarios con la zona de la compañía, cliente, notas y datos de cancelación si existen.
4. Prueba un intervalo de hasta 31 días. El backend rechaza rangos mayores; no hay paginación de reservas.
5. Con un cliente, confirma que solo aparece su propia reserva. Al abrir el detalle de otra persona, la API responde acceso denegado.

### 9.3 Transiciones de estado

Usa reservas separadas para que cada transición empiece en el estado correcto.

| Estado inicial | Acción | Rol | Resultado esperado |
| --- | --- | --- | --- |
| `PENDING` | Aprobar | `COMPANY_ADMIN` o `BOOKING_MANAGER` | `CONFIRMED` |
| `PENDING` | Rechazar | `COMPANY_ADMIN` o `BOOKING_MANAGER` | `REJECTED` |
| `PENDING` o `CONFIRMED` | Cancelar | Cualquiera autorizado; gerente/admin incluye motivo | `CANCELLED`, si la política lo permite |
| `PENDING` o `CONFIRMED` | Reprogramar | Cliente propietario sujeto a política; admin/gestor | Nuevo intervalo validado por el servidor |
| `CONFIRMED` durante su intervalo | Registrar ingreso | `COMPANY_ADMIN` o `BOOKING_MANAGER` | `CHECKED_IN` |
| `CHECKED_IN` después del ingreso | Finalizar uso | `COMPANY_ADMIN` o `BOOKING_MANAGER` | `COMPLETED` |
| `CONFIRMED` al terminar el intervalo o después | Marcar ausencia | `COMPANY_ADMIN` o `BOOKING_MANAGER` | `NO_SHOW` |
| `PENDING` sin aprobar hasta vencer el tiempo límite | Sin acción manual | Proceso del servidor | `EXPIRED` (por defecto, 30 min) |

Para ingreso y ausencia respeta la hora del servidor; no adelantes el reloj del navegador. Si no puedes esperar a que venza una reserva, registra este caso como dependiente de tiempo y pruébalo en un ambiente de QA controlado con datos preparados por backend. No existe un botón para forzar `EXPIRED`.

## 10. Operaciones de plataforma

**Rol:** `PLATFORM_ADMIN` solamente. Los filtros y páginas quedan en la URL.

### Auditoría

1. Abre **Operaciones** y selecciona **Auditoría**.
2. Filtra por ID de compañía, acción, tipo de entidad o ID de entidad. Confirma que la búsqueda muestra registros recientes y permite paginar.
3. Abre snapshots anterior/posterior, si existen. Deben representarse como texto seguro, nunca como HTML ejecutable.

### Entregas de notificación

1. Cambia a **Entregas**; por defecto se consultan las fallidas.
2. Prueba estados `PENDING`, `SENDING`, `SENT` y `FAILED`, además de páginas.
3. En una fila `FAILED`, pulsa **Reintentar entrega** y confirma que el estado se vuelve a encolar (`PENDING`).
4. Confirma que otros estados no ofrecen reintento. Un reintento solo vuelve a poner la tarea en la cola; no demuestra que el correo se entregó.

El correo está deshabilitado por defecto. Si no aparecen fallos, configura un proveedor SMTP de pruebas o carga un caso fallido mediante fixtures aprobadas del backend. No hay una acción de frontend para inventar entregas.

## 11. Pruebas de límites y recuperación

| Caso | Cómo probar | Resultado que debes anotar |
| --- | --- | --- |
| Sesión expirada | Espera la expiración del JWT o usa una identidad vencida en QA | Sesión local limpia, aviso de volver a entrar; no existe renovación automática |
| Acceso prohibido | Cliente abre `/members`; gestor abre `/policies`; usuario de compañía abre operación de plataforma | Acción no disponible en navegación y ruta denegada; API sigue siendo la autoridad |
| Cambios de rol durante la sesión | Cambia/suspende la membresía desde otra sesión y vuelve a cargar una pantalla protegida | Backend devuelve 401/403 según el caso; inicia sesión de nuevo si la identidad fue revocada |
| Conflicto de disponibilidad | Dos usuarios eligen el mismo slot y guardan con poca diferencia | Solo una reserva gana; la otra recibe conflicto y actualiza la disponibilidad |
| Doble clic / respuesta de red incierta | Intenta enviar varias veces o desconecta la red después del envío | Un solo envío a la vez; verifica la lista antes de reintentar la misma petición |
| Último administrador | Intenta suspender o quitar el rol del único admin activo en plataforma/compañía | El servidor protege al último; registra el código de conflicto |
| Recurso ocupado | Elimina o reduce capacidad con reservas futuras activas | El backend bloquea la mutación y conserva el recurso/reservas |
| Cambio de política ocupada | Acorta, reemplaza o borra una asignación con reservas activas | El backend responde conflicto; las condiciones históricas siguen vigentes |
| Fallo de red | Detén temporalmente API o proxy mientras consultas | Mensaje recuperable, formulario conservado cuando aplica; reintento manual de lectura |

La mayoría de errores usa el sobre `{status,code,error,fields}`. Anota código y paso sin copiar tokens ni datos personales. No asumas éxito hasta ver la respuesta confirmada en la lista o detalle.

## 12. Lista de recorrido E2E completo

Marca cada casilla en una base limpia o de QA antes de dar una versión por probada:

- [ ] Readiness `UP`; login de plataforma y de compañía; cierre de sesión y expiración.
- [ ] Recuperación de contraseña y aceptación de invitación con SMTP de pruebas.
- [ ] Alta de compañía activa con admin; compañía pendiente, activación e inicialización posterior.
- [ ] Usuarios globales: paginación, rol de plataforma, quitar rol, desactivar/reactivar y último admin.
- [ ] Miembros: crear, invitar, vincular ID, cambiar roles, suspender/reactivar y último admin.
- [ ] Recurso borrador: editar, activar, visibilidad por rol, desactivar/reactivar y eliminación segura.
- [ ] Horario semanal: crear, editar, borrar, vigencia y validación de horas.
- [ ] Bloqueo: crear, editar, borrar y efecto en disponibilidad.
- [ ] Política: validar límites, activar/desactivar, editar antes de asignar y proteger inmutabilidad histórica.
- [ ] Asignación: asignar, reemplazar, acortar, borrar futura y conflicto con reserva activa.
- [ ] Reserva: disponibilidad, alta pendiente, aprobación, rechazo, confirmación automática y prevención de duplicados.
- [ ] Reserva: lista, calendario, filtros URL, detalle, cancelación, reprogramación y permisos por propietario.
- [ ] Reserva: ingreso, finalización, ausencia y expiración automática dependiente de tiempo.
- [ ] Operaciones: filtros/paginación de auditoría, estados de notificación y reintento fallido.
- [ ] Errores: 401, 403, 409, validación, red; responsive móvil/escritorio y navegación por teclado.

## 13. Automatización disponible y alcance real

Desde `slotix-web` ejecuta:

```bash
npm run contract:check
npm run typecheck
npm run lint
npm test
npm run build
npm run e2e
```

`npm run e2e` prueba flujos críticos en Chromium y móvil con API simulada, incluyendo autenticación, permisos, validación de reserva, estados y accesibilidad. Es una prueba de interfaz; no sustituye la sesión real ni los recorridos manuales anteriores. `npm run e2e:real` ejecuta integración con los usuarios locales configurados en `/private/tmp/slotix-qa-credentials.json`; requiere backend/DB locales, crea datos de QA y no debe apuntar a producción.

En el entorno local revisado el 9 de octubre de 2026, pasaron typecheck, lint, build y 29 tests unitarios. También pasaron 14 pruebas E2E de interfaz en Chromium y móvil con API simulada. El build mostró rutas diferidas para recursos, reservas, plataforma, operaciones, miembros, autenticación y políticas.

La prueba E2E contra el backend no pudo completar el inicio de sesión con la identidad QA disponible: el login respondió `401 INVALID_CREDENTIALS`. Readiness sí respondió `UP`, y una consulta de solo lectura encontró un administrador de plataforma activo en PostgreSQL; por eso no se ejecutó el bootstrap ni se intentó cambiar su contraseña. Para habilitar el recorrido real, solicita al responsable de esa base las credenciales vigentes de la identidad autorizada y vuelve a correr `npm run e2e:real`. La prueba real todavía no verificó onboarding ni reservas en este intento.

Para tu corrida, guarda salida y fecha; no marques pruebas no ejecutadas como aprobadas.

## 14. Límites actuales del contrato

La app respeta las capacidades disponibles. La API no ofrece perfil/sesión actual, renovación de JWT, cambio de compañía, edición o baja de compañía, búsqueda de miembros, administración de invitaciones pendientes, ficha independiente de recurso/política, políticas visibles al cliente, catálogo anónimo, vista global de reservas, pagos ni facturación. La zona se fija actualmente en `America/Bogota`; el backend no ofrece cambiarla. El calendario acepta como máximo 31 días. Las tareas de correo requieren SMTP configurado. Estos puntos no se deben simular en pruebas como si hubieran sido operaciones exitosas.
