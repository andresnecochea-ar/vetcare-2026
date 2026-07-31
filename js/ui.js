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
function showConfirm(message, onConfirm) {
  _confirmCb = onConfirm;
  const ov = document.getElementById('confirmOverlay');
  document.getElementById('confirmMsg').textContent = message;
  ov.classList.add('show');
  document.getElementById('confirmOk').onclick = () => {
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
function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
function escapeAttr(s) { return escapeHtml(s); }

// Como <script> suelto en el navegador estas funciones ya quedan en window;
// esta asignación solo hace falta para poder importarlas como módulo en tests.
globalThis.cleanPhone = cleanPhone;

// ========================================
// [23] SEED DEMO DATA — datos de ejemplo (solo primer arranque)
// ========================================
