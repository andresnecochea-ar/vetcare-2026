function renderReminders() {
  const pending = db.reminders.filter(r => !r.completed).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const completed = db.reminders.filter(r => r.completed).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20);
  return `
    <div class="page-header">
      <div class="title"><small>Recordatorios para profesionales</small><h1>Avisos a pacientes</h1></div>
      <button class="btn btn-primary" onclick="openReminderModal()">+ Nuevo aviso</button>
    </div>
    <h3 style="margin-bottom:10px">Pendientes (${pending.length})</h3>
    ${pending.length === 0 ? '<div class="empty-state">Sin avisos pendientes</div>' : pending.map(r => {
      const pet = db.pets.find(p=>p.id===r.petId);
      const owners = pet ? (pet.ownerIds||[]).map(id=>db.owners.find(o=>o.id===id)).filter(Boolean) : [];
      const days = Math.floor((new Date(r.date)-new Date())/(1000*60*60*24));
      const cls = days<0?'urgent':days<=3?'soon':'';
      return `<div class="reminder-item ${cls}">
        <div class="info">
          <strong>${escapeHtml(r.title)}</strong>
          <small>${pet?escapeHtml(pet.name)+' · ':''}${formatDate(r.date)} ${days<0?'(vencido '+(-days)+'d)':days===0?'(HOY)':'(en '+days+'d)'}</small>
          ${r.notes?`<small style="display:block;margin-top:4px">${escapeHtml(r.notes)}</small>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${owners.map(o => o.phone ? `<a class="contact-btn wa" href="https://wa.me/${cleanPhone(o.phone)}?text=${encodeURIComponent('Hola '+o.name+', desde la veterinaria le recordamos: '+r.title)}" target="_blank" title="Avisar a ${escapeAttr(o.name)}">WA</a>` : '').join('')}
          <button class="btn btn-sm" onclick="completeReminder('${r.id}')">✓</button>
          <button class="btn btn-sm btn-danger" onclick="deleteReminder('${r.id}')">×</button>
        </div>
      </div>`;
    }).join('')}
    ${completed.length ? `<h3 style="margin:24px 0 10px">Completados recientes</h3>${completed.map(r => `<div class="reminder-item" style="opacity:.6;border-left-color:var(--text-mute)"><div class="info"><strong>${escapeHtml(r.title)}</strong><small>${formatDate(r.date)}</small></div><button class="btn btn-sm btn-danger" onclick="deleteReminder('${r.id}')">×</button></div>`).join('')}` : ''}
  `;
}

function openReminderModal(id, presetDate) {
  const r = id ? db.reminders.find(x=>x.id===id) : { id: uid(), date: presetDate || '' };
  const isNew = !id;
  const petOpts = db.pets.map(p => `<option value="${p.id}" ${r.petId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
  showModal(`
    <div class="modal-header"><h2>${isNew?'Nuevo aviso':'Editar aviso'}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Título *</label><input type="text" id="rTitle" value="${escapeAttr(r.title||'')}" placeholder="Ej: Llamar para control post-cirugía"></div>
      <div class="form-row">
        <div class="form-group"><label>Fecha *</label><input type="date" id="rDate" value="${r.date||''}"></div>
        <div class="form-group"><label>Paciente (opcional)</label><select id="rPet"><option value="">—</option>${petOpts}</select></div>
      </div>
      <div class="form-group"><label>Notas</label><textarea id="rNotes">${escapeHtml(r.notes||'')}</textarea></div>
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
  const data = { id, title, date, petId: document.getElementById('rPet').value, notes: document.getElementById('rNotes').value, completed: false };
  if (isNew) db.reminders.push(data); else { const i = db.reminders.findIndex(r=>r.id===id); db.reminders[i] = { ...db.reminders[i], ...data }; }
  saveDB(); closeModal(); render(); toast(isNew?'Aviso creado':'Aviso actualizado');
}

function completeReminder(id) {
  const r = db.reminders.find(x=>x.id===id);
  r.completed = true;
  saveDB(); render(); toast('Aviso completado');
}

function deleteReminder(id) {
  showConfirm('¿Eliminar este aviso?', () => {
    db.reminders = db.reminders.filter(r=>r.id!==id);
    saveDB(); closeModal(); render();
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
    if (!pet.birthdate) return;
    const bd = new Date(pet.birthdate);
    const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
    if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
    const diff = Math.floor((thisYear - today) / (1000*60*60*24));
    if (diff <= days) {
      result.push({ ...pet, daysUntil: diff, nextBirthday: thisYear, age: thisYear.getFullYear() - bd.getFullYear() });
    }
  });
  return result.sort((a,b) => a.daysUntil - b.daysUntil);
}

function renderBirthdays() {
  const upcoming = getUpcomingBirthdays(60);
  return `
    <div class="page-header">
      <div class="title"><small>Marketing y fidelización</small><h1>Cumpleaños próximos</h1></div>
    </div>
    <p style="margin-bottom:18px;color:var(--text-soft)">Mascotas que cumplen años en los próximos 60 días. Aprovecha para enviar promociones y descuentos.</p>
    ${upcoming.length === 0 ? '<div class="empty-state">No hay cumpleaños próximos en los siguientes 60 días</div>' :
      `<div class="pets-grid">
        ${upcoming.map(pet => {
          const owners = (pet.ownerIds||[]).map(id => db.owners.find(o=>o.id===id)).filter(Boolean);
          const promoMsg = encodeURIComponent(`🎉 ¡Hola! ${pet.name} está por cumplir ${pet.age} años el ${formatDate(pet.nextBirthday.toISOString().split('T')[0])} 🎂\n\nDesde la veterinaria le queremos regalar un 15% de descuento en su próximo control y baño. ¡Esperamos su visita!`);
          return `<div class="pet-card" style="cursor:default">
            <div class="pet-photo${pet.photo?'':' is-silhouette'}" style="${petPhotoStyle(pet)}"></div>
            <div class="pet-card-body">
              <h3>${escapeHtml(pet.name)}</h3>
              <div class="meta">${pet.daysUntil === 0 ? '🎂 ¡HOY cumple ' + pet.age + '!' : `Cumple ${pet.age} años en ${pet.daysUntil} día${pet.daysUntil>1?'s':''}`}</div>
              <div class="meta">${formatDate(pet.nextBirthday.toISOString().split('T')[0])}</div>
              <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
                ${owners.map(o => o.phone ? `<a class="contact-btn wa" href="https://wa.me/${cleanPhone(o.phone)}?text=${promoMsg}" target="_blank">WhatsApp ${escapeHtml(o.name.split(' ')[0])}</a>` : '').join('')}
                ${owners.map(o => o.email ? `<a class="contact-btn mail" href="mailto:${o.email}?subject=${encodeURIComponent('¡Feliz cumpleaños '+pet.name+'!')}&body=${promoMsg}">Email</a>` : '').join('')}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`
    }
    <div class="card" style="margin-top:24px">
      <h3>Plantilla de mensaje promocional</h3>
      <p style="color:var(--text-soft);font-size:var(--fs-sm);margin-top:6px">Este es el mensaje que se envía al hacer clic en WhatsApp/Email:</p>
      <div class="promo-template">🎉 ¡Hola! [Nombre mascota] está por cumplir [edad] años el [fecha] 🎂

Desde la veterinaria le queremos regalar un 15% de descuento en su próximo control y baño. ¡Esperamos su visita!</div>
    </div>
  `;
}

// ========================================
// [18] VISTA: INVENTARIO (INVENTORY)
// ========================================
