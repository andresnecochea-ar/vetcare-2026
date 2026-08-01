function renderReminders() {
  const pending = db.reminders.filter(r => !r.completed).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const completed = db.reminders.filter(r => r.completed).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20);
  return `
    <div class="page-header">
      <div class="title"><small>Recordatorios para profesionales</small><h1>Avisos a pacientes</h1></div>
      <button class="btn btn-primary" onclick="openReminderModal()">+ Nuevo aviso</button>
    </div>
    ${renderSanitaryDue()}
    <h3 style="margin-bottom:10px">Pendientes (${pending.length})</h3>
    ${pending.length === 0 ? '<div class="empty-state">Sin avisos pendientes</div>' : pending.map(r => {
      const pet = db.pets.find(p=>p.id===r.petId);
      const owners = pet ? (pet.ownerIds||[]).map(id=>db.owners.find(o=>o.id===id)).filter(Boolean) : [];
      const days = Math.floor((new Date(r.date)-new Date())/(1000*60*60*24));
      const cls = days<0?'urgent':days<=3?'soon':'';
      return `<div class="reminder-item ${cls}">
        <div class="info">
          <strong>${escapeHtml(r.title)}</strong>
          <small>${pet?`<button type="button" class="link-inline" onclick="openPetDetail('${pet.id}')">${escapeHtml(pet.name)}</button> · `:''}${formatDate(r.date)} ${days<0?'(vencido '+(-days)+'d)':days===0?'(HOY)':'(en '+days+'d)'}</small>
          ${r.notes?`<small style="display:block;margin-top:4px">${escapeHtml(r.notes)}</small>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${owners.map(o => waButtonHTML([o.phone, o.altPhone], {
            message: 'Hola ' + o.name + ', desde la veterinaria le recordamos: ' + r.title,
            label: 'WA',
            title: 'Avisar a ' + o.name,
            fixOnclick: `openOwnerModal('${o.id}')`
          })).join('')}
          <button class="btn btn-sm" onclick="completeReminder('${r.id}')" title="Marcar como hecho" aria-label="Marcar como hecho">${icon('check','ico-sm')}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteReminder('${r.id}')" title="Eliminar">${iconX()}</button>
        </div>
      </div>`;
    }).join('')}
    ${completed.length ? `<h3 style="margin:24px 0 10px">Completados recientes</h3>${completed.map(r => `<div class="reminder-item" style="opacity:.6;border-left-color:var(--text-mute)"><div class="info"><strong>${escapeHtml(r.title)}</strong><small>${formatDate(r.date)}</small></div><button class="btn btn-sm btn-danger" onclick="deleteReminder('${r.id}')" title="Eliminar">${iconX()}</button></div>`).join('')}` : ''}
  `;
}

function openReminderModal(id, presetDate) {
  const r = id ? db.reminders.find(x=>x.id===id) : { id: uid(), date: presetDate || '' };
  const isNew = !id;
  showModal(`
    <div class="modal-header"><h2>${isNew?'Nuevo aviso':'Editar aviso'}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label for="rTitle">Título *</label><input type="text" id="rTitle" value="${escapeAttr(r.title||'')}" placeholder="Ej: Llamar para control post-cirugía"><span class="field-error"></span></div>
      <div class="form-group"><label for="rDate">Fecha del aviso *</label><input type="date" id="rDate" value="${r.date||localDateKey()}"><span class="field-error"></span></div>
      <div class="form-group"><label for="rPet-search">Paciente (opcional)</label>
        ${pickerOne('rPet', petPickerItems({ keepId: r.petId || '' }), r.petId || '', { emptyLabel: 'Sin pacientes' })}</div>
      <div class="form-group"><label for="rNotes">Notas</label><textarea id="rNotes">${escapeHtml(r.notes||'')}</textarea></div>
    </div>
    <div class="modal-footer">
      ${!isNew ? `<button class="btn btn-danger" onclick="deleteReminder('${r.id}')">Eliminar</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveReminder('${r.id}', ${isNew})">Guardar</button>
    </div>
  `);
}

function saveReminder(id, isNew) {
  const title = document.getElementById('rTitle').value.trim();
  const date = document.getElementById('rDate').value;
  const _r1 = validateField('rTitle', !!title, 'El título es obligatorio');
  const _r2 = validateField('rDate', !!date, 'La fecha es obligatoria');
  if (!_r1 || !_r2) return;
  const data = { id, title, date, petId: getPickerOne('rPet'), notes: document.getElementById('rNotes').value, completed: false };
  if (isNew) db.reminders.push(data); else { const i = db.reminders.findIndex(r=>r.id===id); db.reminders[i] = { ...db.reminders[i], ...data }; }
  saveDB(isNew?'Aviso creado':'Aviso actualizado'); closeModal(); render();
}

function completeReminder(id) {
  const r = db.reminders.find(x=>x.id===id);
  r.completed = true;
  saveDB('Aviso completado'); render();
}

function deleteReminder(id) {
  showConfirm('¿Eliminar este aviso?', () => {
    db.reminders = db.reminders.filter(r=>r.id!==id);
    saveDB('Aviso eliminado'); closeModal(); render();
  });
}

// ========================================
// [17] VISTA: CUMPLEAÑOS (BIRTHDAYS)
// ========================================
function getUpcomingBirthdays(days = 30) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const result = [];
  db.pets.forEach(pet => {
    if (!pet.birthdate || pet.deceasedAt || petIsInactive(pet)) return;
    const [year,month,day] = pet.birthdate.split('-').map(Number);
    const bd = new Date(year, month - 1, day);
    const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
    if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
    const diff = Math.floor((thisYear - today) / (1000*60*60*24));
    if (diff <= days) {
      result.push({ ...pet, daysUntil: diff, nextBirthday: thisYear, age: thisYear.getFullYear() - bd.getFullYear() });
    }
  });
  return result.sort((a,b) => a.daysUntil - b.daysUntil);
}

let birthdayWindowDays = 7;

function setBirthdayWindow(days) { birthdayWindowDays = Number(days) || 7; render(); }

async function copyBirthdayContacts(dateKey) {
  const pets = getUpcomingBirthdays(birthdayWindowDays).filter(p => localDateKey(p.nextBirthday) === dateKey);
  const lines = pets.flatMap(p => petOwners(p).map(o => `${p.name} · ${o.name} · ${o.phone || o.altPhone || o.email || 'sin contacto'}`));
  try { await navigator.clipboard.writeText(lines.join('\n')); toast('Contactos del día copiados'); }
  catch (e) { toast('No se pudieron copiar los contactos', 'error'); }
}

var DEFAULT_BIRTHDAY_TEMPLATE = '🎉 ¡Hola! [nombre] está por cumplir [edad] años el [fecha] 🎂\n\nDesde la veterinaria le queremos regalar un 15% de descuento en su próximo control y baño. ¡Esperamos su visita!';

function birthdayTemplate(){
  return (db.settings && db.settings.birthdayTemplate) ? db.settings.birthdayTemplate : DEFAULT_BIRTHDAY_TEMPLATE;
}
// Reemplaza los placeholders por los datos reales de la mascota.
function fillBirthdayMsg(pet){
  var fecha = formatDate(localDateKey(pet.nextBirthday));
  return birthdayTemplate()
    .replace(/\[nombre\]/gi, pet.name)
    .replace(/\[edad\]/gi, pet.age)
    .replace(/\[fecha\]/gi, fecha);
}
function saveBirthdayTemplate(){
  var ta = document.getElementById('birthdayTpl');
  if(!ta) return;
  if(!db.settings) db.settings = {};
  db.settings.birthdayTemplate = ta.value;
  saveDB('Plantilla actualizada');
}

function renderBirthdays() {
  const upcoming = getUpcomingBirthdays(birthdayWindowDays);
  const groups = upcoming.reduce((map,pet) => {
    const key = localDateKey(pet.nextBirthday);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(pet);
    return map;
  }, new Map());
  return `
    <div class="page-header">
      <div class="title"><small>Marketing y fidelización</small><h1>Cumpleaños próximos</h1></div>
    </div>
    <div class="list-filters"><label>Ventana<select class="input" onchange="setBirthdayWindow(this.value)"><option value="7" ${birthdayWindowDays===7?'selected':''}>Próximos 7 días</option><option value="30" ${birthdayWindowDays===30?'selected':''}>Próximos 30 días</option><option value="60" ${birthdayWindowDays===60?'selected':''}>Próximos 60 días</option></select></label><span class="list-filter-count">${upcoming.length} pacientes activos</span></div>
    ${upcoming.length === 0 ? `<div class="empty-state">No hay cumpleaños en los próximos ${birthdayWindowDays} días</div>` :
      [...groups.entries()].map(([dateKey,pets]) => `<section class="birthday-day"><div class="section-title"><h3>${dateKey===localDateKey()?'Hoy':formatDate(dateKey)} <span class="count">${pets.length}</span></h3><button class="btn btn-sm" onclick="copyBirthdayContacts('${dateKey}')">Copiar contactos</button></div><div class="pets-grid">
        ${pets.map(pet => {
          const owners = (pet.ownerIds||[]).map(id => db.owners.find(o=>o.id===id)).filter(Boolean);
          const promoMsg = fillBirthdayMsg(pet);
          return `<div class="pet-card" onclick="openPetDetail('${pet.id}')">
            <div class="pet-photo${pet.photo?'':' is-silhouette'}" style="${petPhotoStyle(pet)}"></div>
            <div class="pet-card-body">
              <h3>${escapeHtml(pet.name)}</h3>
              <div class="meta">${pet.daysUntil === 0 ? `${icon('cake','ico-sm')} ¡HOY cumple ` + pet.age + '!' : `Cumple ${pet.age} años en ${pet.daysUntil} día${pet.daysUntil>1?'s':''}`}</div>
              <div class="meta">${formatDate(localDateKey(pet.nextBirthday))}</div>
              <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap" onclick="event.stopPropagation()">
                ${owners.map(o => waButtonHTML([o.phone, o.altPhone], {
                  message: promoMsg,
                  label: 'WhatsApp ' + o.name.split(' ')[0],
                  fixOnclick: `openOwnerModal('${o.id}')`
                })).join('')}
                ${owners.map(o => o.email ? `<a class="contact-btn mail" href="mailto:${o.email}?subject=${encodeURIComponent('¡Feliz cumpleaños '+pet.name+'!')}&body=${encodeURIComponent(promoMsg)}">Email</a>` : '').join('')}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div></section>`).join('')
    }
    <div class="card" style="margin-top:24px">
      <h3>Plantilla de mensaje promocional</h3>
      <p style="color:var(--text-soft);font-size:var(--fs-sm);margin-top:6px">Editá el mensaje que se envía por WhatsApp/Email. Usá <strong>[nombre]</strong>, <strong>[edad]</strong> y <strong>[fecha]</strong> y se reemplazan automáticamente.</p>
      <textarea id="birthdayTpl" class="input" rows="5" style="margin-top:10px">${escapeHtml(birthdayTemplate())}</textarea>
      <button class="btn btn-primary" style="margin-top:10px" onclick="saveBirthdayTemplate()">Guardar plantilla</button>
    </div>
  `;
}

// ========================================
// [18] VISTA: INVENTARIO (INVENTORY)
// ========================================
