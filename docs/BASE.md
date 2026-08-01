# VetCare — Protocolo Base de Desarrollo

> Documento vivo. Describe **qué es la app hoy** y **cómo se trabaja sobre ella**.
> Creado: 22/06/2026 · Última actualización: 30/07/2026 (versión 2.13.0)

> **La app está en producción real, con datos clínicos reales de una
> veterinaria.** Nada se publica sin aprobación explícita. Ver §6.

---

## 1. Qué es la app hoy

VetCare dejó de ser el HTML autocontenido con el que arrancó. Hoy son **dos
piezas**:

| Pieza | Qué es | Dónde vive |
|---|---|---|
| **Frontend** | Sitio estático: `index.html` + `css/` + `js/` | GitHub Pages |
| **Backend** | Worker de Cloudflare + base D1 (SQLite) | `vetcare-api.vetcare-neco.workers.dev` |

- **Tiene login.** `POST /api/login`, `/register`, `/logout`, `/me`. El Worker
  valida la sesión en cada request y hay roles (el rol condiciona, por ejemplo,
  quién puede editar la historia clínica).
- **La fuente de verdad es D1.** IndexedDB quedó como caché local y respaldo
  offline: la app funciona sin conexión y sincroniza cuando vuelve.
- La sincronización es **incremental**, con bloqueo optimista por `revision` y
  `syncToken` en cada paciente, y un cierre de consulta **atómico e
  idempotente** vía `POST /api/clinical-close`.
- `GET /api/health` devuelve `status`, `version` y `schemaVersion`, y valida el
  esquema real contra lo que la app espera. Es la forma canónica de verificar
  un despliegue.

### Vistas (11 en el menú)

**Operación diaria:** Hoy · Turnos · Peluquería · Calendario
**Registros:** Pacientes · Tutores
**Gestión:** Panel · Avisos · Inventario · Recibos · Cumpleaños

Respaldo y las preferencias de la clínica no son vistas del menú: se abren
desde **Opciones**, en el pie del menú lateral.

### Lo que el usuario ve al abrir

Splash → login → shell de la app. Si no hay backend configurado
(`js/config.js` con `apiBase: ''`), arranca en modo local con IndexedDB y una
pantalla de bienvenida para importar un `.vetcare` o crear una base nueva. Ese
modo es el que se usa para **probar sin tocar producción** (ver §6).

---

## 2. Sistema de diseño

Todo sale de tokens CSS en `:root` y `[data-theme="dark"]`, al principio de
`css/styles.css`. **Un cambio de escala o de color se hace en un solo lugar.**
El bloque está comentado en detalle en el propio archivo; acá va el resumen.

### 2.1 Espaciado — base 4

`--space-1` (4) · `2` (8) · `3` (12) · `4` (16) · `5` (20) · `6` (24) ·
`8` (32) · `10` (40)

**Usalos siempre** para `padding`, `gap` y `margin`. No inventes valores
intermedios: si algo queda apretado, subí un escalón.

### 2.2 Radios — tres, según el tamaño de la pieza

| Token | px | Para |
|---|---|---|
| `--radius-sm` | 8 | controles: botones, campos, chips rectangulares |
| `--radius` | 12 | tarjetas e ítems de lista |
| `--radius-lg` | 16 | superficies de página y modales |
| `--radius-pill` | 999 | chips redondos y badges |

### 2.3 Superficies — tres niveles de profundidad

Cada pieza declara **a qué nivel pertenece**; no elige su propio padding.

| Clase | Nivel | Padding | Radio | Borde / sombra |
|---|---|---|---|---|
| `.surface-page` | lienzo de la vista | `--pad-page` (24) | `--radius-lg` | borde + sombra suave |
| `.card` | tarjeta sobre el lienzo | `--pad-card` (20) | `--radius` | borde, sin sombra |
| `.surface-item` | ítem de lista | `--pad-item` (12/16) | `--radius` | borde |
| `.surface-sunken` | hueco dentro de una tarjeta | `--pad-item` | `--radius-sm` | fondo tenue, sin borde |

Fondos: `--surface` (tarjeta) y `--surface-sunken` (hueco).

### 2.4 Color

**Base de marca** — violeta cálida.

| Rol | HEX (claro) | Token | Uso |
|---|---|---|---|
| Violeta principal | `#6F2DBD` | `--accent` | acción principal, ícono activo, enlaces |
| Violeta secundario | `#A663CC` | `--info` | resaltados suaves, chips |
| Acento cálido | `#F4B860` | `--highlight` | atención puntual ("Nuevo turno"), "en curso" |
| Fondo | `#FFF9F5` | `--bg` | lienzo general |
| Superficie | `#FFFFFF` | `--surface` / `--bg-alt` | tarjetas, formularios, modales |
| Texto principal | `#2A2233` | `--text` | títulos y datos importantes |
| Texto secundario | `#5f5569` | `--text-soft` | descripciones, fechas |
| Texto terciario | `#736881` | `--text-mute` | metadatos, placeholders |

**Familias semánticas** — cada una tiene **cuatro piezas**, y las cuatro
cambian en modo oscuro:

| Pieza | Para qué |
|---|---|
| base (`--success`) | color del ícono, del borde izquierdo, del texto sobre fondo normal |
| `-soft` | fondo del chip o del aviso |
| `-border` | borde del chip, sobre el fondo `-soft` |
| `-strong` | **texto sobre `-soft`** — el que necesita contraste |

Existen para `--success`, `--warning` y `--danger`. Más `--danger-fill`, que es
el relleno pleno rojo (el `--danger` base sobre blanco solo da 3,9:1).

**Texto sobre relleno pleno** — `--on-accent`, `--on-success`, `--on-danger`,
`--on-highlight`. Existen porque los rellenos **se aclaran en modo oscuro**: un
`color: white` fijo sobre `--accent` daba 3,21:1 en oscuro. Si ponés un fondo
pleno de una familia, el texto va con su token `--on-*`.

**Reglas de color, en una línea cada una:**

- Nunca escribas un HEX fuera del bloque de tokens.
- Para **texto** sobre un fondo `-soft`, usá `-strong`, no la base.
- Para **texto sobre relleno pleno**, usá `--on-*`.
- El verde es "terminado" (cerrado, cobrado, al día). "En curso" es ámbar.
- Los campos de formulario usan `--field-bg`, que **no** es blanco en oscuro.

### 2.5 Tipografía

Dos familias: `--font-display` (**Fraunces**, serif) para `h1`–`h4` y números
destacados; `--font-body` (**Outfit**) para todo lo demás.

Escala en `rem` sobre base 16px. **Sube un escalón en pantallas grandes**: los
`--fs-*` se redefinen dentro de `@media (min-width: 1200px)`, así que el
teléfono queda con la escala compacta y la notebook con la cómoda.

| Token | <1200px | ≥1200px | Uso |
|---|---|---|---|
| `--fs-2xs` | 11 | 12 | micro-labels, badges, fechas en mayúscula |
| `--fs-xs` | 12 | 13 | metadatos, captions |
| `--fs-sm` | 13 | 14 | texto secundario, botones, celdas de tabla |
| `--fs-base` | 16 | 16 | cuerpo (default del `body`) |
| `--fs-md` | 18 | 20 | `h3`, encabezado de sección |
| `--fs-lg` | 22 | 24 | `h2` |
| `--fs-xl` | 28 | 30 | `h1`, título de página |
| `--fs-2xl` | 36 | 40 | números hero |

Pesos: `--fw-normal` (400) · `--fw-medium` (500, labels y botones) ·
`--fw-bold` (600, títulos y énfasis). Interlineado: `--lh-tight` (1.25) para
títulos, `--lh-base` (1.55) para cuerpo.

> **No uses px ni rem sueltos para texto.** Si aparece uno, es una fuga: en
> 2.13.0 se repararon ~15 que se habían escapado (`1.06rem` en el menú lateral,
> `9px` en el calendario móvil, `26px` en el splash).

### 2.6 Retícula

- `--content-max` = **1360px**: ancho máximo del contenido, el mismo para las
  vistas de lista, la ficha del paciente y la consulta.
- `--gutter`: canaleta lateral **compartida** por `.main` y el topbar, así el
  buscador queda a plomo con el borde derecho del contenido en todo ancho.

Escalones:

| Ancho | Qué cambia |
|---|---|
| ≤768 | móvil: el sidebar es deslizante, el layout deja de ser grid |
| 769–1024 | tablet: sidebar 200px |
| 1025–1279 | notebook chica: sidebar 230px |
| 1280–1599 | notebook / escritorio: sidebar 248px, canaleta 40px |
| ≥1600 | monitor grande: sidebar 268px, el contenido se centra en 1360px |

> **Cuidado con `.main`:** es el **mismo elemento** que `#mainContent`
> (`<main class="main" id="mainContent">`). Un selector `#mainContent` le gana a
> `.main` por especificidad. Ese fue exactamente el bug que mantuvo muerto el
> techo de ancho durante meses: en 1920px el contenido se estiraba a 1690px.

### 2.7 Movimiento

`--dur-fast` (.12s) · `--dur-base` (.2s) · `--dur-slow` (.32s), con `--ease`.

Al final del CSS hay un bloque `prefers-reduced-motion`. Quien tenga la
preferencia activada **deja de ver movimiento pero no deja de ver los cambios
de estado**: el punto de sincronización queda fijo y visible, el anillo del
splash se cierra. Si agregás una animación, fijate si necesita una línea ahí.

### 2.8 Iconos

Un solo sistema, en **`js/icons.js`**: 44 iconos SVG de trazo.

```
viewBox 0 0 24 24 · fill none · stroke currentColor · stroke-width 1.8
stroke-linecap round · stroke-linejoin round
```

Helpers: `icon(nombre, claseExtra)` devuelve el SVG listo para insertar en una
plantilla, y `studyIcon(tipo)` elige el del tipo de estudio.

Tamaños por CSS: `--icon-sm` (16) · `--icon-md` (20, default) · `--icon-lg`
(24), con las clases `.ico`, `.ico-sm` y `.ico-lg`.

> **No uses emoji como iconografía.** Cambian de dibujo según el sistema
> operativo, no toman el color del tema y desalinean la línea de base. En
> 2.13.0 se reemplazaron ~44. Los únicos que quedan están en la **plantilla del
> saludo de cumpleaños**, y eso es a propósito: es el texto de un mensaje que
> edita la veterinaria, no un ícono de la interfaz.

### 2.9 Marca

El isotipo (cruz violeta + calendario + siluetas de perro y gato) se define
**una sola vez** en `index.html` como `<symbol id="vc-logo">`, y cada pantalla
lo instancia con `<use href="#vc-logo">`. El trazado usa `currentColor`, así
que el color se hereda del contenedor.

Tres tamaños: `--logo-sm` (38, topbar móvil) · `--logo-md` (52, sidebar) ·
`--logo-lg` (84, bienvenida y splash).

> **Ojo con `<use>`:** un selector descendente como `.x svg path` **no alcanza**
> el contenido de un `<use>`. Por eso el color se setea en el contenedor, nunca
> en el `path`.

El favicon es `assets/favicon.svg`, un archivo aparte. El original venía de un
calco automático de 1611 vértices y estaba repetido cuatro veces dentro del
HTML: ocupaba 98,4 de los 113,8 KB del archivo. Hoy `index.html` pesa 18,8 KB.

El kit de marca completo (PNG en todos los tamaños, versiones blanco/negro)
está en `design/kit_isotipo_veterinaria/`.

### 2.10 Botones

| Clase | Para |
|---|---|
| `.btn-primary` | acción principal de la pantalla |
| `.btn-warm` | acción destacada puntual ("Nuevo turno") |
| `.btn` (defecto) | acciones secundarias |
| `.btn-success` | confirmatoria (cerrar consulta, marcar cobrado) |
| `.btn-danger` | destructiva |
| `.btn-secondary`, `.btn-ghost` | variantes de menor peso |
| `.btn-sm` | variante compacta |

### 2.11 Accesibilidad — el piso que hay que mantener

- **Contraste ≥ 4,5:1** para todo texto, en los dos temas. Se verifica midiendo
  el DOM, no a ojo (§6).
- **Foco visible en todo lo enfocable.** Hay una regla global `:focus-visible`;
  no la desactives por componente.
- **Objetivos táctiles ≥ 40px** en móvil. Incluye campos, selects, chips y
  botones de borrar, no solo los `.btn`.
- Lo que se puede clickear se puede **tabular**. Nada de `<div onclick>`: las
  pestañas de la ficha lo eran, y por eso la historia clínica del paciente no se
  alcanzaba con el teclado hasta 2.13.0. Hoy son `<button role="tab">` con
  navegación por flechas, Inicio y Fin.

---

## 3. Estructura del código

### 3.1 Frontend

`index.html` es solo el esqueleto: el shell (sidebar, topbar, contenedores de
modal), el `<symbol>` del logo y los `<script>` en **orden de dependencia**.
Todo lo demás está en `css/` y `js/`.

> **Son scripts clásicos, no módulos ES.** Comparten un scope global: no hay
> `import`/`export` y **el orden de carga en `index.html` importa**. Si agregás
> un archivo, ponelo después de aquello de lo que depende. `auth.js` va último
> porque arranca la app.

| Archivo | Qué contiene |
|---|---|
| `config.js` | `apiBase`. Vacío = modo local sin backend |
| `sync-state.js` | estado del indicador de guardado |
| `api.js` | modelo `db`, IndexedDB, import/export `.vetcare`, sincronización |
| `icons.js` | el set de iconos y los helpers `icon()` / `studyIcon()` |
| `app-core.js` | utilidades, tema, router `navigateTo`, `toast` |
| `finance.js`, `assoc.js` | cálculos de importes y selector de asociaciones |
| `dashboard.js` | vista Panel |
| `pets.js` | lista de pacientes, ficha completa y consulta clínica |
| `followup.js` | seguimiento: qué debe pasar después de la consulta |
| `timeline.js` | historia clínica como línea de tiempo |
| `sanitary.js` | plan sanitario: vacunas y antiparasitarios |
| `labs.js` | paneles de laboratorio y valores de referencia |
| `documents.js` | encabezado de impresión, certificados y plantillas de examen |
| `owners.js` | vista Tutores |
| `appointments.js` | turnos, peluquería y calendario |
| `reminders.js` | avisos y cumpleaños |
| `inventory.js` | inventario |
| `invoices.js` | recibos |
| `backup.js` | respaldo |
| `ui.js` | `showModal`, `showConfirm`, formato de fecha, seed demo |
| `settings.js` | Opciones y `APP_VERSION` |
| `app-shell.js` | vista Hoy y búsqueda global |
| `camera.js` | cámara para la foto del paciente |
| `auth.js` | login y arranque (`initApp`) |

**Los módulos nuevos exportan una costura de test** al final:
`globalThis.VetCareXxx = { ... }`. Vitest importa el archivo como módulo ES,
donde las funciones de nivel superior **no** quedan globales; esa línea es la
que permite testear la lógica pura.

#### El índice `[NN]` está corrido — leelo con cuidado

Del HTML único quedaron encabezados numerados `// [01]` … `// [24]`. Al partir
el archivo en módulos, **el corte se hizo arriba de cada encabezado en vez de
abajo**, así que cada archivo termina con el encabezado del siguiente.

Ejemplo real: `dashboard.js` tiene 102 líneas; el código del panel va de la 1 a
la 100, y la 101 dice `// [11] VISTA: PACIENTES (PETS)` — que es el título de
`pets.js`.

> **Regla práctica:** buscá el archivo por la tabla de arriba, no por el número.
> Si ves un encabezado `[NN]` al final de un archivo, describe el archivo
> siguiente. Vale la pena reordenarlos en una tarea de limpieza aparte.

### 3.2 CSS

`css/styles.css` arranca con un comentario de paleta y un **índice de bloques
A–E**:

- **A. TOKENS** — `:root` y `[data-theme="dark"]`. Todo el sistema vive acá.
- **B. BASE / LAYOUT** — reset, foco global, grilla general.
- **C. COMPONENTES** — botones, tarjetas, formularios, tabla, modal, ficha,
  seguimiento, línea de tiempo, plan sanitario, laboratorio, consulta.
- **D. RESPONSIVE**
- **E. AJUSTES Y REFINAMIENTOS** — parches que **pisan** reglas de arriba a
  propósito.

> **Si tocás un estilo y no cambia nada, buscá un override en el bloque E o al
> final del archivo.** Y recordá que **las media queries no suman
> especificidad**: una regla dentro de un `@media` pierde contra una regla más
> específica declarada después.

### 3.3 Backend

`backend/worker.ts` (TypeScript) + D1. Migraciones numeradas en
`backend/migrations/`, hoy hasta la `0013`. El esquema esperado se declara en
`health()`, que compara contra las tablas y columnas reales y devuelve
`schemaVersion` (hoy **13**).

Endpoints: `/api/health` · `/api/login` · `/api/logout` · `/api/register` ·
`/api/me` · `/api/users` · `/api/data` · `/api/settings` · `/api/audit` ·
`/api/clinical-close`.

### 3.4 Patrón de cada vista

Casi todas siguen el mismo esqueleto; entendés una, entendés todas:

- `renderX()` — arma el HTML y lo devuelve como string.
- `openXModal(id)` — abre el formulario con `showModal(html)`.
- `saveX(id, isNew)` — lee el form, actualiza `db`, llama `saveDB()`, cierra y
  re-renderiza.
- `deleteX(id)` — confirma con `showConfirm(...)`, borra, guarda y re-renderiza.

> Para agregar un campo a una entidad tocás tres lugares: el form
> (`openXModal`), la lectura (`saveX`) y donde se muestra. Nada más.

---

## 4. Decisiones de producto que no se negocian

1. **La atención clínica es el centro.** Los recibos son opcionales, arrancan
   destildados y **nunca** bloquean ni condicionan el cierre de una consulta.
2. **Los valores de referencia de laboratorio son orientativos y editables.**
   Cada laboratorio tiene los suyos; hardcodearlos sería inútil. Viven en
   `db.settings.labRanges`, que ya sincroniza.
3. **Compatibilidad hacia atrás siempre.** Los registros viejos tienen que
   seguir funcionando: los estudios sin estado se asumen recibidos, las vacunas
   sin columnas nuevas quedan vacías, los datos de la clínica se heredan de los
   campos del recibo.
4. **La ficha no depende de un CDN.** El sparkline de peso es SVG inline a
   propósito, no Chart.js: la historia clínica tiene que abrir aunque el CDN
   esté caído.
5. **Los estudios pedidos al cerrar viajan en la misma transacción** que el
   cierre. El cierre marca el paciente como sincronizado; un estudio agregado
   antes de esa llamada quedaría marcado como guardado sin haber llegado nunca
   al servidor.

---

## 5. Reglas de trabajo

1. **Nunca apuntes las pruebas locales a la API de producción.** Copiá el build
   a un directorio aparte y sobrescribí `js/config.js` con `apiBase: ''`.
2. **`_otros/` está fuera de git y no se commitea nunca.** Ahí vive el documento
   de traspaso y el manual de referencia.
3. **No toques `manual_vetter5.pdf`.**
4. **No publiques sin aprobación explícita.** La app sirve a una clínica real.
5. Diseño liviano, sin frameworks. Solo CDNs puntuales y justificados.
6. Comentarios donde aclaran algo **no obvio**: por qué, no qué. Los comentarios
   que explican una trampa (la especificidad de `#mainContent`, el `<use>` y los
   selectores descendientes) valen más que diez que describen la línea de abajo.
7. Al agregar un componente CSS, ponelo en su bloque temático; al agregar un
   módulo JS, en su lugar del orden de carga.

---

## 6. Cómo se prueba y cómo se publica

### Probar en local, sin tocar producción

```bash
npm run build
```

Después: copiar `dist/` a un directorio de trabajo, sobrescribir
`js/config.js` con `apiBase: ''` y servirlo. Arranca en modo local con
IndexedDB, rol admin y datos de demo.

**Qué verificar siempre:**

- Los cinco anchos: **375 / 768 / 1024 / 1300 / 1920 px**.
- Los **dos temas**, claro y oscuro.
- El flujo clínico **con y sin recibo**.
- Sin desborde horizontal, contraste ≥4,5:1, objetivos táctiles ≥40px. Conviene
  medirlo con un script sobre el DOM en vez de a ojo.

### Antes de entregar

```bash
npm test && npm run check
```

`check` corre el chequeo de sintaxis, el typecheck del Worker, la verificación
de tipos generados y un deploy en seco.

### Ritual de publicación

1. `node scripts/bump-version.mjs <x.y.z>` — sincroniza la versión en los
   **siete** lugares que deben coincidir y **falla** si algún archivo no tiene
   las coincidencias esperadas. Existe porque un reemplazo global de `2.9.0`
   pisó una vez la versión de una dependencia en `package-lock.json` y rompió
   `npm ci`. **No hagas el bump a mano.**
2. `npm run worker:types`
3. `npm test` · `npm run check` · `npm run build`
4. Verificación en el navegador (arriba).
5. Rama, commit, push, PR, CI en verde, merge.
6. Workflow de Deploy.
7. Verificar `GET /api/health` (`version` y `schemaVersion`) y que Pages sirva
   los assets con el token de caché nuevo.
8. Borrar la rama.

---

## 7. Changelog

Las entradas viejas se resumen; el detalle está en el historial de git.

| Fecha | Versión | Cambio |
|---|---|---|
| 22/06/2026 | — | Documento base. Paleta violeta cálida, sistema tipográfico en `rem`, set propio de íconos SVG, isotipo de marca, reorganización del código con índices internos. |
| 22/06–jul 2026 | — | **Migración a la arquitectura de dos piezas.** Repo en GitHub, Pages, Worker + D1, login con roles, sincronización incremental con bloqueo optimista, cierre clínico atómico e idempotente. El HTML único se partió en `css/` y `js/`. IndexedDB pasó a ser caché. |
| 30/07/2026 | 2.7.0 | Panel de Seguimiento en la ficha y estudios con estado. |
| 30/07/2026 | 2.8.0 | La misma señal de continuidad clínica en Hoy y en el listado. |
| 30/07/2026 | 2.9.0 | Historia clínica como línea de tiempo, con comparación de consultas. |
| 30/07/2026 | 2.10.0 | Plan sanitario: vacunas y antiparasitarios con próxima dosis. Esquema 12. |
| 30/07/2026 | 2.11.0 | Resultados de laboratorio con valores de referencia editables. Esquema 13. |
| 30/07/2026 | 2.12.0 | Documentos clínicos unificados (un solo encabezado de impresión), certificado médico y plantillas de examen. |
| 31/07/2026 | 2.15.0 | **Sistema de interacción** para todo lo clickeable: cuatro roles (sólido, contorno, tinta, superficie) con hover y presionado propios, tokens `--press-shift`, `--hover-lift` y `--transition-ui`. Una sola geometría de chip para `.tag`, `.followup-chip` y `.lab-chip`. Los enlaces en línea pasan a `.link-inline` (antes eran quince repeticiones de `style="display:inline;padding:0;font:inherit"`). Se repararon dos rellenos ilegibles en modo oscuro: `.btn-danger:hover` daba 1,97:1 y `.contact-btn.wa:hover` 1,73:1. |
| 01/08/2026 | 2.16.0 | **Cierre del plan de auditoría A1–G40.** Agenda y seguimiento compartido, pacientes inactivos y listas paginadas, plan sanitario conectado a inventario, cierre clínico asistido, matrículas por profesional, panel e ingresos por período, cobros parciales, facturación de peluquería, gestión segura de accesos, recuperación de borradores y recordatorio de respaldo. El arranque carga sólo Hoy; el directorio usa fichas resumidas y trae la historia completa al abrir cada paciente. Esquema 18. |
| 30/07/2026 | 2.13.0 | **Reescritura del sistema de diseño** (§2). Escala de espaciado base 4, tres niveles de superficie, familias semánticas de color con variante oscura, escalón de densidad tipográfica en ≥1200px, retícula con ancho máximo y canaleta compartida, sistema único de iconos en `js/icons.js`, isotipo como `<symbol>` único (`index.html` 113,8 → 18,8 KB), foco global, pestañas navegables por teclado y `prefers-reduced-motion`. Se reparó el modo oscuro, que dejaba los campos en blanco y una docena de chips sin cambiar de tema. |

---

## 8. Pendientes conocidos

| Tema | Nota |
|---|---|
| Encabezados `[NN]` corridos | Cada archivo termina con el título del siguiente (§3.1). Limpieza mecánica. |
| Acciones de Pages en Node 20 | GitHub las corre forzadamente con Node 24 y avisa. No bloquea. |
| Imágenes en Base64 | Siguen en la base. La transición a links de Drive está hecha; falta R2 para uploads propios. |
| Recordatorios previos a 2.10.0 | Los creados antes tienen id aleatorio y no quedan ligados a su registro sanitario. |
| Service worker | Desactivado a propósito durante el desarrollo, con limpieza de registros viejos al cargar. |

---

## 9. Qué mirar después de esta pasada

El plan del manual está cubierto. Lo más valioso ahora **no es agregar
funciones**, sino dejar que la veterinaria use la app unos días y ajustar sobre
lo que aparezca en la práctica: los umbrales del seguimiento (30 días para
"próximo", 90 de horizonte), la pestaña por la que abre la ficha (hoy
Seguimiento, antes Historia clínica) y las plantillas de examen propias.
