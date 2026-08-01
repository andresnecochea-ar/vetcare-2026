/* =====================================================================
   [06c] TELÉFONOS — normalización para WhatsApp y llamadas
   ---------------------------------------------------------------------
   El campo teléfono es texto libre y la base migrada del sistema anterior
   guarda formatos locales viejos, muchas veces con varios números pegados:

     "43-8745 15352493"          fijo + celular
     "MARCELA 15406287 15507188" nombre + dos celulares
     "52- 8706 15658326"         fijo con guión suelto + celular
     "02262 458888"              fijo con código de área con 0

   Antes se tomaba el PRIMER grupo con 6+ dígitos, que en estos datos suele
   ser el fijo, y se lo pegaba tal cual en wa.me/. El resultado era un enlace
   a un número inexistente sin que nadie se enterara: sobre 3.417 tutores con
   teléfono, ninguno producía un enlace de WhatsApp válido.

   Ahora cada token se clasifica por su forma y se reconstruye el número
   internacional con el código de país y de área configurados en Opciones:

     54 9 …               ya internacional  → celular, se usa tal cual
     10 dígitos           nacional completo → 54 9 <número>
     15 + 6 dígitos       celular local     → 54 9 <área> <número sin el 15>
     6 a 8 dígitos        fijo local        → 54 <área> <número>, no da WhatsApp

   Sólo las tres primeras formas habilitan WhatsApp. Lo que no encaja en
   ninguna queda sin resolver a propósito: waPhone() devuelve '' y quien lo
   llama muestra "Sin WhatsApp" con el motivo, en vez de un enlace que falla.
   Tampoco se adivina el área cuando no está configurada.

   Sobre la base real (3.417 tutores con teléfono) esto pasa de 0 a ~3.000
   enlaces utilizables; el resto son fijos genuinos y quedan listados en
   Opciones › Revisar teléfonos sin WhatsApp para corregirlos a mano.
   ===================================================================== */

const PHONE_DEFAULT_COUNTRY = '54';

// Config vigente. Vive en Opciones › Datos de la clínica para que una persona
// administradora pueda ajustarla sin tocar código (una veterinaria de otra
// localidad sólo cambia el área).
function phoneConfig() {
  const settings = (typeof db !== 'undefined' && db && db.settings) || {};
  const country = String(settings.phoneCountryCode || PHONE_DEFAULT_COUNTRY).replace(/\D/g, '');
  const area = String(settings.phoneAreaCode || '').replace(/\D/g, '');
  return { country: country || PHONE_DEFAULT_COUNTRY, area };
}

// Separa el texto libre en grupos separados por espacios y deja sólo los
// dígitos de cada uno, para que "43-8745" siga siendo un número y "SRA" o "T"
// se descarten solos. Se agrega al final la concatenación de todo, que es la
// lectura correcta cuando alguien escribe "+54 9 2262 64-9798" con espacios.
function phoneRawTokens(raw) {
  const text = String(raw || '');
  const tokens = text.split(/\s+/).map(token => token.replace(/\D/g, '')).filter(Boolean);
  const joined = tokens.join('');
  if (tokens.length > 1 && joined) tokens.push(joined);
  return tokens;
}

// Clasifica un token ya reducido a dígitos. Devuelve null si no alcanza a ser
// un teléfono, o { kind, e164, needsArea } si sí.
//   kind: 'mobile' sirve para WhatsApp; 'landline' sólo para llamar.
//   needsArea: true cuando hace falta el área configurada y todavía no está.
function phoneClassify(digits, config) {
  const cfg = config || phoneConfig();
  let d = String(digits || '').replace(/\D/g, '');
  if (d.length < 6) return null;
  // Formato nacional viejo con 0 adelante: 011…, 02262…
  if (d.startsWith('0') && d.length >= 11) d = d.replace(/^0+/, '');

  // Ya viene en formato internacional de celular argentino (54 9 …).
  if (d.length >= 12 && d.startsWith(cfg.country + '9')) {
    return { kind: 'mobile', e164: d, needsArea: false };
  }
  // Área local + 15 + número, todo pegado (ej: "226215556326").
  if (cfg.area && d.startsWith(cfg.area + '15') && d.length >= cfg.area.length + 8) {
    return { kind: 'mobile', e164: cfg.country + '9' + cfg.area + d.slice(cfg.area.length + 2), needsArea: false };
  }
  // Número nacional completo: en Argentina son siempre 10 dígitos (área de 2 a
  // 4 + abonado). Se asume celular y se le agrega el 9. En la base son casi
  // todos de otra localidad (11 Buenos Aires, 2983, 2235…), o sea el celular
  // que dejó alguien que se mudó; y si alguno fuera un fijo, WhatsApp responde
  // "el número no está registrado" en vez de escribirle a un desconocido.
  // Se excluyen los que empiezan con 15 porque ningún código de área es 15.
  if (d.length === 10 && !d.startsWith('15')) {
    return { kind: 'mobile', e164: cfg.country + '9' + d, needsArea: false };
  }
  // Celular local del formato viejo: 15 + 6 dígitos. Es la forma dominante en
  // la base (2.744 de 2.770 tokens que empiezan con 15). Los de 9 o 10 dígitos
  // son de otra área (ej: "153520058" es Rosario) y se dejan sin resolver
  // antes que inventarles el área local y mandarle el mensaje a un vecino.
  if (d.startsWith('15') && d.length === 8) {
    if (!cfg.area) return { kind: 'mobile', e164: '', needsArea: true };
    return { kind: 'mobile', e164: cfg.country + '9' + cfg.area + d.slice(2), needsArea: false };
  }
  // Internacional sin el 9: es un fijo, o un celular mal cargado. No le
  // agregamos el 9 porque no hay forma de saber cuál de los dos es.
  if (d.length >= 11 && d.startsWith(cfg.country)) {
    return { kind: 'landline', e164: d, needsArea: false };
  }
  // Fijo local: 6 a 8 dígitos sueltos.
  if (d.length <= 8) {
    if (!cfg.area) return { kind: 'landline', e164: '', needsArea: true };
    return { kind: 'landline', e164: cfg.country + cfg.area + d, needsArea: false };
  }
  return null;
}

// Todos los números reconocibles del campo, en el orden en que aparecen.
function phoneCandidates(raw, config) {
  const cfg = config || phoneConfig();
  const seen = new Set();
  const out = [];
  for (const token of phoneRawTokens(raw)) {
    const candidate = phoneClassify(token, cfg);
    if (!candidate) continue;
    const key = candidate.kind + ':' + (candidate.e164 || token);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...candidate, raw: token });
  }
  return out;
}

// Número para WhatsApp, o '' si no se puede armar uno con confianza.
// El celular gana siempre al fijo, aunque el fijo venga primero en el texto.
// Acepta varios campos (ej: teléfono principal y alternativo del tutor): si el
// principal es un fijo, sirve el celular del alternativo.
function waPhone(raw) {
  for (const value of (Array.isArray(raw) ? raw : [raw])) {
    const mobile = phoneCandidates(value).find(c => c.kind === 'mobile' && c.e164);
    if (mobile) return mobile.e164;
  }
  return '';
}

// Número para el enlace tel:. Acá sí sirve el fijo, así que se acepta
// cualquiera de los dos, con el celular como preferencia.
function telPhone(raw) {
  const candidates = phoneCandidates(raw).filter(c => c.e164);
  const preferred = candidates.find(c => c.kind === 'mobile') || candidates[0];
  return preferred ? preferred.e164 : cleanPhone(raw);
}

// Por qué no se puede mandar un WhatsApp a este teléfono. null = se puede.
function phoneIssue(raw) {
  const values = (Array.isArray(raw) ? raw : [raw]).filter(v => String(v || '').trim());
  if (!values.length) return 'empty';
  const candidates = values.flatMap(value => phoneCandidates(value));
  if (!candidates.length) return 'unreadable';
  if (candidates.some(c => c.kind === 'mobile' && c.e164)) return null;
  if (candidates.some(c => c.needsArea)) return 'no-area';
  return 'landline-only';
}

const PHONE_ISSUE_TEXT = {
  empty: 'Sin teléfono cargado',
  unreadable: 'El teléfono no tiene un formato reconocible',
  'no-area': 'Falta el código de área en Opciones › Datos de la clínica',
  'landline-only': 'Sólo hay un teléfono fijo: WhatsApp necesita un celular'
};

function phoneIssueText(raw) {
  const issue = phoneIssue(raw);
  return issue ? (PHONE_ISSUE_TEXT[issue] || 'Teléfono incompleto') : '';
}

// Un único número plausible en crudo (sin código de país ni área). Se mantiene
// porque hay lugares que sólo muestran dígitos, pero ahora prefiere el celular:
// en "43-8745 15352493" el número útil es el segundo, no el primero.
function cleanPhone(p) {
  const raw = String(p || '');
  const tokens = String(raw).split(/\s+/)
    .map(token => token.replace(/\D/g, ''))
    .filter(token => token.length >= 6);
  const mobile = tokens.find(token => token.startsWith('15'));
  if (mobile) return mobile;
  if (tokens.length) return tokens[0];
  return raw.replace(/\D/g, '');
}

// ¿El dato guardado ya está en formato internacional completo? Se usa para
// distinguir "lo cargaron bien" de "lo estamos reconstruyendo nosotros".
function isLikelyFullPhone(p) {
  const digits = String(p || '').replace(/\D/g, '');
  return digits.length >= 12 && digits.startsWith(PHONE_DEFAULT_COUNTRY);
}

// Botón de WhatsApp listo para insertar. Cuando el número no permite armar un
// celular válido NO se devuelve un enlace roto: se devuelve una marca que dice
// qué falta y, si se pasa fixOnclick, lleva directo a corregir el teléfono.
//   opts.message   texto del mensaje (sin codificar)
//   opts.label     texto del botón (por defecto "WhatsApp")
//   opts.cls       clases extra del botón
//   opts.title     title del botón
//   opts.fixOnclick  acción para corregir el teléfono (abre la ficha del tutor)
function waButtonHTML(phone, opts) {
  const options = opts || {};
  const number = waPhone(phone);
  const label = options.label || 'WhatsApp';
  const cls = 'contact-btn wa' + (options.cls ? ' ' + options.cls : '');
  if (number) {
    const query = options.message ? '?text=' + encodeURIComponent(options.message) : '';
    const title = options.title ? ` title="${escapeAttr(options.title)}"` : '';
    return `<a class="${cls}" href="https://wa.me/${number}${query}" target="_blank" rel="noopener"${title}>${escapeHtml(label)}</a>`;
  }
  const reason = phoneIssueText(phone);
  if (phoneIssue(phone) === 'empty') return '';
  const title = escapeAttr(reason + '. Tocá para corregir el teléfono.');
  if (!options.fixOnclick) {
    return `<span class="contact-btn is-unavailable" title="${title}">Sin WhatsApp</span>`;
  }
  return `<button type="button" class="contact-btn is-unavailable" title="${title}" onclick="${escapeAttr(options.fixOnclick)}">Sin WhatsApp</button>`;
}

// Como <script> suelto en el navegador estas funciones ya quedan en window;
// esta asignación solo hace falta para poder importarlas como módulo en tests.
globalThis.cleanPhone = cleanPhone;
globalThis.isLikelyFullPhone = isLikelyFullPhone;
globalThis.waPhone = waPhone;
globalThis.telPhone = telPhone;
globalThis.phoneIssue = phoneIssue;
globalThis.phoneCandidates = phoneCandidates;
globalThis.phoneIssueText = phoneIssueText;
