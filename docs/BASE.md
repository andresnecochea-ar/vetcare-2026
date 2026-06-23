# VetCare — Protocolo Base de Desarrollo

> Documento vivo. Lo construimos y actualizamos juntos a medida que avanza el proyecto.
> Creado: 22/06/2026 · Última actualización: 22/06/2026

---

## 0. Decisión de punto de partida

**Archivo base elegido: `index.html`** (era `vetcare_v5 beta.html`).

Los dos HTML originales eran funcionalmente idénticos; el otro (`vetcare_v5 (1).html`) tenía backticks mal escapados (`` \` ``) que rompían el JS. Nos quedamos con la beta, la renombramos a `index.html` y borramos los dos originales. Carpeta limpia: solo `index.html` y `BASE.md`.

---

## 1. Qué es la app hoy

- SPA autocontenida en **un solo HTML** (~155 KB), sin dependencias externas (salvo Chart.js por CDN y las fuentes de Google).
- Stack visual: paleta **violeta cálida** (sección 1.bis), tipografías Fraunces + Outfit, modo oscuro funcional.
- Datos 100% locales en **IndexedDB** del navegador, con respaldo manual a archivo `.vetcare`.
- **No tiene login.** No hay ningún `fetch()` a un backend.

### Secciones existentes (13 vistas)

`today` (Hoy) · `dashboard` · `pets` (Pacientes) · `owners` (Tutores) · `appointments` (Turnos) · `calendar` · `grooming` (Peluquería) · `inventory` · `invoices` (Facturación) · `reminders` (Avisos) · `birthdays` (Cumpleaños) · `backup` (Respaldo)

---

## 1.bis Identidad visual — Paleta violeta cálida

Paleta oficial del proyecto. Toda la app sale de variables CSS centralizadas en `:root` (y su equivalente en `[data-theme="dark"]`), así que un cambio de color se hace en un solo lugar.

| Color | HEX | Variable CSS | Uso |
|---|---|---|---|
| Violeta principal | `#6F2DBD` | `--accent` | Botones principales, barra superior, íconos activos, links importantes, estados seleccionados |
| Violeta secundario | `#A663CC` | `--info` / `--color-violet-2` | Botones secundarios, etiquetas, chips, resaltados suaves, fondos destacados |
| Acento cálido | `#F4B860` | `--highlight` (`.btn-warm`) | Llamados de atención, botones puntuales tipo "Nuevo turno", badges |
| Fondo cálido claro | `#FFF9F5` | `--bg` | Fondo general de la app |
| Superficie / tarjetas | `#FFFFFF` | `--bg-alt` | Cards, formularios, modales, listas |
| Texto principal | `#2A2233` | `--text` | Títulos, nombres, datos importantes |
| Texto secundario | `#7A6F85` | `--text-soft` | Descripciones, fechas, aclaraciones |

**Agregados por coherencia (no estaban en la propuesta original):**

- **Rojo destructivo `#E5484D`** (`--danger`): la paleta violeta no incluía color de error. Solo para eliminar y alertas críticas.
- **Texto terciario `#A99FB3`** (`--text-mute`): violeta-gris más claro que el secundario, para placeholders y datos de menor jerarquía (tres niveles: principal → secundario → terciario).
- **Modo oscuro** adaptado a la misma familia violeta (antes era azul marino).
- **`.btn-warm`**: clase de botón con el acento cálido, aplicada a "+ Nuevo turno" (clínico y peluquería).

> Si querés ajustar tonos, todo se edita en el bloque `:root` del `<style>` en `index.html`.

---

## 1.quater Sistema tipográfico

Dos familias y una escala única en `rem` (base **16px = 1rem**). Todo se controla con tokens en `:root`; **no uses px sueltos para texto**.

**Familias**
- `--font-display` → **Fraunces** (serif): títulos (`h1`–`h4`), números destacados (stats, totales).
- `--font-body` → **Outfit** (sans): todo el resto.

**Escala** (token → px → uso)

| Token | px | Uso |
|---|---|---|
| `--fs-2xs` | 11 | micro-labels, badges, fechas en mayúscula, encabezados de tabla |
| `--fs-xs` | 12 | metadatos, captions, subs |
| `--fs-sm` | 13 | texto secundario, botones chicos |
| `--fs-base` | 16 | **cuerpo (default del `body`)** |
| `--fs-md` | 18 | `h3`, encabezados de bloque/sección |
| `--fs-lg` | 22 | `h2` |
| `--fs-xl` | 28 | `h1` (título de página) |
| `--fs-2xl` | 36 | números hero (valores de stats) |

**Pesos** — solo tres: `--fw-normal` (400), `--fw-medium` (500, labels y botones), `--fw-bold` (600, títulos y énfasis).

**Interlineado** — `--lh-tight` (1.25) para títulos y números; `--lh-base` (1.55) para cuerpo.

**Decisiones de este pase**
- Base subida de 14px a **16px** (legibilidad en jornadas largas; sugerencia del análisis inicial).
- Eliminados los tamaños arbitrarios (9px, 12.5px, 13.5px) y la mezcla px/rem.
- Labels de formulario: se quitó `text-transform: uppercase` y se subió a 13px (eran fatigantes en mayúscula+12px). Los `th` de tabla sí conservan mayúscula (convención de encabezado).
- Íconos/emojis decorativos (18–50px) NO usan la escala de texto: son glifos, se dejan en px.
- Las hojas de impresión (historia clínica, factura) mantienen su tipografía propia (serif sobre fondo blanco), independiente de la app.

> Los tamaños chicos (11–12px) ahora son la excepción para datos terciarios, no el default. Si algo se ve apretado, subilo un token; no inventes un px intermedio.

---

## 1.quinquies Navegación e íconos

**Menú lateral (desktop)** — las 12 vistas agrupadas por frecuencia de uso, con etiqueta de grupo:
- **Operación diaria:** Hoy, Turnos, Peluquería, Calendario
- **Registros:** Pacientes, Tutores
- **Gestión:** Panel, Avisos, Inventario, Facturación, Cumpleaños
- **Sistema:** Respaldo

Cada `.nav-item` es un `<button>` con ícono SVG (`.ico`) + `.nav-label`. El activo lleva una barra violeta a la izquierda (`::before`) y fondo `--accent-soft`.

**Navegación mobile (≤768px)** — barra inferior fija (`.bottom-nav`) con las 4 secciones más usadas (Hoy, Turnos, Pacientes, Avisos) + botón **Más**. "Más" abre una hoja deslizable (`.more-sheet`) con las otras 8 secciones en grilla. El menú lateral sigue disponible por el botón hamburguesa, ahora con overlay oscuro (`.sidebar-overlay`). Toda la cobertura: 4 + 8 = 12 vistas, sin solapamiento.

Funciones JS: `toggleSidebar()`, `closeSidebar()`, `toggleMoreSheet()`. `navigateTo(view)` sincroniza el estado activo en sidebar y bottom-nav (marca "Más" cuando la vista no está en la barra) y cierra el sidebar en mobile.

**Íconos** — set propio de líneas (SVG inline, `stroke="currentColor"`, viewBox 24), uno por sección. Toman el color del contexto y no dependen de ninguna librería externa. Reemplazaron los caracteres Unicode geométricos (◑◈◉…) que no comunicaban nada.

**Jerarquía de botones**
- `.btn-primary` (violeta) → acción principal de la pantalla.
- `.btn-warm` (cálido) → acción destacada puntual ("Nuevo turno").
- `.btn` (defecto, contorno) → acciones secundarias.
- `.btn-danger` → destructivas (eliminar).
- `.btn-sm` → variante compacta. En mobile todos los botones suben a ≥42px de alto (≥36px los `sm`) para el dedo, y tienen foco visible (`:focus-visible`).

---

## 1.ter Estructura del código (mapa para no perderse)

`index.html` tiene tres partes: `<style>` (CSS), el `<body>` (markup base) y un `<script>` grande (toda la lógica). Para encontrar rápido qué tocar, el archivo tiene **dos índices internos** y encabezados de sección numerados. Buscá el rótulo entre corchetes o el nombre de bloque.

### CSS — dentro del `<style>`

Arranca con un comentario de paleta + un **ÍNDICE DEL CSS** (bloques A–E):

- **A. TOKENS** — `:root` (claro) y `[data-theme="dark"]`. Acá viven todos los colores.
- **B. BASE / LAYOUT** — reset, grilla general, contenido principal.
- **C. COMPONENTES** — botones, cards, formularios, tabla, modal, calendario, galería, etc.
- **D. RESPONSIVE** — `/* Mobile */`.
- **E. AJUSTES Y REFINAMIENTOS** — bloque al final, marcado con `== AJUSTES Y REFINAMIENTOS ==`. Son parches que **pisan** reglas de arriba a propósito. **Si cambiás un estilo y no se ve el efecto, buscá un override acá.**

### JavaScript — dentro del `<script>` principal

Arranca con un **ÍNDICE DEL JAVASCRIPT** con secciones `[01]`–`[24]`. Cada sección tiene su encabezado `// [NN] NOMBRE`. Buscá `[NN]` para saltar.

| # | Sección | Qué contiene |
|---|---|---|
| 01 | DATA STORE | `defaultData`, objeto `db` (modelo en memoria) |
| 02 | PALETA JS | colores para los gráficos Chart.js |
| 03 | PERSISTENCIA | IndexedDB: `openIDB`, `saveDB`, `loadIDB` |
| 04 | IMPORT / EXPORT | archivo `.vetcare`: `loadFromFile` |
| 05 | BOOT | arranque: `startApp`, `createNewDB` |
| 06 / 06b | UTILS | `uid`, `toast`, `exportVetcare`; y formato/texto: `formatDate`, `calcAge`, `escapeHtml`, `escapeAttr`, `cleanPhone` |
| 07 | THEME | modo claro/oscuro |
| 08 | NAVIGATION / RENDER | `navigateTo`, `render` (router de vistas) |
| 09 | VISTA: DASHBOARD | |
| 10 | VISTA: HOY | `renderToday` (está físicamente al final del archivo) |
| 11 / 11b | VISTA: PACIENTES / FICHA | lista + ficha completa (historia, estudios, fotos, vacunas) |
| 12 | VISTA: TUTORES | |
| 13 | VISTA: TURNOS | |
| 14 | VISTA: PELUQUERÍA | |
| 15 | VISTA: CALENDARIO | |
| 16 | VISTA: AVISOS | |
| 17 | VISTA: CUMPLEAÑOS | |
| 18 | VISTA: INVENTARIO | |
| 19 | VISTA: FACTURACIÓN | |
| 20 | VISTA: RESPALDO | |
| 21 | BÚSQUEDA GLOBAL + BADGES | |
| 22 | MODAL HELPERS | `showModal`, `closeModal` |
| 23 | SEED DEMO | datos de ejemplo (solo primer arranque) |
| 24 | INIT | `initApp` (punto de entrada) |

### Patrón de cada vista (importante para desarrollar)

Casi todas las vistas siguen el mismo esqueleto; entendés una, entendés todas:

- `renderX()` — arma el HTML de la vista y lo devuelve como string.
- `openXModal(id)` — abre el formulario (usa `showModal(html)`).
- `saveX(id, isNew)` — lee el form, actualiza `db`, llama `saveDB()`, cierra modal y re-renderiza.
- `deleteX(id)` — confirma con `showConfirm(...)`, borra de `db`, guarda y re-renderiza.

> **Regla práctica:** para agregar un campo a una entidad (ej: paciente), tocás `openPetModal` (form), `savePet` (lectura) y el `render`/ficha donde se muestra. Nada más.

---

## 2. Adónde vamos (arquitectura objetivo)

| Componente | Rol |
|---|---|
| **GitHub** | Código fuente + deploys automáticos |
| **Cloudflare Pages** | Sirve el HTML/CSS/JS estático |
| **Cloudflare Worker** | API REST: auth, CRUD, lógica de negocio |
| **Cloudflare D1** | Base de datos SQLite en la nube (fuente de verdad) |
| **Cloudflare R2** | Archivos de estudios clínicos (Rx, ecografías, fotos) |
| **IndexedDB** | Pasa a ser solo caché offline |

Escala objetivo: **2-3 admins, 300-400 clientes.** Todo entra holgado en los planes free de Cloudflare.

---

## 3. Reglas de trabajo (cómo programamos juntos)

1. **Un archivo HTML completo y funcional por entrega.** Si se corrige algo, se entrega el archivo entero corregido, no fragmentos.
2. **Diseño liviano, sin frameworks pesados.** Solo CDNs puntuales y justificados.
3. **Compatible mobile y desktop** siempre.
4. **No tocar la capa de datos y la UI en el mismo cambio.** Primero infraestructura, después UI.
5. **Comentarios mínimos** en el código, solo donde aclaran algo no obvio.
6. **Cada cambio se anota en el changelog** (sección 7) con fecha.
7. **Antes de migrar una función de datos, dejar IndexedDB como fallback** hasta confirmar que el endpoint nuevo anda.
8. **Respetar los índices internos del código** (sección 1.ter): al agregar una función, ponela en su sección `[NN]`; al agregar un componente CSS, en su bloque temático.

---

## 4. Prioridades (de mayor a menor)

| Prioridad | Tema | Esfuerzo |
|---|---|---|
| 🔴 Crítico | Autenticación (no existe login) | Bajo (Cloudflare Access) |
| 🔴 Crítico | Imágenes en Base64 → mover a R2 / links Drive | Medio |
| 🔴 Crítico | Service Worker con blob URL → archivo `sw.js` estático | Bajo |
| 🟠 Alto | Datos solo en IndexedDB → migrar a Worker + D1 | Alto |
| 🟠 Alto | Íconos Unicode sin sentido → Lucide | Bajo |
| 🟡 Medio | Font base 14px → 16px | Muy bajo |
| 🟡 Medio | Bottom nav mobile incompleto | Bajo |
| 🟡 Medio | Labels en mayúsculas 12px difíciles de leer | Muy bajo |
| 🟢 Bajo | Logo "V" genérico → SVG veterinario | Bajo |
| 🟢 Bajo | Estados vacíos sin botón de acción | Muy bajo |

---

## 5. Decisión sobre almacenamiento de estudios

Hoy las imágenes iban en Base64 dentro de la DB, lo cual no escala. Decisión tomada: arrancamos con **links de Google Drive** (transición, costo $0, ya implementado). Más adelante migramos a **Cloudflare R2** (free hasta 10 GB; D1 guarda solo el path). Descartado: Base64 en D1 y Pages como almacenamiento.

---

## 6. Roadmap por fases

### Fase 1 — Infraestructura (sin tocar la UI)
1. Repo en GitHub con `index.html`.
2. Conectar repo a Cloudflare Pages (deploy en cada push a `main`).
3. Worker con health check (`GET /api/health`).
4. D1 con esquema SQL equivalente al `defaultData` de la app.
5. `sw.js` estático reemplazando el registro actual del Service Worker (blob URL).

### Fase 2 — Autenticación
1. Cloudflare Access sobre el dominio de Pages.
2. Pantalla de login que reemplaza la pantalla de bienvenida actual.
3. Worker valida el token de sesión en cada request.

### Fase 3 — Migrar datos al Worker
1. `saveDB()` / `loadIDB()` → `fetch('/api/...')`.
2. Endpoints REST: `GET/POST /api/patients`, `/api/owners`, etc.
3. IndexedDB queda como caché offline.

### Fase 4 — Estudios clínicos
1. ✅ Campo de links a Google Drive (transición inmediata). — hecho 22/06/2026
2. R2 para uploads vía Worker.
3. Reemplazar `uploadPetImages()` (Base64) por el flujo nuevo.

> **Nota de orden de trabajo (decisión 22/06/2026):** la autenticación (Fase 2) se deja para el final. Primero pulimos la app al máximo en local para no complicar la previsualización.

### Fase 5 — UX
1. Íconos Unicode → Lucide.
2. Font base → 16px; labels a `text-transform: none` y 13px.
3. Bottom nav mobile con 5 secciones.
4. Estados vacíos con CTA inline.
5. Confirmaciones de borrado con contexto (nombre del registro).
6. Logo SVG veterinario.

---

## 7. Changelog

| Fecha | Cambio |
|---|---|
| 22/06/2026 | Creación del documento base. Elegido el beta como punto de partida (el otro tenía backticks mal escapados que rompían el JS). |
| 22/06/2026 | Renombrado el archivo base a `index.html` y eliminados los dos HTML originales. |
| 22/06/2026 | **Estudios clínicos por link de Drive (Fase 4 transitoria).** Pestaña de estudios dividida en "Estudios clínicos (links a Drive)" (tipo/título/fecha/URL, agregar/editar/eliminar) y "Fotos del paciente". Nuevo campo `studies[]` en el schema. Funciones: `studyModal`, `addStudyLink`, `editStudyLink`, `saveStudyLink`, `deleteStudyLink`, `studyIcon`, `normalizeUrl`. |
| 22/06/2026 | **Rediseño de paleta a violeta cálida** (sección 1.bis). Reemplazadas todas las variables CSS (light + dark), `theme-color`, colores de los gráficos, paleta JS `PALETTE` y fondo de la hoja de impresión. Agregados: rojo destructivo, texto terciario, `.btn-warm`. |
| 22/06/2026 | **Limpieza y ordenamiento del código.** JS reorganizado con índice navegable y 24 secciones numeradas (`[01]`–`[24]`); utilidades agrupadas; encabezados corregidos (Facturación/Respaldo estaban mal etiquetados). CSS con índice (bloques A–E) y separador de "Ajustes y refinamientos". Verificado: 116 funciones idénticas antes/después, sintaxis OK, carga sin errores. |
| 22/06/2026 | **Integración del isotipo de marca.** Reemplazada la "V" genérica por el isotipo del `kit_isotipo_veterinaria` (cruz violeta + calendario + perro/gato). Embebido inline como SVG (autocontenido): versión `complete` en el sidebar y en la pantalla de bienvenida, y `micro` como favicon SVG. La cruz usa `currentColor` (toma `--accent`), las siluetas usan `--bg-alt` para que funcione en claro/oscuro. |
| 22/06/2026 | **Revisión del sistema tipográfico** (sección 1.quater). Escala única en `rem` con tokens `--fs-*` (base subida a 16px), pesos reducidos a tres (`--fw-*`), interlineado tokenizado. Reemplazados todos los `font-size` hardcodeados del CSS por tokens; eliminados valores arbitrarios y la escala vieja `--text-*` que no se usaba. Labels de formulario sin mayúscula. Íconos y hojas de impresión quedan fuera de la escala a propósito. |
| 22/06/2026 | **Rediseño de navegación, menús y botones** (sección 1.quinquies). Menú lateral agrupado por frecuencia de uso (4 grupos con etiquetas); íconos Unicode reemplazados por un set propio de SVG de línea. Bottom-nav mobile real con 4 secciones + hoja "Más" (las 12 vistas accesibles al pulgar), overlay para el sidebar, funciones `toggleSidebar`/`toggleMoreSheet`. Botones con jerarquía clara, foco visible y áreas táctiles ≥42px en mobile. |
| 22/06/2026 | **Integración del icon pack propio** (`vetcare_icon_pack`). Reemplazados los 39 íconos placeholder por el set a medida (mismo formato: viewBox 24, `currentColor`, stroke 1.8). Cubre menú, bottom-nav, hoja "Más", vista Hoy y acciones. |
| 22/06/2026 | **Header móvil rediseñado.** El buscador y un **logo-botón** (isotipo en círculo violeta) conviven en la barra superior sticky; el logo-botón abre el menú lateral y queda siempre visible como marca. Eliminado el hamburguesa flotante que pisaba el buscador. Sidebar móvil más ancho (270px). |
| 22/06/2026 | **Fix vista Hoy en móvil.** Tarjetas a ancho completo en una columna (se corrigió un bug de cascada donde el breakpoint de 1024px forzaba 2 columnas y padding grande en móvil). Encabezado de cada tarjeta reordenado (ícono + título + contador-pill), títulos ya no se parten, estado vacío compacto. |

---

## 8. Nota de entorno (importante)

Durante la edición se detectó que **archivos grandes (~150 KB) a veces se truncan al guardarse** en la carpeta del proyecto: el editor reporta éxito pero el final del archivo queda cortado (sin `</script></body></html>`). 

**Cómo verificar después de un cambio grande:** confirmar que `index.html` termina en `</html>` y que el `<script>` cierra bien. Si quedó truncado, hay que reconstruir el final. Conviene mantener los backups que ya tenés.

---

## 9. Próximo paso sugerido

Fase 5: reemplazar los íconos Unicode del menú por íconos con sentido (Lucide), o subir el tamaño de fuente base. Ambos son de bajo riesgo y mejoran mucho la legibilidad diaria.
