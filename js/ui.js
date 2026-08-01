// Elemento que tenía el foco antes de abrir el modal, para devolvérselo al
// cerrar: si no, el foco vuelve al <body> y quien navega con teclado pierde el
// lugar donde estaba en una lista larga.
let _modalReturnFocus = null;

function showModal(html, large) {
  const c = document.getElementById('modalContainer');
  const active = document.activeElement;
  if (active && active !== document.body && !c.contains(active)) _modalReturnFocus = active;
  c.innerHTML = `<div class="modal-overlay show" onclick="if(event.target===this){const cancel=this.querySelector('[data-modal-cancel]');cancel?cancel.click():closeModal()}"><div class="modal ${large?'modal-lg':''}" role="dialog" aria-modal="true">${html}</div></div>`;
  focusFirstField(c);
}

function closeModal() {
  const c = document.getElementById('modalContainer');
  const hadModal = c.innerHTML !== '';
  c.innerHTML = '';
  if (hadModal && _modalReturnFocus && document.contains(_modalReturnFocus)) {
    try { _modalReturnFocus.focus(); } catch (e) {}
  }
  _modalReturnFocus = null;
}

// Enfoca el primer campo editable. Antes el foco quedaba en <body>: recepción
// tenía que ir al mouse en cada alta, aunque estuviera cargando a máquina.
function focusFirstField(container) {
  const target = container.querySelector(
    'input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
  ) || modalFocusables(container)[0];
  if (target) { try { target.focus(); } catch (e) {} }
}

function modalFocusables(modal) {
  return [...modal.querySelectorAll(
    'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(el => el.offsetParent !== null || el === document.activeElement);
}

// Escape cierra, Tab no se escapa a la página de atrás. El diálogo de confirmar
// tiene prioridad porque puede abrirse encima de un modal.
document.addEventListener('keydown', event => {
  const confirmOverlay = document.getElementById('confirmOverlay');
  if (confirmOverlay && confirmOverlay.classList.contains('show')) {
    if (event.key === 'Escape') {
      event.preventDefault();
      document.getElementById('confirmCancel')?.click();
      return;
    }
    if (event.key === 'Tab') {
      const focusables = modalFocusables(confirmOverlay);
      if (!focusables.length) { event.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (!confirmOverlay.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      return;
    }
    if (event.key === 'Enter' && event.target instanceof Element && event.target.tagName !== 'BUTTON') {
      event.preventDefault(); document.getElementById('confirmOk')?.click();
    }
    return;
  }
  const modal = document.querySelector('#modalContainer .modal');
  if (!modal) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    const cancel = modal.querySelector('[data-modal-cancel]');
    cancel ? cancel.click() : closeModal();
    return;
  }
  // Ctrl+Enter guarda sin ir hasta el botón. Enter solo no alcanza: en un
  // <textarea> de tratamiento se necesita para hacer un salto de línea.
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    const submit = modal.querySelector('.modal-footer .btn-primary');
    if (submit) { event.preventDefault(); submit.click(); }
    return;
  }
  if (event.key !== 'Tab') return;
  const focusables = modalFocusables(modal);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  else if (!modal.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
});

function validateField(fieldId, isValid, message) {
  const field = document.getElementById(fieldId);
  const err = field ? field.closest('.form-group')?.querySelector('.field-error') : null;
  if (isValid) {
    if (err) { err.textContent = ''; err.classList.remove('show'); }
    if (field) field.classList.remove('input-error');
    return true;
  }
  if (err) { err.textContent = message || 'Campo inválido'; err.classList.add('show'); }
  if (field) field.classList.add('input-error');
  return false;
}

let _confirmCb = null;
let _confirmReturnFocus = null;

function closeConfirm(confirmed) {
  const ov = document.getElementById('confirmOverlay');
  ov.classList.remove('show');
  const cb = confirmed ? _confirmCb : null;
  _confirmCb = null;
  const returnFocus = _confirmReturnFocus;
  _confirmReturnFocus = null;
  if (returnFocus && document.contains(returnFocus)) {
    try { returnFocus.focus(); } catch (e) {}
  }
  if (cb) cb();
}

// options.okLabel/okClass permiten reusar el mismo diálogo para confirmaciones
// que no son un borrado (ej: "Guardar igual"); por defecto se comporta como
// siempre ("Eliminar" en rojo), así que los usos existentes no cambian.
function showConfirm(message, onConfirm, options) {
  const opts = options || {};
  _confirmCb = onConfirm;
  _confirmReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const ov = document.getElementById('confirmOverlay');
  document.getElementById('confirmMsg').textContent = message;
  const okBtn = document.getElementById('confirmOk');
  okBtn.textContent = opts.okLabel || 'Eliminar';
  okBtn.className = 'btn ' + (opts.okClass || 'btn-danger');
  okBtn.onclick = () => closeConfirm(true);
  const cancelBtn = document.getElementById('confirmCancel');
  cancelBtn.onclick = () => closeConfirm(false);
  ov.classList.add('show');
  // La opción segura recibe el foco; Enter no confirma una acción destructiva
  // por accidente y Tab queda contenido entre ambos botones.
  try { cancelBtn.focus(); } catch (e) {}
}

// ========================================
// [06b] UTILS (formato y texto) — formatDate, calcAge, cleanPhone, escapeHtml
// ========================================
// Intl.DateTimeFormat se crea una sola vez: construirlo en cada llamada es lo
// caro, y formatDate() se llama miles de veces al armar listas largas (la lista
// de pacientes para elegir en un turno son 4.734 fechas de una).
const _dateFormatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
const _dateCache = new Map();
function formatDate(d) {
  if (!d) return '—';
  const cached = _dateCache.get(d);
  if (cached !== undefined) return cached;
  const date = new Date(d + (d.includes('T')?'':'T12:00:00'));
  const text = _dateFormatter.format(date);
  // Las fechas se repiten mucho entre registros; el tope evita que la caché
  // crezca sin control en una sesión larga.
  if (_dateCache.size < 5000) _dateCache.set(d, text);
  return text;
}

// Mismo motivo: un Intl.Collator reusado en vez de String.localeCompare, que
// arma uno nuevo por comparación al ordenar listas grandes.
const _esCollator = new Intl.Collator('es');
function compareEs(a, b) { return _esCollator.compare(String(a || ''), String(b || '')); }
function calcAge(birthdate) {
  const bd = new Date(birthdate);
  const today = new Date();
  let years = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) years--;
  if (years < 1) {
    const months = (today.getFullYear()-bd.getFullYear())*12 + m;
    return months <= 0 ? 'recién nacido' : `${months} mes${months>1?'es':''}`;
  }
  return `${years} año${years>1?'s':''}`;
}
// El manejo de teléfonos (varios números pegados, formatos locales viejos,
// armado del número internacional para WhatsApp) vive en js/phone.js.

// ========================================
// [06d] CAMPO "PROFESIONAL"
// Era un <input type="text"> vacío en la consulta, el turno, la vacuna y la
// peluquería. Con dos veterinarias rotando alcanzaba con que una escribiera
// "Dra. Laura Perez" y otra "laura perez" para tener dos profesionales
// distintos: no se podía filtrar "mis turnos" ni contar cuántas consultas hizo
// cada una. Ahora es una lista cerrada del equipo, precargada con quien está
// usando la app, y con una salida de escape para suplencias y datos viejos.
// ========================================
const ATTENDING_OTHER = '__other__';

function attendingFieldHTML(id, value, label, userId) {
  const staff = typeof attendingStaffRecords === 'function' ? attendingStaffRecords() : [];
  const current = String(value || '').trim();
  const currentUserId = String(userId || '').trim();
  const caption = label || 'Profesional';
  // Sin servidor (modo local) no hay equipo que ofrecer: se mantiene el campo
  // de texto de siempre para no dejar a nadie sin poder registrar quién atendió.
  if (!staff.length) {
    return `<div class="form-group"><label for="${id}">${escapeHtml(caption)}</label>`
      + `<input type="text" id="${id}" value="${escapeAttr(current)}" placeholder="Nombre del profesional"></div>`;
  }
  const selectedStaff = staff.find(person => person.id === currentUserId)
    || (!currentUserId ? staff.find(person => person.name === current) : null);
  const isKnown = !current || !!selectedStaff;
  const options = ['<option value="">Sin indicar</option>']
    .concat(staff.map(person => `<option value="${escapeAttr(person.id)}" data-name="${escapeAttr(person.name)}"${selectedStaff?.id === person.id ? ' selected' : ''}>${escapeHtml(person.name)}</option>`))
    .concat([`<option value="${ATTENDING_OTHER}"${isKnown ? '' : ' selected'}>Otra persona…</option>`])
    .join('');
  return `<div class="form-group"><label for="${id}">${escapeHtml(caption)}</label>`
    + `<select id="${id}" onchange="attendingFieldToggle('${id}')">${options}</select>`
    + `<input type="text" id="${id}Other" class="input" style="margin-top:6px" placeholder="Nombre de quien atendió"`
    + ` value="${isKnown ? '' : escapeAttr(current)}"${isKnown ? ' hidden' : ''}></div>`;
}

function attendingFieldToggle(id) {
  const select = document.getElementById(id);
  const other = document.getElementById(id + 'Other');
  if (!select || !other) return;
  const isOther = select.value === ATTENDING_OTHER;
  other.hidden = !isOther;
  if (isOther) other.focus();
}

function getAttendingValue(id) {
  const select = document.getElementById(id);
  if (!select) return '';
  if (select.tagName === 'INPUT') return select.value.trim();
  if (select.value !== ATTENDING_OTHER) return select.selectedOptions[0]?.dataset.name || '';
  return (document.getElementById(id + 'Other')?.value || '').trim();
}

function getAttendingUserId(id) {
  const select = document.getElementById(id);
  if (!select || select.tagName === 'INPUT' || !select.value || select.value === ATTENDING_OTHER) return '';
  return select.value;
}

// ========================================
// FILTROS COMPARTIDOS DE LISTADOS
// ========================================
function datePresetBounds(period) {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const to = new Date(from);
  if (period === 'today') return { from: localDateKey(from), to: localDateKey(to) };
  if (period === 'week') {
    const mondayOffset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - mondayOffset);
    to.setTime(from.getTime());
    to.setDate(to.getDate() + 6);
    return { from: localDateKey(from), to: localDateKey(to) };
  }
  if (period === 'month') {
    from.setDate(1);
    to.setMonth(to.getMonth() + 1, 0);
    return { from: localDateKey(from), to: localDateKey(to) };
  }
  return { from: '', to: '' };
}

function dateFilterBounds(state) {
  return state.period === 'custom'
    ? { from: state.from || '', to: state.to || '' }
    : datePresetBounds(state.period);
}

function dateMatchesFilter(date, state) {
  const bounds = dateFilterBounds(state);
  return !!date && (!bounds.from || date >= bounds.from) && (!bounds.to || date <= bounds.to);
}

function dateFilterControls(state, setter) {
  const bounds = dateFilterBounds(state);
  return `<div class="list-filters-date">
    <label>Período<select class="input" onchange="${setter}('period',this.value)">
      <option value="today" ${state.period==='today'?'selected':''}>Hoy</option>
      <option value="week" ${state.period==='week'?'selected':''}>Esta semana</option>
      <option value="month" ${state.period==='month'?'selected':''}>Este mes</option>
      <option value="all" ${state.period==='all'?'selected':''}>Todo</option>
      <option value="custom" ${state.period==='custom'?'selected':''}>Personalizado</option>
    </select></label>
    <label>Desde<input class="input" type="date" value="${escapeAttr(bounds.from)}" onchange="${setter}('from',this.value)"></label>
    <label>Hasta<input class="input" type="date" value="${escapeAttr(bounds.to)}" onchange="${setter}('to',this.value)"></label>
  </div>`;
}

function professionalMatches(record, filter, idKey, nameKey) {
  if (!filter) return true;
  const id = String(record[idKey] || '');
  const name = String(record[nameKey] || '').trim();
  if (filter === 'mine') {
    if (!currentUser) return false;
    return id ? id === currentUser.id : !!name && name === currentUser.name;
  }
  if (filter.startsWith('user:')) {
    const userId = filter.slice(5);
    const person = (typeof attendingStaffRecords === 'function' ? attendingStaffRecords() : []).find(item => item.id === userId);
    return id ? id === userId : !!person && name === person.name;
  }
  if (filter.startsWith('name:')) return name === filter.slice(5);
  if (filter === 'unassigned') return !id && !name;
  return true;
}

function professionalFilterOptions(records, idKey, nameKey, selected, includeMine) {
  const staff = typeof attendingStaffRecords === 'function' ? attendingStaffRecords() : [];
  const currentIsStaff = !!currentUser && staff.some(person => person.id === currentUser.id);
  const knownNames = new Set(staff.map(person => person.name));
  const historical = [...new Set(records.map(record => String(record[nameKey] || '').trim()).filter(name => name && !knownNames.has(name)))].sort(compareEs);
  const option = (value, label) => `<option value="${escapeAttr(value)}"${selected===value?' selected':''}>${escapeHtml(label)}</option>`;
  return option('', 'Cualquier persona')
    + (includeMine && currentIsStaff ? option('mine', 'Mis turnos') : '')
    + staff.map(person => option('user:' + person.id, person.name)).join('')
    + historical.map(name => option('name:' + name, name + ' · registro histórico')).join('')
    + option('unassigned', 'Sin asignar');
}

function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
function escapeAttr(s) { return escapeHtml(s); }

function autoGrow(field) {
  if (!field) return;
  field.style.height = 'auto';
  field.style.height = Math.min(Math.max(field.scrollHeight, 76), 260) + 'px';
}

// ========================================
// [23] SEED DEMO DATA — datos de ejemplo (solo primer arranque)
// ========================================
