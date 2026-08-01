function showModal(html, large) {
  const c = document.getElementById('modalContainer');
  c.innerHTML = `<div class="modal-overlay show" onclick="if(event.target===this)closeModal()"><div class="modal ${large?'modal-lg':''}">${html}</div></div>`;
}
function closeModal() {
  document.getElementById('modalContainer').innerHTML = '';
}

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
// options.okLabel/okClass permiten reusar el mismo diálogo para confirmaciones
// que no son un borrado (ej: "Guardar igual"); por defecto se comporta como
// siempre ("Eliminar" en rojo), así que los usos existentes no cambian.
function showConfirm(message, onConfirm, options) {
  const opts = options || {};
  _confirmCb = onConfirm;
  const ov = document.getElementById('confirmOverlay');
  document.getElementById('confirmMsg').textContent = message;
  ov.classList.add('show');
  const okBtn = document.getElementById('confirmOk');
  okBtn.textContent = opts.okLabel || 'Eliminar';
  okBtn.className = 'btn ' + (opts.okClass || 'btn-danger');
  okBtn.onclick = () => {
    ov.classList.remove('show');
    const cb = _confirmCb; _confirmCb = null;
    if (cb) cb();
  };
  document.getElementById('confirmCancel').onclick = () => {
    ov.classList.remove('show'); _confirmCb = null;
  };
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

function attendingFieldHTML(id, value, label) {
  const staff = typeof attendingStaff === 'function' ? attendingStaff() : [];
  const current = String(value || '').trim();
  const caption = label || 'Profesional';
  // Sin servidor (modo local) no hay equipo que ofrecer: se mantiene el campo
  // de texto de siempre para no dejar a nadie sin poder registrar quién atendió.
  if (!staff.length) {
    return `<div class="form-group"><label for="${id}">${escapeHtml(caption)}</label>`
      + `<input type="text" id="${id}" value="${escapeAttr(current)}" placeholder="Nombre del profesional"></div>`;
  }
  const isKnown = !current || staff.includes(current);
  const options = ['<option value="">Sin indicar</option>']
    .concat(staff.map(name => `<option value="${escapeAttr(name)}"${current === name ? ' selected' : ''}>${escapeHtml(name)}</option>`))
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
  if (select.value !== ATTENDING_OTHER) return select.value;
  return (document.getElementById(id + 'Other')?.value || '').trim();
}

function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
function escapeAttr(s) { return escapeHtml(s); }

// ========================================
// [23] SEED DEMO DATA — datos de ejemplo (solo primer arranque)
// ========================================
