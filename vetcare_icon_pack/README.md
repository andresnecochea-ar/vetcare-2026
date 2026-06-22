# VetCare — Pack de íconos SVG

Set generado a partir del brief `ICONOS_BRIEF.md`.

## Contenido

- 39 íconos SVG nombrados con su clave de uso.
- Un SVG por ícono, separados por categoría: `menu`, `acciones`, `contacto`, `clinicos`.
- Copia plana con todos los íconos en `svg/all`.
- Sprite SVG en `sprite/vetcare-icons-sprite.svg`.
- Vista previa en `preview/preview.html` y `preview/preview_vetcare_iconos.png`.
- Manifiesto en `manifest.json`.

## Especificación aplicada

Todos los SVG usan:

```svg
viewBox="0 0 24 24"
fill="none"
stroke="currentColor"
stroke-width="1.8"
stroke-linecap="round"
stroke-linejoin="round"
```

No tienen color hardcodeado, texto, sombras ni degradados.

## Integración rápida

```html
<img src="svg/menu/pacientes.svg" alt="Pacientes">
```

```html
<svg class="icon">
  <use href="sprite/vetcare-icons-sprite.svg#icon-pacientes"></use>
</svg>
```

```css
.icon {
  width: 24px;
  height: 24px;
  color: #6F2DBD;
}
```

## Lista de íconos

- `hoy` — Hoy (menu)
- `turnos` — Turnos clínicos (menu)
- `peluqueria` — Peluquería (menu)
- `calendario` — Calendario (menu)
- `pacientes` — Pacientes (menu)
- `tutores` — Tutores (menu)
- `panel` — Panel (menu)
- `avisos` — Avisos (menu)
- `inventario` — Inventario (menu)
- `facturacion` — Facturación (menu)
- `cumpleanos` — Cumpleaños (menu)
- `respaldo` — Respaldo (menu)
- `mas` — Más / agregar (acciones)
- `editar` — Editar (acciones)
- `eliminar` — Eliminar (acciones)
- `cerrar` — Cerrar (acciones)
- `confirmar` — Confirmar (acciones)
- `buscar` — Buscar (acciones)
- `mas-opciones` — Más opciones (acciones)
- `menu` — Menú (acciones)
- `imprimir` — Imprimir (acciones)
- `descargar` — Descargar (acciones)
- `tema-oscuro` — Tema oscuro (acciones)
- `tema-claro` — Tema claro (acciones)
- `alerta` — Alerta (acciones)
- `enlace` — Enlace (acciones)
- `telefono` — Teléfono (contacto)
- `email` — Email (contacto)
- `ubicacion` — Ubicación (contacto)
- `whatsapp` — Mensaje (contacto)
- `vitales` — Signos vitales (clinicos)
- `peso` — Peso (clinicos)
- `temperatura` — Temperatura (clinicos)
- `corazon` — Corazón (clinicos)
- `radiografia` — Radiografía (clinicos)
- `ecografia` — Ecografía (clinicos)
- `laboratorio` — Laboratorio (clinicos)
- `receta` — Receta (clinicos)
- `informe` — Informe (clinicos)
