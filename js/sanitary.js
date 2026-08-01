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

const DEFAULT_VACCINE_CATALOG = [
  { type:'Antirrábica', intervalDays:'365' },
  { type:'Quíntuple canina', intervalDays:'365' },
  { type:'Séxtuple canina', intervalDays:'365' },
  { type:'Triple felina', intervalDays:'365' },
  { type:'Leucemia felina', intervalDays:'365' },
  { type:'Tos de las perreras', intervalDays:'365' },
  { type:'Otro', intervalDays:'' }
];

function vaccineCatalog() {
  const custom = db.settings?.vaccineCatalog;
  return Array.isArray(custom) && custom.length ? custom : DEFAULT_VACCINE_CATALOG;
}

function inferredVaccineType(record) {
  if (record?.vaccineType) return record.vaccineType;
  const name = normalizedRecordName(record?.name);
  if (/rabi|antirr/.test(name)) return 'Antirrábica';
  if (/quintu|puppy|parvo.*moquillo/.test(name)) return 'Quíntuple canina';
  if (/sextu/.test(name)) return 'Séxtuple canina';
  if (/triple.*fel|fel.*triple/.test(name)) return 'Triple felina';
  if (/leucemia/.test(name)) return 'Leucemia felina';
  if (/tos|bordet/.test(name)) return 'Tos de las perreras';
  return record?.name || 'Otro';
}

function sanitaryInventoryProducts(kind) {
  return (db.inventory || []).filter(item => {
    const category = normalizedRecordName(item.category);
    return kind === 'vaccine' ? category.includes('vacun') : /medic|antiparas|farmac/.test(category);
  });
}

function sanitaryProductOptions(kind, selected) {
  return '<option value="">Sin vincular al inventario</option>' + sanitaryInventoryProducts(kind)
    .map(item => `<option value="${escapeAttr(item.id)}" ${item.id===selected?'selected':''}>${escapeHtml(item.name)} · stock ${invTotalStock(item)}</option>`).join('');
}

function onSanitaryProductChange(kind) {
  const product = (db.inventory || []).find(item => item.id === document.getElementById('sanProduct')?.value);
  if (product) document.getElementById('sanName').value = product.name;
  refreshSanitaryLotOptions(product);
}

function refreshSanitaryLotOptions(product) {
  const select = document.getElementById('sanLotSelect');
  if (!select) return;
  const current = document.getElementById('sanLot')?.value || '';
  const lots = (product?.lots || []).filter(lot => Number(lot.qty) > 0);
  select.innerHTML = '<option value="">Elegir lote disponible</option>' + lots.map(lot => `<option value="${escapeAttr(lot.id)}" data-label="${escapeAttr(lot.code||lot.id)}">${escapeHtml(lot.code||lot.id)} · ${lot.qty} u${lot.expiry?' · vence '+formatDate(lot.expiry):''}</option>`).join('');
  const match = lots.find(lot => (lot.code||lot.id) === current);
  if (match) select.value = match.id;
}

function onSanitaryLotChange() {
  const option = document.getElementById('sanLotSelect')?.selectedOptions[0];
  if (option?.value) document.getElementById('sanLot').value = option.dataset.label || option.value;
}

function onVaccineTypeChange() {
  const entry = vaccineCatalog().find(item => item.type === document.getElementById('sanType')?.value);
  const interval = document.getElementById('sanInterval');
  if (interval && entry?.intervalDays) interval.value = entry.intervalDays;
  recalcSanitaryNextDose();
}

function openVaccineCatalog() {
  if (!canManageSettings()) { toast('Solo una persona administradora puede modificar el catálogo'); return; }
  const rows=vaccineCatalog().map(item=>`<div class="form-row vaccine-catalog-row"><input class="vac-cat-type" value="${escapeAttr(item.type)}" placeholder="Tipo"><input class="vac-cat-days" type="number" min="1" value="${escapeAttr(item.intervalDays||'')}" placeholder="Intervalo en días"><button class="btn btn-sm btn-danger" onclick="this.closest('.vaccine-catalog-row').remove()">${iconX()}</button></div>`).join('');
  showModal(`<div class="modal-header"><h2>Catálogo de vacunas</h2><button class="close-btn" onclick="openSettings()">&times;</button></div><div class="modal-body"><p>Definí los tipos clínicos y el intervalo habitual. Los productos comerciales se vinculan desde Inventario.</p><div id="vaccineCatalogRows">${rows}</div><button class="btn btn-sm" onclick="addVaccineCatalogRow()">+ Tipo</button></div><div class="modal-footer"><button class="btn" onclick="openSettings()">Cancelar</button><button class="btn btn-primary" onclick="saveVaccineCatalog()">Guardar catálogo</button></div>`,true);
}

function addVaccineCatalogRow(){
  document.getElementById('vaccineCatalogRows')?.insertAdjacentHTML('beforeend',`<div class="form-row vaccine-catalog-row"><input class="vac-cat-type" placeholder="Tipo"><input class="vac-cat-days" type="number" min="1" placeholder="Intervalo en días"><button class="btn btn-sm btn-danger" onclick="this.closest('.vaccine-catalog-row').remove()">${iconX()}</button></div>`);
}

function saveVaccineCatalog() {
  if (!canManageSettings()) { toast('Solo una persona administradora puede modificar el catálogo'); return; }
  db.settings.vaccineCatalog=[...document.querySelectorAll('.vaccine-catalog-row')].map(row=>({type:row.querySelector('.vac-cat-type').value.trim(),intervalDays:row.querySelector('.vac-cat-days').value})).filter(item=>item.type);
  saveDB('Catálogo de vacunas actualizado');openSettings();
}

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
  const plan = kind === 'vaccine' ? renderVaccinePlanSummary(records) : '';
  return `
    <div class="section-title">
      <h3>${config.plural}${pending ? ` <span class="sanitary-count">${pending} por vencer</span>` : ''}</h3>
      ${canEditClinical()
        ? `<button class="btn btn-sm btn-primary" onclick="openSanitaryModal('${pet.id}','${kind}')">+ ${config.label}</button>`
        : '<span class="tag">Solo lectura</span>'}
    </div>
    ${plan}
    ${records.length === 0
      ? `<div class="empty-state">Sin registros de ${config.plural.toLowerCase()}</div>`
      : `<details class="sanitary-history" ${records.length<=5?'open':''}><summary>Historial detallado · ${records.length} dosis</summary>${records.map(record => sanitaryRowHTML(pet, kind, record)).join('')}</details>`}`;
}

function renderVaccinePlanSummary(records) {
  if (!records.length) return '';
  const latest = new Map();
  records.forEach(record => {
    const type = inferredVaccineType(record);
    const previous = latest.get(type);
    if (!previous || String(record.date||'') > String(previous.date||'')) latest.set(type, record);
  });
  return `<div class="sanitary-plan-summary">${[...latest.entries()].sort((a,b)=>compareEs(a[0],b[0])).map(([type,record]) => {
    const days = record.nextDose ? followUpDaysUntil(record.nextDose) : null;
    const state = !record.nextDose || record.cancelled ? 'Sin próxima dosis' : followUpWhen(days);
    const tone = days !== null && days < 0 ? 'danger' : days !== null && days <= 30 ? 'warning' : 'success';
    return `<div class="sanitary-plan-card"><strong>${escapeHtml(type)}</strong><span class="tag ${tone}">${escapeHtml(state)}</span><small>Última: ${formatDate(record.date)}${record.nextDose&&!record.cancelled?' · próxima '+formatDate(record.nextDose):''}</small></div>`;
  }).join('')}</div>`;
}

function renderSanitaryTab(pet) {
  return `
    ${renderSanitarySection(pet, 'vaccine')}
    <div style="margin-top:18px">${renderSanitarySection(pet, 'deworming')}</div>
    ${sanitaryRecords(pet).length
      ? `<div class="sanitary-print"><button class="btn btn-sm" onclick="printSanitaryPlan('${pet.id}')">Imprimir plan sanitario</button></div>`
      : ''}`;
}

async function openSanitaryModal(petId, kind, id) {
  if (!canEditClinical()) { toast('Tu rol no permite modificar información clínica'); return; }
  const pet = await ensurePetFull(petId);
  if (!pet) return;
  const config = SANITARY_KINDS[kind];
  const record = id ? sanitaryRecord(pet, kind, id) : null;
  if (id && !record) return;
  const historicalNames = [...new Set((db.pets||[]).flatMap(p => sanitaryList(p, kind).map(item => item.name)).filter(Boolean))].sort(compareEs);
  const vaccineType = kind === 'vaccine' ? inferredVaccineType(record) : '';

  showModal(`
    <div class="modal-header"><h2>${id ? 'Editar' : 'Registrar'} ${config.label.toLowerCase()}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      ${kind==='vaccine'?`<div class="form-group"><label for="sanType">Tipo de vacuna</label><select id="sanType" onchange="onVaccineTypeChange()">${vaccineCatalog().map(item=>`<option value="${escapeAttr(item.type)}" ${item.type===vaccineType?'selected':''}>${escapeHtml(item.type)}</option>`).join('')}</select></div>`:''}
      <div class="form-group"><label for="sanName">${config.product}</label><input type="text" id="sanName" list="sanNameHistory" value="${escapeAttr(record?.name || '')}" placeholder="${config.placeholder}"><datalist id="sanNameHistory">${historicalNames.map(name=>`<option value="${escapeAttr(name)}">`).join('')}</datalist></div>
      <div class="form-group"><label for="sanProduct">Producto del inventario</label><select id="sanProduct" onchange="onSanitaryProductChange('${kind}')">${sanitaryProductOptions(kind,record?.productId||'')}</select></div>
      <div class="form-row-3">
        <div class="form-group"><label for="sanDate">Fecha de aplicaci&oacute;n</label><input type="date" id="sanDate" max="${localDateKey()}" value="${escapeAttr(record?.date || localDateKey())}" onchange="recalcSanitaryNextDose()"><span class="field-error"></span></div>
        <div class="form-group"><label for="sanInterval">${config.intervalLabel}</label><input type="number" id="sanInterval" min="1" step="1" value="${escapeAttr(record?.intervalDays || '')}" placeholder="365" oninput="recalcSanitaryNextDose()"></div>
        <div class="form-group"><label for="sanNext">Pr&oacute;xima dosis</label><input type="date" id="sanNext" value="${escapeAttr(record?.nextDose || '')}"><span class="field-error"></span></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label for="sanLot">N&uacute;mero de serie o lote</label><select id="sanLotSelect" onchange="onSanitaryLotChange()"><option value="">Elegir lote disponible</option></select><input type="text" id="sanLot" value="${escapeAttr(record?.lot || '')}" placeholder="O escribir lote manual" style="margin-top:6px"></div>
        ${attendingFieldHTML('sanVet', record ? record.vet : defaultAttendingName(), 'Quién lo aplicó', record ? record.vetUserId : defaultAttendingUserId())}
      </div>
      <small style="color:var(--text-mute)">Si complet&aacute;s el intervalo, la pr&oacute;xima dosis se calcula sola. Tambi&eacute;n pod&eacute;s ponerla a mano.</small>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveSanitaryRecord('${petId}','${kind}'${id ? `,'${id}'` : ''})">Guardar</button>
    </div>
  `);
  const product = (db.inventory||[]).find(item => item.id === (record?.productId||''));
  refreshSanitaryLotOptions(product);
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
  // Una dosis se registra cuando ya se aplicó; la próxima siempre va después.
  if (!validateField('sanDate', date <= localDateKey(), 'La aplicación no puede tener fecha futura')) return;
  const nextDose = document.getElementById('sanNext').value;
  if (!validateField('sanNext', !nextDose || nextDose > date, 'La próxima dosis tiene que ser posterior a la aplicación')) return;

  const data = {
    name,
    date,
    nextDose: document.getElementById('sanNext').value,
    intervalDays: document.getElementById('sanInterval').value,
    lot: document.getElementById('sanLot').value.trim(),
    vet: getAttendingValue('sanVet'),
    vetUserId: getAttendingUserId('sanVet'),
    vaccineType: kind === 'vaccine' ? document.getElementById('sanType')?.value || '' : '',
    productId: document.getElementById('sanProduct')?.value || ''
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
    if (data.productId) consumeInventoryProduct(data.productId, document.getElementById('sanLotSelect')?.value || '', 1);
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
  (db.pets || []).filter(pet=>typeof petIsInactive !== 'function' || !petIsInactive(pet)).forEach(pet => {
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
    + '<div class="sign">' + escapeHtml(professionalSignature(record.vet, record.vetUserId)) + '</div>');
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
