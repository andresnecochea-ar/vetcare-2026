// ========================================
// [11e] PLAN SANITARIO — vacunas y antiparasitarios
// Registro con intervalo de refuerzo, lote y profesional; anulación de la
// próxima dosis sin perder el antecedente; certificado imprimible; y la lista
// de vencimientos de toda la veterinaria.
// ========================================

const SANITARY_KINDS = {
  vaccine: {
    collection: 'vaccines',
    label: 'Vacuna',
    plural: 'Vacunas',
    product: 'Vacuna',
    placeholder: 'Ej: Antirrábica',
    intervalLabel: 'Revacunar a los (días)',
    reminderPrefix: 'Refuerzo de',
    reminderType: 'vaccine',
    saved: 'Vacuna guardada'
  },
  deworming: {
    collection: 'dewormings',
    label: 'Antiparasitario',
    plural: 'Antiparasitarios',
    product: 'Antiparasitario',
    placeholder: 'Ej: Pipeta / comprimido',
    intervalLabel: 'Desparasitar a los (días)',
    reminderPrefix: 'Desparasitación:',
    reminderType: 'deworming',
    saved: 'Antiparasitario guardado'
  }
};

function sanitaryList(pet, kind) {
  const config = SANITARY_KINDS[kind];
  if (!pet || !config) return [];
  return pet[config.collection] || [];
}

function sanitaryRecord(pet, kind, id) {
  return sanitaryList(pet, kind).find(record => record.id === id) || null;
}

// Una próxima dosis cuenta como pendiente solo si existe y no fue anulada.
function sanitaryHasPendingDose(record) {
  return Boolean(record && record.nextDose && !record.cancelled);
}

function sanitaryReminderId(recordId) { return `${recordId}:dose`; }

function sanitaryAddDays(dateKey, days) {
  const parts = String(dateKey || '').split('-').map(Number);
  const amount = Number.parseInt(days, 10);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n)) || !Number.isFinite(amount)) return '';
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

// Todos los registros sanitarios del paciente, del más nuevo al más viejo.
function sanitaryRecords(pet) {
  return Object.keys(SANITARY_KINDS)
    .flatMap(kind => sanitaryList(pet, kind).map(record => ({ ...record, kind })))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function sanitaryRowHTML(pet, kind, record) {
  const config = SANITARY_KINDS[kind];
  const pending = sanitaryHasPendingDose(record);
  const days = record.nextDose ? followUpDaysUntil(record.nextDose) : null;
  const editable = canEditClinical();
  const meta = [
    record.lot ? `Lote ${escapeHtml(record.lot)}` : '',
    record.vet ? escapeHtml(record.vet) : ''
  ].filter(Boolean).join(' · ');

  return `
    <div class="sanitary-item${record.cancelled ? ' is-cancelled' : ''}">
      <div class="sanitary-main">
        <strong>${escapeHtml(record.name || config.label)}</strong>
        <small>Aplicado el ${formatDate(record.date)}${meta ? ' · ' + meta : ''}</small>
      </div>
      <div class="sanitary-next">
        ${record.nextDose
          ? (record.cancelled
            ? '<span class="tag">Pr&oacute;xima dosis anulada</span>'
            : `<span class="tag${days !== null && days < 0 ? ' danger' : days !== null && days <= 30 ? ' warning' : ''}">${escapeHtml(followUpWhen(days))}</span><small>${formatDate(record.nextDose)}</small>`)
          : '<small>Sin pr&oacute;xima dosis</small>'}
      </div>
      ${editable ? `<div class="sanitary-actions">
        ${record.nextDose ? `<button class="btn btn-sm" onclick="toggleSanitaryCancelled('${pet.id}','${kind}','${record.id}')">${record.cancelled ? 'Reactivar' : 'Anular dosis'}</button>` : ''}
        ${kind === 'vaccine' ? `<button class="btn btn-sm" onclick="printVaccineCertificate('${pet.id}','${record.id}')">Certificado</button>` : ''}
        <button class="btn btn-sm" onclick="openSanitaryModal('${pet.id}','${kind}','${record.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSanitaryRecord('${pet.id}','${kind}','${record.id}')" title="Eliminar">${iconX()}</button>
      </div>` : ''}
    </div>`;
}

function renderSanitarySection(pet, kind) {
  const config = SANITARY_KINDS[kind];
  const records = [...sanitaryList(pet, kind)].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const pending = records.filter(sanitaryHasPendingDose).length;
  return `
    <div class="section-title">
      <h3>${config.plural}${pending ? ` <span class="sanitary-count">${pending} por vencer</span>` : ''}</h3>
      ${canEditClinical()
        ? `<button class="btn btn-sm btn-primary" onclick="openSanitaryModal('${pet.id}','${kind}')">+ ${config.label}</button>`
        : '<span class="tag">Solo lectura</span>'}
    </div>
    ${records.length === 0
      ? `<div class="empty-state">Sin registros de ${config.plural.toLowerCase()}</div>`
      : records.map(record => sanitaryRowHTML(pet, kind, record)).join('')}`;
}

function renderSanitaryTab(pet) {
  return `
    ${renderSanitarySection(pet, 'vaccine')}
    <div style="margin-top:18px">${renderSanitarySection(pet, 'deworming')}</div>
    ${sanitaryRecords(pet).length
      ? `<div class="sanitary-print"><button class="btn btn-sm" onclick="printSanitaryPlan('${pet.id}')">Imprimir plan sanitario</button></div>`
      : ''}`;
}

function openSanitaryModal(petId, kind, id) {
  if (!canEditClinical()) { toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  if (!pet) return;
  const config = SANITARY_KINDS[kind];
  const record = id ? sanitaryRecord(pet, kind, id) : null;
  if (id && !record) return;

  showModal(`
    <div class="modal-header"><h2>${id ? 'Editar' : 'Registrar'} ${config.label.toLowerCase()}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label for="sanName">${config.product}</label><input type="text" id="sanName" value="${escapeAttr(record?.name || '')}" placeholder="${config.placeholder}"></div>
      <div class="form-row-3">
        <div class="form-group"><label for="sanDate">Fecha de aplicaci&oacute;n</label><input type="date" id="sanDate" value="${escapeAttr(record?.date || localDateKey())}" onchange="recalcSanitaryNextDose()"></div>
        <div class="form-group"><label for="sanInterval">${config.intervalLabel}</label><input type="number" id="sanInterval" min="1" step="1" value="${escapeAttr(record?.intervalDays || '')}" placeholder="365" oninput="recalcSanitaryNextDose()"></div>
        <div class="form-group"><label for="sanNext">Pr&oacute;xima dosis</label><input type="date" id="sanNext" value="${escapeAttr(record?.nextDose || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label for="sanLot">N&uacute;mero de serie o lote</label><input type="text" id="sanLot" value="${escapeAttr(record?.lot || '')}" placeholder="Opcional"></div>
        <div class="form-group"><label for="sanVet">Profesional</label><input type="text" id="sanVet" value="${escapeAttr(record?.vet || '')}" placeholder="Qui&eacute;n lo aplic&oacute;"></div>
      </div>
      <small style="color:var(--text-mute)">Si complet&aacute;s el intervalo, la pr&oacute;xima dosis se calcula sola. Tambi&eacute;n pod&eacute;s ponerla a mano.</small>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveSanitaryRecord('${petId}','${kind}'${id ? `,'${id}'` : ''})">Guardar</button>
    </div>
  `);
}

function recalcSanitaryNextDose() {
  const date = document.getElementById('sanDate')?.value || '';
  const interval = document.getElementById('sanInterval')?.value || '';
  const next = sanitaryAddDays(date, interval);
  const field = document.getElementById('sanNext');
  if (field && next) field.value = next;
}

function saveSanitaryRecord(petId, kind, id) {
  if (!canEditClinical()) { toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  const config = SANITARY_KINDS[kind];
  if (!pet || !config) return;
  const name = document.getElementById('sanName').value.trim();
  const date = document.getElementById('sanDate').value;
  if (!name || !date) { toast('Completá producto y fecha', 'error'); return; }

  const data = {
    name,
    date,
    nextDose: document.getElementById('sanNext').value,
    intervalDays: document.getElementById('sanInterval').value,
    lot: document.getElementById('sanLot').value.trim(),
    vet: document.getElementById('sanVet').value.trim()
  };

  pet[config.collection] = pet[config.collection] || [];
  let record;
  if (id) {
    record = sanitaryRecord(pet, kind, id);
    if (!record) return;
    Object.assign(record, data);
  } else {
    record = { id: uid(), cancelled: '', notifiedAt: '', ...data };
    pet[config.collection].push(record);
  }

  syncSanitaryReminder(petId, kind, record);
  saveDB(config.saved);
  closeModal();
  openPetDetail(petId);
}

// El aviso de la próxima dosis vive con el registro: se crea, se actualiza y se
// da por cumplido junto con él.
function syncSanitaryReminder(petId, kind, record) {
  const config = SANITARY_KINDS[kind];
  const reminderId = sanitaryReminderId(record.id);
  const existing = (db.reminders || []).find(reminder => reminder.id === reminderId);
  if (!sanitaryHasPendingDose(record)) {
    if (existing) existing.completed = true;
    return;
  }
  const title = `${config.reminderPrefix} ${record.name}`.trim();
  if (existing) {
    Object.assign(existing, { title, date: record.nextDose, completed: false });
    return;
  }
  db.reminders.push({
    id: reminderId,
    title,
    petId,
    date: record.nextDose,
    type: config.reminderType,
    completed: false,
    notes: 'Recordatorio automático del plan sanitario'
  });
}

function toggleSanitaryCancelled(petId, kind, id) {
  if (!canEditClinical()) { toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  const record = sanitaryRecord(pet, kind, id);
  if (!record) return;
  record.cancelled = record.cancelled ? '' : '1';
  syncSanitaryReminder(petId, kind, record);
  saveDB(record.cancelled ? 'Próxima dosis anulada' : 'Próxima dosis reactivada');
  render();
}

function deleteSanitaryRecord(petId, kind, id) {
  if (!canEditClinical()) { toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  const config = SANITARY_KINDS[kind];
  const record = sanitaryRecord(pet, kind, id);
  if (!record) return;
  showConfirm(`¿Eliminar el registro de ${escapeHtml(record.name || config.label)}?`, () => {
    pet[config.collection] = sanitaryList(pet, kind).filter(item => item.id !== id);
    const reminder = (db.reminders || []).find(item => item.id === sanitaryReminderId(id));
    if (reminder) db.reminders = db.reminders.filter(item => item.id !== reminder.id);
    saveDB('Registro eliminado');
    closeModal();
    openPetDetail(petId);
  });
}

// ----------------------------------------
// Vencimientos de toda la veterinaria
// ----------------------------------------

let sanitaryDueRange = null;

function sanitaryDefaultRange() {
  if (!sanitaryDueRange) {
    sanitaryDueRange = { from: sanitaryAddDays(localDateKey(), -7), to: sanitaryAddDays(localDateKey(), 30) };
  }
  return sanitaryDueRange;
}

function setSanitaryDueRange(field, value) {
  sanitaryDefaultRange()[field] = value;
  const container = document.getElementById('sanitaryDueList');
  if (container) container.innerHTML = sanitaryDueListHTML();
}

// Dosis cuya fecha cae en el período consultado, sin las anuladas.
function sanitaryDueRecords() {
  const range = sanitaryDefaultRange();
  const rows = [];
  (db.pets || []).forEach(pet => {
    Object.keys(SANITARY_KINDS).forEach(kind => {
      sanitaryList(pet, kind).filter(sanitaryHasPendingDose).forEach(record => {
        if (range.from && record.nextDose < range.from) return;
        if (range.to && record.nextDose > range.to) return;
        rows.push({ pet, kind, record, days: followUpDaysUntil(record.nextDose) });
      });
    });
  });
  return rows.sort((a, b) => String(a.record.nextDose).localeCompare(String(b.record.nextDose)));
}

function sanitaryDueListHTML() {
  const rows = sanitaryDueRecords();
  if (!rows.length) return '<div class="empty-state">No hay dosis por vencer en el per&iacute;odo consultado</div>';
  return rows.map(({ pet, kind, record, days }) => {
    const owners = (pet.ownerIds || []).map(id => db.owners.find(o => o.id === id)).filter(Boolean);
    const owner = owners[0];
    const message = `Hola ${owner ? owner.name : ''}, desde la veterinaria le recordamos que ${pet.name} tiene pendiente ${record.name} el ${formatDate(record.nextDose)}.`;
    return `
      <div class="sanitary-due-item${days !== null && days < 0 ? ' is-overdue' : ''}">
        <div class="sanitary-due-when">
          <strong>${escapeHtml(followUpWhen(days))}</strong>
          <small>${formatDate(record.nextDose)}</small>
        </div>
        <div class="sanitary-due-main">
          <span class="followup-kind"><button type="button" class="link-inline" onclick="openPetDetail('${pet.id}')">${escapeHtml(pet.name)}</button> &middot; ${escapeHtml(SANITARY_KINDS[kind].label)}</span>
          <strong>${escapeHtml(record.name)}</strong>
          ${record.notifiedAt ? `<small>Avisado el ${formatDate(record.notifiedAt)}</small>` : (owner ? `<small><button type="button" class="link-inline" onclick="openOwnerModal('${owner.id}')">${escapeHtml(owner.name)}</button>${owner.phone ? ' · ' + escapeHtml(owner.phone) : ''}</small>` : '<small>Sin tutor asociado</small>')}
        </div>
        <div class="sanitary-due-actions">
          ${owner ? waButtonHTML([owner.phone, owner.altPhone], {
            message,
            label: 'WA',
            title: 'Avisar por WhatsApp',
            fixOnclick: `openOwnerModal('${owner.id}')`
          }) : ''}
          ${canEditClinical() ? `<button class="btn btn-sm" onclick="markSanitaryNotified('${pet.id}','${kind}','${record.id}')">${record.notifiedAt ? 'Quitar aviso' : 'Marcar avisado'}</button>` : ''}
          <button class="btn btn-sm" onclick="openPetDetail('${pet.id}')">Abrir ficha</button>
        </div>
      </div>`;
  }).join('');
}

function renderSanitaryDue() {
  const range = sanitaryDefaultRange();
  const rows = sanitaryDueRecords();
  const overdue = rows.filter(row => row.days !== null && row.days < 0).length;
  return `
    <div class="sanitary-due">
      <div class="today-col-head">
        <svg class="ico" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c3 2.4 5.5 2.9 7 2.9v6.1c0 4-3.2 6.7-7 8-3.8-1.3-7-4-7-8V6.4c1.5 0 4-.5 7-2.9Z"/><path d="M9.2 12.1l2 2 3.6-3.9"/></svg>
        <h3>Plan sanitario por vencer</h3>
        <div class="followup-chips">
          <span class="followup-chip${overdue ? ' is-overdue' : ''}">${overdue} vencida${overdue === 1 ? '' : 's'}</span>
          <span class="followup-chip">${rows.length} en el per&iacute;odo</span>
        </div>
      </div>
      <div class="sanitary-due-range">
        <label>Desde <input type="date" value="${escapeAttr(range.from)}" onchange="setSanitaryDueRange('from',this.value)"></label>
        <label>Hasta <input type="date" value="${escapeAttr(range.to)}" onchange="setSanitaryDueRange('to',this.value)"></label>
      </div>
      <div id="sanitaryDueList">${sanitaryDueListHTML()}</div>
    </div>`;
}

function markSanitaryNotified(petId, kind, id) {
  if (!canEditClinical()) { toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  const record = sanitaryRecord(pet, kind, id);
  if (!record) return;
  record.notifiedAt = record.notifiedAt ? '' : localDateKey();
  saveDB(record.notifiedAt ? 'Aviso registrado' : 'Aviso quitado');
  const container = document.getElementById('sanitaryDueList');
  if (container) container.innerHTML = sanitaryDueListHTML();
}

// ----------------------------------------
// Impresos
// ----------------------------------------

function printVaccineCertificate(petId, id) {
  const pet = db.pets.find(p => p.id === petId);
  const record = sanitaryRecord(pet, 'vaccine', id);
  if (!pet || !record) return;
  printDocument('Certificado de vacunación',
    documentPatientMeta(pet)
    + '<h2>Vacuna aplicada</h2>'
    + '<table><tbody>'
    + '<tr><th>Vacuna</th><td>' + escapeHtml(record.name) + '</td></tr>'
    + '<tr><th>Fecha de aplicación</th><td>' + formatDate(record.date) + '</td></tr>'
    + (record.lot ? '<tr><th>Serie o lote</th><td>' + escapeHtml(record.lot) + '</td></tr>' : '')
    + (record.nextDose && !record.cancelled ? '<tr><th>Próxima dosis</th><td>' + formatDate(record.nextDose) + '</td></tr>' : '')
    + '</tbody></table>'
    + '<div class="sign">' + escapeHtml(record.vet || 'Profesional actuante') + '</div>');
}

function printSanitaryPlan(petId) {
  const pet = db.pets.find(p => p.id === petId);
  if (!pet) return;
  const records = sanitaryRecords(pet);
  if (!records.length) { toast('No hay registros para imprimir'); return; }
  printDocument('Plan sanitario',
    documentPatientMeta(pet)
    + '<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Lote</th><th>Próxima dosis</th></tr></thead><tbody>'
    + records.map(record => '<tr>'
      + '<td>' + formatDate(record.date) + '</td>'
      + '<td>' + escapeHtml(SANITARY_KINDS[record.kind].label) + '</td>'
      + '<td>' + escapeHtml(record.name || '') + '</td>'
      + '<td>' + escapeHtml(record.lot || '—') + '</td>'
      + '<td>' + (record.nextDose ? (record.cancelled ? 'Anulada' : formatDate(record.nextDose)) : '—') + '</td>'
      + '</tr>').join('')
    + '</tbody></table>'
    + '<div class="sign">Profesional actuante</div>');
}

// Superficie mínima para las pruebas automatizadas del plan sanitario.
globalThis.VetCareSanitary = {
  addDays: sanitaryAddDays,
  hasPendingDose: sanitaryHasPendingDose,
  records: sanitaryRecords,
  due: sanitaryDueRecords,
  setRange: (from, to) => { sanitaryDueRange = { from, to }; },
  reminderId: sanitaryReminderId,
  syncReminder: syncSanitaryReminder
};
