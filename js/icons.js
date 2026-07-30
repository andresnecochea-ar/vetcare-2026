// ========================================
// [01b] ICONOS — un solo sistema para toda la app
// ========================================
// Antes convivían dos: los SVG de trazo del menú lateral y ~40 emoji sueltos
// repartidos por las vistas (🩻 y 🔗 como iconos de estudio, 📞 ✉ 📍 en
// tutores, ⚠ ✓ en estados). Los emoji cambian de dibujo según el sistema
// operativo, no toman el color del tema y desalinean la línea de base.
//
// Especificación, igual a la del set original y a design/vetcare_icon_pack_extra:
//   viewBox 0 0 24 24 · fill none · stroke currentColor · stroke-width 1.8
//   stroke-linecap round · stroke-linejoin round
// Tamaño: se controla por CSS con --icon-sm (16) / --icon-md (20) / --icon-lg (24).

const VETCARE_ICONS = {
  // — pacientes y ficha —
  paw: '<circle cx="7.5" cy="8" r="1.8"/><circle cx="12" cy="6.2" r="1.8"/><circle cx="16.5" cy="8" r="1.8"/><path d="M12 10.5c-2.6 0-4.8 2-4.8 4.3 0 1.6 1.2 2.7 2.8 2.7h4c1.6 0 2.8-1.1 2.8-2.7 0-2.3-2.2-4.3-4.8-4.3Z"/>',
  users: '<path d="M15.5 20v-1.6a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.4V20"/><circle cx="9.2" cy="7.6" r="3.2"/><path d="M21 20v-1.6a3.6 3.6 0 0 0-2.7-3.5M15.6 4.6a3.6 3.6 0 0 1 0 6.9"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 9.8h17M8.2 3.2v3.4M15.8 3.2v3.4"/>',
  clipboard: '<path d="M9 4.3H7.4A2.2 2.2 0 0 0 5.2 6.5v12.6a2.2 2.2 0 0 0 2.2 2.2h9.2a2.2 2.2 0 0 0 2.2-2.2V6.5a2.2 2.2 0 0 0-2.2-2.2H15"/><rect x="9" y="2.5" width="6" height="3.8" rx="1.2"/><path d="M8.8 11.5h6.4M8.8 15.4h4.4"/>',
  stethoscope: '<path d="M5.5 3v5.2a4.2 4.2 0 0 0 8.4 0V3"/><path d="M4 3h3M12.4 3h3"/><path d="M9.7 12.4v2.3a4.6 4.6 0 0 0 9.2 0v-1.4"/><circle cx="18.9" cy="11.4" r="2"/>',
  weight: '<path d="M5.6 7.5h12.8l2.1 12a1.6 1.6 0 0 1-1.6 1.9H5.1a1.6 1.6 0 0 1-1.6-1.9Z"/><circle cx="12" cy="4.8" r="2.4"/><path d="M9.4 12.6 12 15.8l2.6-3.2"/>',
  thermometer: '<path d="M13.8 14.2V5a1.9 1.9 0 1 0-3.8 0v9.2a4 4 0 1 0 3.8 0Z"/><path d="M11.9 8.6v7.8"/>',
  heart: '<path d="M12 20.3s-7.4-4.6-7.4-9.5a4.1 4.1 0 0 1 7.4-2.5 4.1 4.1 0 0 1 7.4 2.5c0 4.9-7.4 9.5-7.4 9.5Z"/>',
  cake: '<path d="M4 13.2c1.4 0 1.4 1.3 2.7 1.3s1.3-1.3 2.7-1.3 1.3 1.3 2.6 1.3 1.4-1.3 2.7-1.3 1.4 1.3 2.7 1.3 1.3-1.3 2.6-1.3"/><path d="M4 20.6h16"/><path d="M5.6 13.2V10a2.2 2.2 0 0 1 2.2-2.2h8.4A2.2 2.2 0 0 1 18.4 10v3.2M5.6 20.6v-3.9M18.4 20.6v-3.9"/><path d="M12 7.8V5.4M12 3v.6"/>',

  // — estudios e imágenes —
  xray: '<rect x="4" y="3" width="16" height="18" rx="2.2"/><path d="M12 6.6v10.8M9 8.4c1.2.9 1.8 2 1.8 3.6M15 8.4c-1.2.9-1.8 2-1.8 3.6M8.6 13.6c1.4.6 2.1 1.6 2.2 3M15.4 13.6c-1.4.6-2.1 1.6-2.2 3"/>',
  waves: '<path d="M3.4 12h1.8M8 12h1.8M12.6 12h1.8M17.2 12H19"/><path d="M6.6 8.2a7.4 7.4 0 0 1 0 7.6M10.2 6a11.4 11.4 0 0 1 0 12M14.8 8.2a7.4 7.4 0 0 0 0 7.6"/>',
  flask: '<path d="M9.6 3v6L4.7 17.4A2.1 2.1 0 0 0 6.5 20.6h11a2.1 2.1 0 0 0 1.8-3.2L14.4 9V3"/><path d="M8.2 3h7.6M7.2 14.2h9.6"/>',
  document: '<path d="M13.6 3H7.4a2.2 2.2 0 0 0-2.2 2.2v13.6A2.2 2.2 0 0 0 7.4 21h9.2a2.2 2.2 0 0 0 2.2-2.2V8.4Z"/><path d="M13.6 3v5.4h5.2M8.8 13h6.4M8.8 16.6h4.4"/>',
  link: '<path d="M10.2 13.8a3.6 3.6 0 0 0 5.4.4l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.5 1.5"/><path d="M13.8 10.2a3.6 3.6 0 0 0-5.4-.4l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.5-1.5"/>',
  image: '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.2"/><circle cx="8.6" cy="9.6" r="1.6"/><path d="m3.8 16.6 4.6-4.2a1.8 1.8 0 0 1 2.4 0l5.4 5M14.6 13.4l1.6-1.4a1.8 1.8 0 0 1 2.4 0l1.8 1.6"/>',

  // — contacto —
  phone: '<path d="M20.6 16.9v2.5a1.7 1.7 0 0 1-1.9 1.7 16.6 16.6 0 0 1-7.2-2.6 16.3 16.3 0 0 1-5-5 16.6 16.6 0 0 1-2.6-7.3 1.7 1.7 0 0 1 1.7-1.8h2.5a1.7 1.7 0 0 1 1.7 1.5c.1 1 .3 2 .7 2.9a1.7 1.7 0 0 1-.4 1.8l-1 1a13.4 13.4 0 0 0 5 5l1-1a1.7 1.7 0 0 1 1.8-.4c.9.4 1.9.6 2.9.7a1.7 1.7 0 0 1 1.5 1.7Z"/>',
  mail: '<rect x="2.8" y="4.8" width="18.4" height="14.4" rx="2.2"/><path d="m3.4 6.6 7.5 5.2a2 2 0 0 0 2.2 0l7.5-5.2"/>',
  pin: '<path d="M19.2 10.4c0 5.4-7.2 10.3-7.2 10.3s-7.2-4.9-7.2-10.3a7.2 7.2 0 0 1 14.4 0Z"/><circle cx="12" cy="10.2" r="2.6"/>',

  // — estado y avisos —
  alert: '<path d="M10.5 3.9 2.6 17.2a1.8 1.8 0 0 0 1.5 2.7h15.8a1.8 1.8 0 0 0 1.5-2.7L13.5 3.9a1.8 1.8 0 0 0-3 0Z"/><path d="M12 9.2v4M12 16.6h.01"/>',
  check: '<path d="m4.8 12.6 4.6 4.6 9.8-10"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.8"/><path d="m8.2 12.2 2.7 2.7 5-5.2"/>',
  clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 6.9V12l3.4 2"/>',
  bell: '<path d="M18.2 9.6a6.2 6.2 0 1 0-12.4 0c0 5.4-2 6.9-2 6.9h16.4s-2-1.5-2-6.9Z"/><path d="M13.6 20.2a1.9 1.9 0 0 1-3.2 0"/>',
  ban: '<circle cx="12" cy="12" r="8.8"/><path d="m5.8 5.8 12.4 12.4"/>',

  // — dinero —
  money: '<rect x="2.8" y="6" width="18.4" height="12" rx="2.2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.4 10v4M17.6 10v4"/>',
  receipt: '<path d="M5.4 21V4.6a1 1 0 0 1 1.5-.9l1.8 1 1.8-1a1 1 0 0 1 1 0l1.8 1 1.8-1a1 1 0 0 1 1.5.9V21l-2.2-1.2-1.8 1-1.8-1-1.8 1-1.8-1Z"/><path d="M9 9h6M9 12.6h6"/>',

  // — acciones —
  print: '<path d="M6.6 9.4V3.6h10.8v5.8"/><path d="M6.6 17.6H5a2 2 0 0 1-2-2v-4.2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4.2a2 2 0 0 1-2 2h-1.6"/><rect x="6.6" y="14.2" width="10.8" height="6.4" rx="1.2"/>',
  edit: '<path d="M12.4 5.2H5.6a2.2 2.2 0 0 0-2.2 2.2v11a2.2 2.2 0 0 0 2.2 2.2h11a2.2 2.2 0 0 0 2.2-2.2v-6.8"/><path d="M17.6 3.6a2.3 2.3 0 0 1 3.3 3.3L12.3 15.5l-3.9.9.9-3.9Z"/>',
  save: '<path d="M18.6 21H5.4A2.4 2.4 0 0 1 3 18.6V5.4A2.4 2.4 0 0 1 5.4 3h9.8L21 8.8v9.8A2.4 2.4 0 0 1 18.6 21Z"/><path d="M16.6 21v-7.2H7.4V21M7.4 3v4.8h6.6"/>',
  download: '<path d="M20.4 15.6v3.6a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8v-3.6"/><path d="m7.2 10.8 4.8 4.8 4.8-4.8M12 15.6V3.4"/>',
  upload: '<path d="M20.4 15.6v3.6a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8v-3.6"/><path d="m7.2 8.2 4.8-4.8 4.8 4.8M12 3.4v12.2"/>',
  folder: '<path d="M21 18.4a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 18.4V5.6a1.8 1.8 0 0 1 1.8-1.8h4.4l2 2.8h7A1.8 1.8 0 0 1 21 8.4Z"/>',
  sparkle: '<path d="M12 3.2 13.9 9l5.9 1.9-5.9 1.9L12 18.7l-1.9-5.9L4.2 11 10.1 9Z"/><path d="M18.8 3.4v2.8M20.2 4.8h-2.8"/>',
  minus: '<path d="M5.4 12h13.2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  refresh: '<path d="M20.4 12a8.4 8.4 0 1 1-2.5-6"/><path d="M20.6 4.2v4.6H16"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m20 20-4.4-4.4"/>',
  grid: '<rect x="3.6" y="3.6" width="7" height="7" rx="1.6"/><rect x="13.4" y="3.6" width="7" height="7" rx="1.6"/><rect x="3.6" y="13.4" width="7" height="7" rx="1.6"/><rect x="13.4" y="13.4" width="7" height="7" rx="1.6"/>',
  list: '<path d="M8.4 6.4h12M8.4 12h12M8.4 17.6h12M3.8 6.4h.01M3.8 12h.01M3.8 17.6h.01"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.2M12 19.4v2.2M4.2 12H2M22 12h-2.2M6.5 6.5 4.9 4.9M19.1 19.1l-1.6-1.6M17.5 6.5l1.6-1.6M4.9 19.1l1.6-1.6"/>',
  moon: '<path d="M20.4 14.6A8.8 8.8 0 0 1 9.4 3.6a8.8 8.8 0 1 0 11 11Z"/>',
  arrowUp: '<path d="M12 19.4V4.6M5.8 10.8 12 4.6l6.2 6.2"/>',
  arrowDown: '<path d="M12 4.6v14.8M18.2 13.2 12 19.4l-6.2-6.2"/>',
  arrowLeft: '<path d="M19.4 12H4.6M10.8 5.8 4.6 12l6.2 6.2"/>',
};

// Devuelve el SVG listo para insertar en una plantilla.
// `extraClass` sirve para el tamaño: 'ico-sm' | 'ico-lg' (por defecto --icon-md).
function icon(name, extraClass) {
  const d = VETCARE_ICONS[name];
  if (!d) return '';
  return '<svg class="ico' + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 24 24"'
    + ' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"'
    + ' stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>';
}

// Icono del tipo de estudio. Antes esto era un mapa de emoji.
function studyIcon(type) {
  const map = {
    'Radiografía': 'xray',
    'Ecografía': 'waves',
    'Análisis de laboratorio': 'flask',
    'Receta': 'clipboard',
    'Informe': 'document',
  };
  return icon(map[type] || 'link');
}

globalThis.VetCareIcons = { icons: VETCARE_ICONS, icon, studyIcon };
