# VetCare — Brief para juego de íconos propio

> Documento para generar un set de íconos a medida en una IA generativa (o con un diseñador).
> Basado en TODOS los íconos que la app usa hoy. Creado: 22/06/2026.

---

## 1. Estilo visual pedido (prompt base)

Pegá esto como instrucción general antes de pedir cada ícono:

> Diseñá un ícono de estilo **línea (outline)**, trazo uniforme de ~1.8px sobre lienzo de 24×24, esquinas y terminaciones **redondeadas** (round cap / round join), geometría simple y legible a 18–24px. **Un solo color**, sin relleno, sin sombras ni degradados — el color se aplica después por software (usar `currentColor`). Estética **cálida y amable**, coherente con una app veterinaria de identidad violeta (#6F2DBD). Padding interno de ~2px (que el dibujo no toque el borde del lienzo). Entregar como **SVG optimizado**, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`. Que combine con un isotipo de cruz veterinaria + calendario + siluetas de perro y gato.

**Especificaciones técnicas (constantes para todo el set):**

- Formato: SVG, `viewBox="0 0 24 24"`
- Trazo: `stroke="currentColor"`, `stroke-width="1.8"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`
- Sin texto, sin color hardcodeado, sin efectos
- Peso visual homogéneo entre todos los íconos (que ninguno se vea más "pesado" que el resto)
- Deben funcionar en claro y oscuro (por eso un solo trazo de color heredado)

---

## 2. Íconos del menú principal (12) — prioridad alta

Son los más visibles: aparecen en el menú lateral y en la barra inferior móvil.

| # | Nombre clave | Sección | Descripción del ícono |
|---|---|---|---|
| 1 | `hoy` | Hoy | Vista del día / "ahora". Sugerencia: un sol simple, o un círculo con rayos, o un reloj marcando el día. Debe sentirse como "lo de hoy / agenda del día". |
| 2 | `turnos` | Turnos clínicos | Cita médica agendada. Calendario con un check, o una hoja de agenda con una marca. Diferente del de Calendario (este es "una cita", no "el mes"). |
| 3 | `peluqueria` | Peluquería / grooming | Tijera de peluquería, o cepillo/peine de mascota. Que se lea como aseo/estética animal. |
| 4 | `calendario` | Calendario | Vista mensual. Calendario con cuadrícula de días (distinto de Turnos, que es una sola cita). |
| 5 | `pacientes` | Pacientes | El animal/paciente. Una huella (pata) es lo más claro, o una cabeza de perro+gato combinada. Es la sección estrella. |
| 6 | `tutores` | Tutores / dueños | La persona responsable del animal. Una o dos siluetas de persona (busto). Puede insinuar "persona + mascota". |
| 7 | `panel` | Panel / dashboard | Tablero con métricas. Grilla de bloques/widgets, o mini-gráfico de barras. |
| 8 | `avisos` | Avisos / recordatorios | Campana de notificación. Puede tener un puntito de alerta. |
| 9 | `inventario` | Inventario | Stock de productos. Caja/paquete, o estante con cajas. Insumos veterinarios. |
| 10 | `facturacion` | Facturación | Recibo o factura. Papel con líneas y borde inferior dentado, o ticket. |
| 11 | `cumpleanos` | Cumpleaños | Cumpleaños de la mascota. Torta con una velita, festivo pero sobrio. |
| 12 | `respaldo` | Respaldo / backup | Copia de seguridad de datos. Cilindros de base de datos apilados, o nube con flecha, o disco. |

---

## 3. Íconos de acción y estado — prioridad media

Aparecen en botones, modales y fichas. También conviene que sean del mismo set.

| # | Nombre clave | Uso en la app | Descripción del ícono |
|---|---|---|---|
| 13 | `mas` / `agregar` | Botones "+ Nuevo/Agregar" | Signo más (+). Limpio, centrado. |
| 14 | `editar` | Editar registro | Lápiz. |
| 15 | `eliminar` | Borrar registro | Tacho de basura, o una X (definir uno). |
| 16 | `cerrar` | Cerrar modal/panel | X de cierre. |
| 17 | `confirmar` | Acción completada / guardado | Tilde (check). |
| 18 | `buscar` | Búsqueda global | Lupa. |
| 19 | `mas-opciones` | Botón "Más" (menú móvil) | Tres puntos (horizontal) o cuadrícula de apps. |
| 20 | `menu` | Abrir menú lateral (hamburguesa) | Tres líneas horizontales. |
| 21 | `imprimir` | Imprimir historia/factura | Impresora. |
| 22 | `descargar` | Exportar / descargar archivo | Flecha hacia abajo a una bandeja. |
| 23 | `tema-oscuro` | Activar modo oscuro | Luna. |
| 24 | `tema-claro` | Activar modo claro | Sol. |
| 25 | `alerta` | Advertencias (stock bajo, borrado) | Triángulo con signo de exclamación. |
| 26 | `enlace` | Link a Drive (estudios) | Eslabón de cadena. |

---

## 4. Íconos de contacto — prioridad media

En la ficha del tutor (botones de contacto rápido).

| # | Nombre clave | Uso | Descripción |
|---|---|---|---|
| 27 | `telefono` | Llamar al tutor | Auricular de teléfono. |
| 28 | `email` | Enviar mail | Sobre. |
| 29 | `ubicacion` | Dirección del tutor | Pin de mapa. |
| 30 | `whatsapp` | Mensaje por WhatsApp | Globo de chat (genérico, sin marca registrada). |

---

## 5. Íconos clínicos — prioridad media-baja

Aparecen en la ficha del paciente: signos vitales y tipos de estudio. Le dan carácter "veterinario" al set.

| # | Nombre clave | Uso | Descripción |
|---|---|---|---|
| 31 | `vitales` | Encabezado "Signos vitales" | Cruz médica, o corazón con pulso. |
| 32 | `peso` | Peso del animal | Balanza / pesa. |
| 33 | `temperatura` | Temperatura | Termómetro. |
| 34 | `corazon` | Frecuencia cardíaca | Corazón (línea), opcionalmente con onda de pulso. |
| 35 | `radiografia` | Estudio: radiografía | Hueso dentro de un recuadro, o placa de Rx. |
| 36 | `ecografia` | Estudio: ecografía | Onda de ultrasonido / ondas concéntricas. |
| 37 | `laboratorio` | Estudio: análisis | Tubo de ensayo / matraz. |
| 38 | `receta` | Estudio: receta | Hoja con líneas y símbolo Rx, o portapapeles. |
| 39 | `informe` | Estudio: informe | Documento/hoja con texto. |

---

## 6. Notas para quien genere los íconos

- **Coherencia ante todo:** todos los íconos deben verse de la misma familia. Mismo grosor de línea, mismo nivel de detalle, mismas esquinas redondeadas. Es preferible un set simple y uniforme que íconos muy detallados pero dispares.
- **Diferenciar los parecidos:** `turnos` vs `calendario` (una cita vs el mes), `avisos` (campana) vs `cumpleaños` (torta), `eliminar` vs `cerrar`.
- **Prioridad:** si hay que generar por tandas, empezar por los 12 del menú (sección 2), luego acciones (sección 3), y por último clínicos (sección 5).
- **Entrega ideal:** un SVG por ícono, nombrado con su `nombre clave` (ej: `pacientes.svg`, `turnos.svg`). Si la IA entrega un solo SVG con todos, pedile que los separe o que use un `viewBox` por símbolo.
- **Test rápido:** mirá cada ícono a 18px en gris sobre blanco. Si no se entiende qué es sin la etiqueta, simplificar.

---

## 7. Cómo los integramos después

Cuando tengas los SVG, pasámelos (o ponelos en una carpeta del proyecto) y yo los embebo en `index.html` reemplazando los actuales, manteniendo `stroke="currentColor"` para que tomen la paleta violeta y el modo oscuro automáticamente. No hace falta que vengan coloreados.
