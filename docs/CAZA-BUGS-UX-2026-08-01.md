# Caza de bugs y mejoras de UX — VetCare

Fecha: 1 de agosto de 2026
Método: exploración de la app corriendo en local (`http-server` + Worker + D1 local con la
base real migrada: 4.734 pacientes, 3.473 tutores, 14.016 registros clínicos, 7.206 vacunas),
con cinco cuentas de prueba —dos administradores (Nito, Andrés), dos veterinarias
(rotativas) y una recepción— recorriendo los flujos de cada rol en escritorio y en un
viewport de 375 × 812.

Todo lo que sigue está verificado contra la app y los datos reales, no supuesto.
Los datos de prueba creados durante la auditoría fueron eliminados y `js/config.js`
quedó apuntando de nuevo a producción.

---

## Estado de implementación

**Completado en VetCare 2.16.0.** Los bloques A–G (A1–A10, B11–B18, C19–C24,
D25–D27, E28, F29–F34 y G35–G40) quedaron implementados. La entrega incluye la
migración de esquema 0018, carga inicial liviana con historia clínica por paciente,
tests de permisos e integridad y actualización de caché de los recursos web.

---

## Resumen

VetCare está mejor construida de lo que sugiere su tamaño: el cierre de consulta es
atómico y encadena aviso + recibo + turno, los permisos por rol se reflejan de verdad en
la interfaz, las fechas ya usan calendario local, la pantalla de respaldo explica el
estado de sincronización con claridad y los comentarios del código muestran criterio
(por ejemplo, no adivinar códigos de área para no mandarle un WhatsApp a un desconocido).

El problema no está en las funciones que faltan. Está en que **la app fue diseñada para
una base chica y ahora corre sobre una base de 4.734 pacientes**. Tres consecuencias
atraviesan casi todos los hallazgos:

1. **Identificar a un paciente es imposible.** El 72 % de los pacientes comparte nombre
   con otro. Todo el sistema los muestra sólo por nombre.
2. **El canal de contacto está roto en silencio.** Ninguno de los 3.417 teléfonos
   cargados sirve para WhatsApp, y los botones se muestran igual.
3. **Nadie distingue el trabajo de hoy del arrastre histórico.** 652 vencidos y 2.619
   pendientes viejos tapan los ocho turnos del día.

Priorizaría en ese orden. Las 40 mejoras están agrupadas por tema y ordenadas por impacto
dentro de cada grupo.

---

## A. Bloqueantes: cosas que hoy no funcionan

### A1. El botón de WhatsApp está roto para el 100 % de los tutores

`isLikelyFullPhone()` da `false` para **0 de 3.417** tutores con teléfono. Sin embargo los
botones WA se renderizan igual en Hoy, Avisos, Tutores, ficha del paciente y plan
sanitario, y producen enlaces como `wa.me/15649798` — que WhatsApp interpreta como un
número de otro país o directamente falla.

Peor: `cleanPhone()` toma **el primer** grupo con 6+ dígitos, que en los datos migrados
suele ser el fijo, no el celular.

| Teléfono guardado | Lo que arma la app | Lo que debería armar |
| --- | --- | --- |
| `42-5132 T 42-2392 15657545` | `wa.me/425132` (el fijo) | `wa.me/5492262657545` |
| `15649798` | `wa.me/15649798` | `wa.me/5492262649798` |
| `MARCELA 15406287 15507188` | `wa.me/15406287` | `wa.me/5492262406287` |

**Propuesta**
- Guardar código de país y área por defecto en Opciones (54 / 9 / 2262 para Necochea).
- Normalizar al vuelo: si el token empieza con `15` y tiene 8 dígitos, es celular local →
  `54 9 <área> <número sin el 15>`.
- Preferir el token con pinta de celular sobre el fijo, y ofrecer elegir cuando hay varios.
- **Mientras no se pueda armar un número válido, no mostrar el botón**: reemplazarlo por
  “Teléfono incompleto — corregir”, que abre la edición del tutor. Un botón que falla en
  silencio es peor que ningún botón.
- Pantalla única “Revisar teléfonos” con vista previa y confirmación masiva, para
  arreglar los 3.417 de una vez en lugar de uno por uno.

Referencias: `js/ui.js:69`, `js/followup.js:49`, `js/owners.js:29`, `js/owners.js:51`,
`js/reminders.js:23`, `js/reminders.js:139`, `js/sanitary.js:304`.

### A2. Elegir un paciente en un `<select>` de 4.735 opciones

“Nuevo turno”, “Nuevo turno de peluquería” y “Nuevo aviso” usan un `<select>` nativo con
todos los pacientes, mostrando **sólo el nombre**.

- 4.735 opciones en un desplegable.
- **3.418 pacientes (72 %) comparten nombre con otro.**
- 97 pacientes se llaman LOLA, 92 LUNA, 75 NN, 50 MILO, 47 MORA.

Es literalmente imposible elegir bien. En el celular es un scroll infinito.

**Propuesta**: reutilizar `assocPicker()` (`js/assoc.js`), que ya existe y ya busca, en
los cuatro lugares; y que la etiqueta sea **`NOMBRE · Especie · Tutor · última visita`**,
no sólo el nombre.

Referencias: `js/appointments.js:100`, `js/appointments.js:207`, `js/reminders.js:36`,
`js/invoices.js:107`.

### A3. La búsqueda global no permite distinguir pacientes

Buscar `lola` devuelve diez resultados visualmente idénticos:

```
LOLA · Perro · CANICHE TOY
LOLA · Perro · CANICHE TOY
LOLA · Perro · CANICHE TOY
...
```

Sin tutor, sin edad, sin última visita. Además los pacientes se agregan primero y
`results.slice(0,10)` corta antes de llegar a los tutores, así que un apellido que
también es nombre de mascota nunca muestra al tutor.

**Propuesta**: agregar el tutor y la última visita al subtítulo, agrupar por tipo
(Pacientes / Tutores / Turnos) con tope por grupo, y permitir buscar por DNI.

Referencia: `js/app-shell.js:41`.

### A4. Hacer clic en un tutor buscado no lo abre

`globalSearchGo('owner', id)` **descarta el id** y hace `navigateTo('owners')`. Buscás
“PERALTA”, hacés clic, y aterrizás arriba de todo en una lista de 3.473 tutores
encabezada por “ZOROZA MARCELA”. Lo mismo con los turnos.

**Propuesta**: abrir la ficha del tutor (`openOwnerModal(id)`) y, para turnos, abrir el
turno o al menos filtrar la agenda por ese registro.

Referencia: `js/app-shell.js:80`.

### A5. Ninguna lista está ordenada

El Worker hace `SELECT * FROM pets` **sin `ORDER BY`** (`backend/worker.ts:366`), así que
el orden es el de inserción de la migración. Resultado:

- **Tutores** arranca en “ZOROZA MARCELA”, después “BERNARD LEOPOLDO”, después “PAZ MARCELO”.
- **Pacientes** arranca con BALTO (25 años), CATALINA (34 años), FEDERICO (26 años):
  fichas de 2001-2003 que casi con seguridad ya no existen.

**Propuesta**: `ORDER BY name COLLATE NOCASE` en el servidor, y en Pacientes agregar
selector de orden (alfabético / última visita / pendientes) con **última visita** como
predeterminado, que es lo que le sirve a la veterinaria.

### A6. Los avisos “de los próximos 7 días” incluyen vencidos de cualquier antigüedad

```js
db.reminders.filter(r => !r.completed && new Date(r.date) <= in7)
```

Falta la cota inferior. Un aviso de 2024 sin completar aparece en la columna rotulada
“Sin avisos en los próximos 7 días”. El badge del menú lateral usa el mismo filtro.

**Propuesta**: separar “vencidos” de “próximos 7 días” con dos contadores, como ya hace
bien la pantalla de Avisos.

Referencias: `js/app-shell.js:142`, `js/app-shell.js:4`.

### A7. La auditoría le muestra a Nito nombres internos y no dice qué registro tocó

Entradas reales de la pantalla “Accesos y auditoría”:

```
close · clinical_encounter
Nito Escobar · 1/8/2026, 02:53:28 · Campos: encounter, appointment, reminder

Eliminación · pets
Admin Prueba · 31/7/2026, 06:05:07
```

Dos problemas: `_auditLabel()` no traduce `close` ni `password_reset`, y **no se muestra
`entity_id`**, que la API sí devuelve (`backend/worker.ts:427`). En una eliminación la
auditoría es el único rastro que queda, y no dice de qué paciente se trata.

**Propuesta**: traducir todas las acciones y tipos, resolver el id a un nombre legible
(“Eliminación · Paciente LOLA (tutor PERALTA)”), y agregar filtros por persona, fecha y
tipo, con paginación. Hoy son 100 entradas planas sin filtro y los inicios de sesión
entierran lo importante.

Referencia: `js/settings.js:135`, `js/settings.js:154`.

### A8. No hay validación de fechas ni de rangos clínicos

- `hDate` (fecha de la consulta) no tiene `max` → se puede cargar una consulta con fecha futura.
- `hNext` (próximo control) no tiene `min` → se puede indicar un control en el pasado.
- La fecha de nacimiento no tiene `max`: **hay 2 pacientes con nacimiento en el futuro**
  (LUFI 2026-09-10, BENICIO 2026-12-29) que la app muestra como “recién nacido”.
- `hWeight`, `hTemp`, `hHR` no tienen `min`/`max`: 250 kg en un gato entra sin chistar.

**Propuesta**: `max` en fechas hacia atrás, `min` en fechas hacia adelante, y rangos
plausibles por especie en signos vitales con aviso suave (“¿38,6 o 3,86?”), no bloqueo.

### A9. El cambio de rol se aplica sin confirmar

`onchange="changeUserRole(...)"` dispara en cuanto se suelta el `<select>`. En el celular,
un scroll sobre el desplegable cambia el rol de una persona sin que nadie lo pida.
(El servidor sí protege el caso “último administrador”, `backend/worker.ts:394`.)

**Propuesta**: confirmación explícita con nombre y rol destino antes de aplicar.

### A10. Escape no cierra los modales y no hay manejo de foco

Al abrir un modal el foco queda en `<body>`: no se enfoca el primer campo, no hay trampa
de foco (Tab se escapa a la página de atrás) y `Escape` no cierra. Para recepción, que
carga datos a máquina de escribir, esto obliga a usar el mouse en cada alta.

**Propuesta**: enfocar el primer campo al abrir, cerrar con `Escape`, enviar con
`Ctrl+Enter`, devolver el foco al elemento que abrió el modal, y usar `<dialog>` nativo o
un trap de foco.

---

## B. Trabajo diario y roles

### B11. El profesional es texto libre en cuatro formularios y nunca se precarga

`hVet` (consulta), `aVet` (turno), `sanVet` (vacuna/antiparasitario) y `gGroomer`
(peluquería) son `<input type="text">` vacíos. Con dos veterinarias rotando, cada una
tipea su nombre a mano en cada registro.

En la prueba bastó cargar “Dra. Laura Perez” y “laura perez” para tener dos profesionales
distintos en la agenda del mismo día. Consecuencia: **no se puede filtrar “mis turnos”,
ni medir cuántas consultas hizo cada una, ni saber quién firmó qué.**

**Propuesta**
- Convertirlo en un selector de usuarios activos, **precargado con la persona logueada**.
- Permitir texto libre sólo como excepción (suplencias), marcado como tal.
- Guardar también el `user_id`, no sólo el nombre.

Referencias: `js/pets.js:947`, `js/appointments.js` (modal de turno), `js/sanitary.js:143`,
`js/appointments.js` (modal de peluquería).

### B12. En “Hoy”, el trabajo de hoy queda debajo del arrastre histórico

Al abrir la app a las 9 de la mañana, lo primero que se ve son seis recordatorios de
vacunas vencidas en 2025, después “y 656 pendientes más en las fichas”, después “Revisar
2.619 pendientes antiguos”, y **recién ahí** los ocho turnos del día.

La jerarquía está invertida: lo urgente y accionable (los pacientes que vienen hoy) está
sepultado bajo una cola de 652 items que nadie va a resolver hoy.

**Propuesta**: turnos del día arriba, y “Continuidad clínica” colapsada a una franja
resumen (“652 vencidos · 10 hoy · 0 sin cerrar — Ver”) que se expande a pedido.

### B13. Los turnos no muestran profesional, tutor ni teléfono

La tarjeta de Hoy dice `CAMILA · Programado · 09:00 · Consulta`. Nada más. Laura no puede
saber cuáles son sus pacientes, y si alguien no llega no hay a quién llamar sin abrir dos
pantallas.

**Propuesta**: agregar profesional, tutor y acceso directo a llamar/WA en la tarjeta y en
la fila de la tabla; y un filtro “Mis turnos” que use el usuario logueado.

### B14. No hay detección de superposición

En la prueba cargué dos turnos a las 09:30 con la misma veterinaria. La app los aceptó y
los mostró uno debajo del otro, sin ninguna marca.

**Propuesta**: al guardar, avisar si el profesional ya tiene un turno solapado
(considerando la duración, que ya se registra pero no se usa para nada); y en el
calendario diario, mostrar el solapamiento visualmente.

### B15. Turnos, Peluquería y Recibos listan todo el histórico sin filtros

`renderAppointments()`, `renderGrooming()` y `renderInvoices()` renderizan **todos** los
registros existentes, ordenados “próximos primero, pasados después”. No hay filtro de
fecha, ni de profesional, ni de estado. Con un año de uso son miles de filas.

**Propuesta**: rango de fechas con “Hoy / Esta semana / Este mes” por defecto, más filtros
por profesional y estado.

### B16. “Archivar” un pendiente se guarda por dispositivo, no por clínica

`FOLLOWUP_DISMISS_KEY` vive en `localStorage`. El comentario del código lo asume a
propósito, pero con dos veterinarias rotando el efecto práctico es que **cada una tiene
que archivar los mismos 652 pendientes en su propio equipo**, y en el celular se pierde
al limpiar datos.

**Propuesta**: mover el descarte al servidor con quién y cuándo, y agregar “posponer 30/90
días” además de archivar.

Referencia: `js/followup.js:20`.

### B17. No existe el concepto de paciente inactivo

Sobre 4.734 pacientes migrados de cinco años, **hay 0 marcados como fallecidos**. Fichas
con última atención en 2014 siguen contando como activas, aparecen en Pacientes, en los
desplegables, en los cumpleaños y en la cola de vencidos.

El archivo existe pero sólo acepta fallecidos, y hay que marcarlos de a uno.

**Propuesta**: estado “Inactivo” automático por antigüedad (sin visita en 3+ años),
excluido por defecto de listas, buscador y avisos, con filtro “incluir inactivos” a mano;
y una acción masiva para revisar y archivar en tandas.

### B18. Cumpleaños es una pared de 741 tarjetas, la mayoría de pacientes perdidos

- 741 cumpleaños en los próximos 60 días, todos renderizados de una.
- **432 (58 %) son pacientes sin visita en más de dos años.**
- Sin agrupar por día, sin acción masiva, sin filtro.

Mandarle una promo de cumpleaños al tutor de un perro que no viene hace diez años —o que
ya murió— es un problema de imagen para la veterinaria, no sólo de UX.

**Propuesta**: ventana de 7 días por defecto, agrupado por día, filtrado a pacientes
activos, y un botón para copiar la lista de contactos del día.

---

## C. Flujo clínico

### C19. El nombre de la vacuna es texto libre: 185 variantes, 47 de “antirrábica”

En la base hay **7.206 dosis con 185 nombres distintos**, y **47 de ellos son variantes de
antirrábica** (“ANTIRRABICA (LABORATORIO CENTRAL DE SALUD PUBLICA)”, “ANTIRRABICA PAUL
(PAUL)”, “ANTIRRABICA DEFENSOR 1 (MERIAL)”, “ANTIRRABICA RABISIN (MERIAL)”…).

Además **ninguna de las 7.206 dosis tiene `intervalDays`**, así que el cálculo automático
de próxima dosis —que el formulario ya soporta— nunca se aplica: hay que tipear 365 cada vez.

**Propuesta**
- Catálogo de vacunas con **tipo** (antirrábica, quíntuple, triple felina…) + producto
  comercial + intervalo por defecto.
- Autocompletado a partir de los 185 nombres ya usados.
- Precargar el intervalo al elegir el tipo.
- Elegir el lote desde el inventario en vez de tipearlo (los lotes ya existen ahí).

Referencia: `js/sanitary.js:135`.

### C20. La pestaña de vacunas no responde la pregunta que se hace la veterinaria

BALTO muestra 26 dosis en lista cronológica plana, desde 2002, cada una con tres botones.
La pregunta real —“¿está al día con la antirrábica?”— exige leer 26 renglones y saber que
“RABISIN”, “DEFENSOR 1” y “BAGOVAC” son todas antirrábicas.

**Propuesta**: encabezar la pestaña con un **estado del plan por tipo de vacuna**
(“Antirrábica: vencida hace 4.143 días · Quíntuple: vencida hace 4.143 días”), y dejar el
histórico detallado colapsado abajo.

### C21. Cerrar la consulta no ofrece registrar lo que se aplicó

La pantalla “Revisar antes de cerrar” está muy bien resuelta y ofrece dejar estudios
solicitados y generar el recibo. Pero en la prueba escribí “Refuerzo antirrábica.
Antiparasitario oral.” en el tratamiento y **el cierre no ofreció registrar ninguna de las
dos cosas**: hay que ir después a otra pestaña, o se pierde.

Tampoco avisa que ese paciente tenía **dos vacunas vencidas** — el dato estaba a la vista
en la misma ficha.

**Propuesta**: en el cierre, sumar “¿Aplicaste alguna vacuna o antiparasitario hoy?” con
las dosis vencidas del paciente precargadas y un clic para registrarlas.

### C22. El peso no se compara con el anterior

`hWeight` se carga en blanco. El peso es de los signos más útiles clínicamente y la app ya
guarda la serie (`restoreDerivedVitals`, `js/api.js:108`), pero al cargar uno nuevo no
muestra el anterior ni la variación.

**Propuesta**: bajo el campo, “Anterior: 22,1 kg (hace 4 meses) · −3 %”, con alerta si la
variación supera un umbral.

### C23. Diagnóstico y observaciones son campos de una sola línea

`hDiag` y `hDesc` son `<input type="text">`. Un diagnóstico presuntivo con
diferenciales no entra, y no se ve lo que ya se escribió.

**Propuesta**: `<textarea>` con autoexpansión en ambos.

### C24. Una sola matrícula para toda la clínica

`setClinicLicense` es única y se imprime en el encabezado de **todos** los documentos. Con
tres profesionales matriculados, un certificado firmado por Sofía sale con la matrícula de
Nito. En el certificado, el campo “Profesional que firma” es texto libre que se precarga
con el nombre de la consulta, sin matrícula.

**Propuesta**: matrícula por usuario, y que el pie del documento use la del profesional
que firma; la de la clínica queda como respaldo.

Referencias: `js/settings.js:56`, `js/documents.js:15`, `js/documents.js:118`.

---

## D. Rendimiento con la base real

### D25. El arranque descarga 11 MB

`GET /api/data` devuelve **11.010.153 bytes** y el frontend carga todo en memoria en cada
arranque. En el consultorio con 4G eso son varios segundos y datos móviles reales, en cada
recarga y en cada dispositivo.

**Propuesta**: cargar Hoy con lo mínimo (turnos del día, pendientes, avisos) y traer el
historial clínico por paciente bajo demanda; paginar pacientes y tutores.

### D26. Pacientes renderiza 4.734 fichas de una, y filtra sin debounce

- 39.912 nodos DOM, 292 ms de render en escritorio (bastante peor en un celular gama media).
- `filterPets()` corre en **cada tecla** sobre los 4.734 y reconstruye todo el grid.
- La búsqueda **no incluye al tutor**, que es como recepción busca de verdad
  (“el perro de Poinsot”).

**Propuesta**: debounce de ~200 ms, tope de resultados con “ver más” o virtualización, y
sumar el nombre del tutor al filtro.

Referencias: `js/pets.js:152`, `js/pets.js:174`.

### D27. Abrir “Nuevo paciente” inyecta 3.473 filas de tutores

`assocPicker` renderiza **todos** los tutores antes de que se escriba nada: 610 KB de HTML
y 10.491 nodos en el modal. Es la acción más frecuente de recepción.

**Propuesta**: no renderizar nada hasta el segundo carácter (o mostrar sólo los últimos
usados), y limitar a ~50 resultados.

Referencia: `js/assoc.js:16`.

---

## E. Móvil

### E28. En el celular las tablas esconden justo las columnas que importan

La clase `col-sec` oculta columnas en pantallas chicas. Lo que queda:

| Pantalla | Lo que se ve en el celular | Lo que se pierde |
| --- | --- | --- |
| Turnos | fecha, hora, paciente | **tipo, profesional, estado, notas** |
| Recibos | número, tutor, total | **fecha, paciente, cobrado/pendiente** |
| Peluquería | fecha, hora, paciente | **servicio, peluquero, precio, estado** |
| Pacientes (lista) | nombre, tutor, pendientes | especie, sexo, edad |

En Recibos desde el celular **no se puede saber si un recibo está cobrado**, que es lo
único que se quiere saber.

**Propuesta**: en `< 768 px` reemplazar la tabla por tarjetas apiladas con las dos o tres
líneas que importan, en vez de recortar columnas.

---

## F. Gestión (mirada de Nito, dueño)

### F29. El Panel no responde ninguna pregunta de negocio

- “Cobrado total” es histórico, sin mes ni comparación con el período anterior.
- Las tarjetas **no son clickeables**: “Avisos pendientes 1” no lleva a Avisos.
- “Pacientes 4734” incluye fallecidos e inactivos, a diferencia de la pantalla Pacientes,
  que los excluye. Dos números distintos para lo mismo.
- Sobra código muerto: `renderUpcomingAppts()` y `renderUrgentReminders()` están definidas
  y nunca se llaman (`js/dashboard.js:68` y `:82`).

**Propuesta**: selector de período (mes actual por defecto) con comparación contra el
anterior, tarjetas que naveguen, y unificar el criterio de “pacientes activos”.

### F30. No hay productividad por profesional

Con dos veterinarias rotando, no existe ninguna vista de “consultas por profesional”,
“ingresos por profesional” ni “turnos atendidos vs. no asistidos”. Es la información que
justifica la app para el dueño, y hoy es imposible de calcular porque el profesional es
texto libre (ver B11).

**Propuesta**: una vez que el profesional sea un usuario, un panel mensual por persona.

### F31. Recibos: falta lo que se hace todos los días

- Sin filtros ni buscador.
- Sin acción rápida “marcar cobrado”: hay que abrir el modal de edición.
- Sin medio de pago, sin pagos parciales, sin saldo del tutor.
- Los ítems son texto libre con precio a mano: no salen del catálogo ni descuentan stock.

**Propuesta**: acción de cobro en la fila, selector de medio de pago, ítems desde el
catálogo con precio precargado, y filtros por estado y período.

### F32. La peluquería factura y no aparece en ningún lado

El turno de peluquería guarda `price`, pero **nunca se convierte en recibo ni suma a
ninguna estadística**. Siendo un servicio con uno o dos peluqueros dedicados, sus ingresos
son invisibles para el dueño.

**Propuesta**: al marcar el turno como Completado, ofrecer generar el recibo con el
servicio y el precio ya cargados.

### F33. El inventario no se conecta con nada

- La pantalla Inventario **no tiene botón para crear un producto** (hay que ir a
  Opciones › Catálogo); el texto lo aclara sólo cuando la lista está vacía.
- Sin buscador ni filtro por categoría.
- Nada descuenta stock: ni la vacuna aplicada, ni el tratamiento de la consulta, ni el
  ítem del recibo. El descuento es manual desde el botón “−”.

**Propuesta**: “+ Nuevo producto” en la propia pantalla, buscador, y descuento automático
al aplicar una vacuna o cobrar un ítem que esté vinculado a un producto.

### F34. No se pueden dar de alta ni desactivar usuarios desde la app

“Accesos y auditoría” sólo permite cambiar el rol y restablecer la contraseña. Para sumar
una recepcionista hay que pasarle el `INVITE_CODE` (que no se ve ni se puede rotar desde
la interfaz) para que se auto-registre. Y **una veterinaria que se va conserva el acceso
para siempre**: no hay baja ni desactivación.

Además `resetUserPassword` usa un `prompt()` del navegador donde el administrador escribe
la contraseña en texto plano.

**Propuesta**: invitación por email desde la app con rol preasignado, estado
activo/inactivo por usuario, rotación del código de invitación, y reemplazar el `prompt()`
por un modal propio con generador de contraseña.

---

## G. Detalles que suman

### G35. No hay detección de duplicados al crear tutores o pacientes

`saveOwner()` sólo valida que el nombre no esté vacío. **Ya hay 176 tutores repartidos en
84 grupos de nombre repetido** (“RODRIGUEZ LAURA” ×4, “GONZALEZ ARIEL” ×3…). Con recepción
cargando a las apuradas, esto crece solo.

**Propuesta**: al escribir el nombre, avisar “Ya existe un tutor con este nombre — ¿es el
mismo?” con acceso a la ficha existente. Ídem para paciente + tutor.

### G36. Faltan `<label>` y sobran acentos ausentes en Opciones

Los campos de datos de la clínica usan sólo `placeholder` (“Direccion”, “Telefono”,
“Matricula profesional”): la etiqueta desaparece al escribir y los lectores de pantalla no
la anuncian. Los textos de esa sección están sin acentos (“DATOS DE LA CLINICA”, “Texto
del certificado medico”, “La direccion y el telefono”), a diferencia del resto de la app.
También `showLogin()` arroja “Sesion expirada”.

### G37. Faltan atajos entre entidades relacionadas

- Desde la ficha de un tutor no se puede crear una mascota nueva (caso típico: cliente
  conocido que trae un cachorro).
- Desde el alta de paciente no se puede crear un tutor: hay que cancelar, ir a Tutores,
  crearlo, y volver a empezar.

### G38. Las pestañas de la ficha no son pestañas accesibles

Los `.tab` son `<button>` sin `role="tab"`, sin `aria-selected` y sin navegación por
flechas. Tampoco hay `skip link` al contenido principal.

### G39. Un 401 expulsa al login y se pierde el trabajo abierto

`if (res.status === 401) { clearSession(); showLogin(); }` descarta cualquier modal en
curso. Con sesiones de 30 días pasa poco, pero cuando pasa se pierde una consulta a medio
cargar.

**Propuesta**: guardar borrador local, mostrar el login como capa por encima y volver a
donde estaba tras reingresar.

Referencia: `js/api.js:88`.

### G40. El respaldo depende de que alguien se acuerde

La pantalla de Respaldo está muy bien explicada, pero descargar la copia es 100 % manual.
No hay “última copia descargada hace N días” ni recordatorio.

**Propuesta**: registrar la fecha de la última descarga y avisar en Opciones cuando pasen
más de 30 días.

---

## Orden sugerido de ataque

**Primero (rompe el uso diario, arreglo acotado)**
A1 teléfonos · A2 selector de paciente · A3/A4 búsqueda · A5 ordenamiento · B11 profesional
como usuario · B12 jerarquía de Hoy · E28 tablas en celular.

**Después (calidad del dato y del día a día)**
A6-A10 validaciones y auditoría · B13-B18 agenda, archivado compartido, inactivos,
cumpleaños · C19-C24 plan sanitario y cierre de consulta.

**Luego (escala y negocio)**
D25-D27 rendimiento · F29-F34 panel, recibos, peluquería, inventario, usuarios.

**Cuando haya aire**
G35-G40.
