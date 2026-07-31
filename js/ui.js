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
function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d + (d.includes('T')?'':'T12:00:00'));
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
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
// El campo teléfono es texto libre y algunos registros migrados del sistema
// anterior tienen más de un número pegado (ej: "43-8745 15352493"). Se toma
// el primer grupo separado por espacios que tenga pinta de teléfono (6+
// dígitos) en vez de concatenar todo, que daba un número inexistente.
function cleanPhone(p) {
  const raw = String(p || '');
  const tokens = raw.split(/\s+/);
  for (const token of tokens) {
    const digits = token.replace(/\D/g, '');
    if (digits.length >= 6) return digits;
  }
  return raw.replace(/\D/g, '');
}

// No adivinamos código de país/área: si un cliente es de otra localidad y lo
// reconstruimos mal, el mensaje de WhatsApp podría llegarle a un desconocido.
// Solo detectamos si el celular YA tiene pinta de formato completo
// (+54 9 código de área + número, ej: +5492262649798) para poder avisar
// cuando falta, y que una persona lo corrija a mano con el dato real.
function isLikelyFullPhone(p) {
  const digits = cleanPhone(p);
  return digits.length >= 12 && digits.startsWith('54');
}

function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
function escapeAttr(s) { return escapeHtml(s); }

// Como <script> suelto en el navegador estas funciones ya quedan en window;
// esta asignación solo hace falta para poder importarlas como módulo en tests.
globalThis.cleanPhone = cleanPhone;
globalThis.isLikelyFullPhone = isLikelyFullPhone;

// ========================================
// [23] SEED DEMO DATA — datos de ejemplo (solo primer arranque)
// ========================================
